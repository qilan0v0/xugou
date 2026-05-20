import { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon, ReloadIcon } from '@radix-ui/react-icons';
import api from '../../api/index';

interface Group {
  id: number;
  name: string;
  created_at: string;
}

export default function GroupsList() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchGroups = async () => {
    try {
      const res = await api.get('/api/agents/groups');
      if (res.data?.success) setGroups(res.data.groups || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError('');
    try {
      const res = await api.post('/api/agents/groups', { name });
      if (res.data?.success) {
        setNewName('');
        fetchGroups();
      } else {
        setError(res.data?.message || '添加失败');
      }
    } catch {
      setError('添加失败');
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await api.delete(`/api/agents/groups/${id}`);
      if (res.data?.success) fetchGroups();
    } catch { /* ignore */ }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">加载中...</span></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">分组管理</h1>
        <button onClick={fetchGroups} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
          <ReloadIcon />刷新
        </button>
      </div>

      {/* Add new */}
      <div className="glass rounded-xl p-4 mb-4">
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="输入分组名称，回车添加"
            className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
          />
          <button onClick={handleAdd} disabled={adding || !newName.trim()}
            className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50">
            <PlusIcon />{adding ? '添加中...' : '添加'}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </div>

      {/* Group list */}
      {groups.length === 0 ? (
        <div className="glass p-8 text-center">
          <p className="text-sm text-slate-500">暂无分组，请添加</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">名称</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">创建时间</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-20">操作</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">{g.name}</span>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-slate-500">
                    {new Date(g.created_at).toLocaleString('zh-CN')}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => handleDelete(g.id)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="删除">
                      <TrashIcon className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
