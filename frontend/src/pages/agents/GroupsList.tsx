import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ReloadIcon, Cross2Icon, CubeIcon } from '@radix-ui/react-icons';
import api from '../../api/index';

interface Group {
  id: number;
  name: string;
  created_at: string;
  agent_count: number;
}

interface AgentBrief {
  id: number;
  name: string;
  category: string | null;
}

export default function GroupsList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [agents, setAgents] = useState<AgentBrief[]>([]);
  const [assignOpen, setAssignOpen] = useState<number | null>(null);
  const [allAgents, setAllAgents] = useState<AgentBrief[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [assignLoading, setAssignLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const fetchGroups = async () => {
    try {
      const res = await api.get('/api/agents/groups');
      if (res.data?.success) setGroups(res.data.groups || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  const fetchAgents = async (groupName: string) => {
    try {
      const res = await api.get('/api/agents');
      if (res.data?.success) {
        setAgents((res.data.agents || []).filter((a: AgentBrief) => a.category === groupName));
      }
    } catch {}
  };

  const fetchAllAgents = async () => {
    try {
      const res = await api.get('/api/agents');
      if (res.data?.success) {
        setAllAgents(res.data.agents || []);
      }
    } catch {}
  };

  const toggleExpand = (g: Group) => {
    if (expanded === g.id) { setExpanded(null); return; }
    setExpanded(g.id);
    fetchAgents(g.name);
  };

  const openAssign = async (g: Group) => {
    setAssignOpen(g.id);
    setSelectedIds(new Set());
    setAssignLoading(true);
    await fetchAllAgents();
    setAssignLoading(false);
  };

  const toggleSelect = (id: number) => {
    const n = new Set(selectedIds);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelectedIds(n);
  };

  const handleAssign = async (g: Group) => {
    if (selectedIds.size === 0) return;
    try {
      await api.post(`/api/agents/groups/${g.id}/agents`, { agent_ids: Array.from(selectedIds) });
      setAssignOpen(null);
      fetchGroups();
      if (expanded === g.id) fetchAgents(g.name);
    } catch { /* ignore */ }
  };

  const handleRemoveAgent = async (g: Group, agentId: number) => {
    try {
      await api.delete(`/api/agents/groups/${g.id}/agents/${agentId}`);
      fetchGroups();
      fetchAgents(g.name);
    } catch {}
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError('');
    try {
      const res = await api.post('/api/agents/groups', { name });
      if (res.data?.success) { setNewName(''); fetchGroups(); }
      else setError(res.data?.message || '添加失败');
    } catch { setError('添加失败'); }
    finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该分组？')) return;
    try {
      const res = await api.delete(`/api/agents/groups/${id}`);
      if (res.data?.success) fetchGroups();
    } catch {}
  };

  const toggle = (id: number) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  const toggleAll = () => { if (selected.size === groups.length) setSelected(new Set()); else setSelected(new Set(groups.map(g => g.id))); };

  const handleBatchDelete = async () => {
    if (!window.confirm(`确定删除选中的 ${selected.size} 个分组吗？`)) return;
    let ok = 0;
    for (const id of selected) { try { await api.delete(`/api/agents/groups/${id}`); ok++; } catch {} }
    setSelected(new Set());
    fetchGroups();
    alert(`已删除 ${ok} / ${selected.size} 个`);
  };

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">加载中...</span></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">分组管理</h1>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">已选 {selected.size} 项</span>
              <button onClick={handleBatchDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors">
                <TrashIcon className="w-3 h-3" />批量删除
              </button>
            </div>
          )}
        </div>
        <button onClick={fetchGroups} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white dark:bg-slate-900 transition-colors">
          <ReloadIcon />刷新
        </button>
      </div>

      {/* Add new */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex gap-2">
          <input value={newName} onChange={e => { setNewName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="输入分组名称，回车添加" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" />
          <button onClick={handleAdd} disabled={adding || !newName.trim()}
            className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50">
            <PlusIcon />{adding ? '...' : '添加'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {groups.length === 0 ? (
        <div className="glass p-8 text-center"><p className="text-sm text-slate-500">暂无分组，请添加</p></div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                <th className="w-10 px-3 py-3"><input type="checkbox" checked={selected.size === groups.length && groups.length > 0} onChange={toggleAll} className="chk-box" /></th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">名称</th>
                <th className="text-center px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-20">客户端</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">创建时间</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-28">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <>
                  <tr key={g.id} className={`border-b border-white/[0.04] transition-colors ${selected.has(g.id) ? 'bg-blue-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                    <td className="px-3 py-2.5"><input type="checkbox" checked={selected.has(g.id)} onChange={() => toggle(g.id)} className="chk-box" /></td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => toggleExpand(g)} className="text-left">
                        <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-colors">
                          {g.name}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <button onClick={() => toggleExpand(g)}
                        className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-blue-500 transition-colors">
                        {g.agent_count}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-sm text-slate-500">
                      {new Date(g.created_at).toLocaleString('zh-CN')}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openAssign(g)}
                          className="px-2 py-1 rounded-md text-xs text-blue-500 hover:bg-blue-500/10 transition-colors">
                          添加客户端
                        </button>
                        <button onClick={() => handleDelete(g.id)}
                          className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="删除">
                          <TrashIcon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {/* Expanded: agents in group */}
                  {expanded === g.id && (
                    <tr key={`exp-${g.id}`}>
                      <td colSpan={5} className="px-4 py-3 bg-slate-50/30 dark:bg-white/[0.01]">
                        {agents.length === 0 ? (
                          <p className="text-xs text-slate-400">该分组暂无客户端</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {agents.map(a => (
                              <span key={a.id} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-slate-100 dark:bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                                <CubeIcon className="w-3 h-3" />
                                {a.name}
                                <button onClick={() => handleRemoveAgent(g, a.id)}
                                  className="ml-0.5 w-3.5 h-3.5 rounded-full inline-flex items-center justify-center hover:bg-red-500/10 hover:text-red-500 transition-colors">
                                  <Cross2Icon className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assign modal */}
      {assignOpen !== null && (() => {
        const g = groups.find(x => x.id === assignOpen)!;
        const available = allAgents.filter(a => a.category !== g.name);
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) setAssignOpen(null); }}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <div className="relative w-full max-w-md glass rounded-2xl shadow-2xl max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
                <h3 className="font-semibold text-slate-900 dark:text-white">添加客户端到「{g?.name}」</h3>
                <button onClick={() => setAssignOpen(null)} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white dark:bg-slate-900 text-slate-400"><Cross2Icon /></button>
              </div>
              <div className="p-5">
                {assignLoading ? (
                  <p className="text-sm text-slate-400 text-center py-4">加载客户端列表...</p>
                ) : available.length === 0 ? (
                  <p className="text-sm text-slate-500">所有客户端已在该分组中</p>
                ) : (
                  <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                    {available.map(a => (
                      <label key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white dark:bg-slate-900 cursor-pointer text-sm text-slate-700 dark:text-slate-300">
                        <input type="checkbox" checked={selectedIds.has(a.id)} onChange={() => toggleSelect(a.id)} className="chk-box" />
                        {a.name}
                        {a.category && <span className="text-[10px] text-slate-400 ml-auto">{a.category}</span>}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-white/[0.06]">
                  <button onClick={() => setAssignOpen(null)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white dark:bg-slate-900">取消</button>
                  <button onClick={() => handleAssign(g)} disabled={selectedIds.size === 0}
                    className="btn-gradient px-5 py-2 text-sm disabled:opacity-50">
                    添加 {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
