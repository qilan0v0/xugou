import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Cross2Icon, Pencil1Icon, InfoCircledIcon, ReloadIcon, CubeIcon, CheckCircledIcon, CrossCircledIcon as CrossCircled, GlobeIcon, ArrowUpIcon, UpdateIcon } from '@radix-ui/react-icons';
import { getAllAgents, deleteAgent, updateAgent, Agent } from '../../api/agents';
import LoadingSpinner from '../../components/LoadingSpinner';
import AgentDetailModal from '../../components/AgentDetailModal';
import TagInput from '../../components/TagInput';
import GroupSelect from '../../components/GroupSelect';
import CountryFlag from '../../components/CountryFlag';
import { ENV_API_BASE_URL } from '../../config';
import { useTranslation } from 'react-i18next';

interface ClientWithStatus extends Agent {
  status?: 'active' | 'inactive' | 'connecting';
}

// ── helpers ──────────────────────────────────────────────
const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' },
  connecting: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  inactive: { bg: 'bg-slate-500/10', text: 'text-slate-500 dark:text-slate-400', dot: 'bg-slate-400' },
};
const sc = (s: string) => statusConfig[s] || statusConfig.inactive;

const tagCols = ['bg-blue-500/10 text-blue-600', 'bg-emerald-500/10 text-emerald-600', 'bg-amber-500/10 text-amber-600', 'bg-purple-500/10 text-purple-600', 'bg-rose-500/10 text-rose-600', 'bg-cyan-500/10 text-cyan-600', 'bg-orange-500/10 text-orange-600', 'bg-indigo-500/10 text-indigo-600'];
function tagColor(t: string) { let h = 0; for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0; return tagCols[Math.abs(h) % tagCols.length]; }

const osColor = (os: string) => (os || '').toLowerCase().includes('debian') ? 'text-rose-500 bg-rose-500/10' :
  (os || '').toLowerCase().includes('ubuntu') ? 'text-orange-500 bg-orange-500/10' :
  (os || '').toLowerCase().includes('alpine') ? 'text-sky-500 bg-sky-500/10' :
  (os || '').toLowerCase().includes('arch') ? 'text-cyan-500 bg-cyan-500/10' : 'text-slate-500 bg-slate-500/10';

// ── inline edit modal ────────────────────────────────────
function EditModal({ agent, onClose, onSaved }: { agent: Agent; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(agent.name);
  const [category, setCategory] = useState(agent.category || '');
  const [tags, setTags] = useState<string[]>(agent.tags ? agent.tags.split(',').filter(Boolean) : []);
  const [trafficVal, setTrafficVal] = useState(() => {
    const tl = agent.traffic_limit; if (!tl) return '';
    if (tl >= 1099511627776) return String(Math.round(tl / 1099511627776 * 10) / 10);
    return String(Math.round(tl / 1073741824 * 10) / 10);
  });
  const [trafficUnit, setTrafficUnit] = useState(() => {
    const tl = agent.traffic_limit; return tl && tl >= 1099511627776 ? 'TB' : 'GB';
  });
  const [startTime, setStartTime] = useState(agent.start_time ? agent.start_time.slice(0, 10) : '');
  const [durationVal, setDurationVal] = useState(agent.duration_value ? String(agent.duration_value) : '1');
  const [durationUnit, setDurationUnit] = useState(agent.duration_unit || 'month');
  const [isPublic, setIsPublic] = useState(agent.public !== 0);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data: any = { name };
      if (category) data.category = category; else data.category = null;
      if (tags.length > 0) data.tags = tags.join(','); else data.tags = null;
      if (trafficVal) {
        const multipliers: Record<string, number> = { GB: 1073741824, TB: 1099511627776 };
        data.traffic_limit = Math.round(parseFloat(trafficVal) * (multipliers[trafficUnit] || 1073741824));
      } else data.traffic_limit = null;
      if (startTime) {
        data.start_time = new Date(startTime).toISOString();
        data.duration_value = parseInt(durationVal) || 1;
        data.duration_unit = durationUnit;
      } else {
        data.start_time = null; data.duration_value = null; data.duration_unit = null; data.expiry_time = null;
      }
      data.public = isPublic;
      await updateAgent(agent.id, data);
      onSaved();
      onClose();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const inputC = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const labelC = "block text-xs font-medium text-slate-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[8vh] p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl glass rounded-2xl shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="font-semibold text-slate-900 dark:text-white">编辑客户端 · {agent.name}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"><Cross2Icon /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          <div><label className={labelC}>名称 *</label><input value={name} onChange={e => setName(e.target.value)} required className={inputC} /></div>
          <div><label className={labelC}>分组</label><GroupSelect value={category} onChange={setCategory} placeholder="选择或输入分组" className={inputC} /></div>
          <div>
            <label className={labelC}>标签</label>
            <TagInput value={tags} onChange={setTags} placeholder="输入标签，回车添加" />
          </div>
          <div>
            <label className={labelC}>总流量上限</label>
            <div className="flex gap-2">
              <input type="number" step="0.1" min="0" value={trafficVal} onChange={e => setTrafficVal(e.target.value)} placeholder="1" className={`${inputC} flex-1`} />
              <select value={trafficUnit} onChange={e => setTrafficUnit(e.target.value)} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 w-20 flex-shrink-0">
                {(['GB','TB'] as const).map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelC}>开始时间</label>
            <input type="date" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputC} />
          </div>
          <div>
            <label className={labelC}>使用时长</label>
            <div className="flex gap-2">
              <input type="number" min="1" step="1" value={durationVal} onChange={e => setDurationVal(e.target.value)} className={`${inputC} flex-1`} />
              <select value={durationUnit} onChange={e => setDurationUnit(e.target.value)} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 w-24 flex-shrink-0">
                {(['day','month','year'] as const).map(u => <option key={u} value={u}>{u === 'day' ? '天' : u === 'month' ? '月' : '年'}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="chk-box" /><span className="text-xs text-slate-500">公开显示</span></label>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">取消</button>
            <button type="submit" disabled={saving} className="btn-gradient px-5 py-2 text-sm flex items-center gap-1.5"><UpdateIcon />{saving ? '保存中...' : '保存'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── main page ────────────────────────────────────────────
const AgentsList = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ClientWithStatus[]>([]);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Agent | null>(null);
  const [detailAgent, setDetailAgent] = useState<Agent | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const { t } = useTranslation();

  const fetchAgents = async () => {
    setError(null);
    try {
      const response = await getAllAgents();
      if (!response.success || !response.agents) throw new Error(response.message || t('common.error.fetch'));
      setAgents(response.agents.map((a: Agent) => ({
        ...a,
        status: (a.status === 'active' || a.status === 'connecting') ? a.status as 'active' | 'connecting' : 'inactive'
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error.fetch'));
    } finally {
      setFetched(true);
    }
  };

  useEffect(() => {
    fetchAgents();
    let sseDebounce: any = null;
    const es = new EventSource((ENV_API_BASE_URL || '') + '/api/events');
    const refresh = () => {
      if (sseDebounce) clearTimeout(sseDebounce);
      sseDebounce = setTimeout(() => fetchAgents(), 500);
    };
    es.addEventListener('agent-update', refresh);
    return () => { es.close(); };
  }, []);

  const toggle = (id: number) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  const toggleAll = () => {
    const filtered = agents.filter(a => matchFilter(a));
    if (filtered.every(a => selected.has(a.id))) setSelected(new Set()); else setSelected(new Set(filtered.map(a => a.id)));
  };

  const matchFilter = (a: ClientWithStatus) => {
    if (categoryFilter && a.category !== categoryFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const haystack = [a.name, a.hostname, a.ip_address, a.os, a.tags].join(' ').toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  };

  const handleBatchDelete = async () => {
    if (!window.confirm(`确定删除选中的 ${selected.size} 个客户端吗？`)) return;
    let ok = 0;
    for (const id of selected) { try { const r = await deleteAgent(id); if (r.success) ok++; } catch {} }
    setSelected(new Set());
    fetchAgents();
    alert(`已删除 ${ok} / ${selected.size} 个`);
  };

  const handleDeleteOne = async (id: number) => {
    if (!window.confirm(t('agent.deleteConfirm'))) return;
    try { const r = await deleteAgent(id); if (r.success) fetchAgents(); else alert(r.message || '删除失败'); }
    catch { alert('删除失败'); }
  };

  if (!fetched) return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>;
  if (error) return <div className="max-w-[1400px] mx-auto px-4 py-8"><div className="glass p-4 mb-4 border-l-4 border-red-500"><span className="text-red-500">{error}</span></div><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('common.retry')}</button></div>;

  const filtered = agents.filter(matchFilter);
  const totalRx = agents.reduce((s, a) => s + (a.network_rx_total || 0), 0);
  const totalTx = agents.reduce((s, a) => s + (a.network_tx_total || 0), 0);
  const fmt = (bytes: number) => { if (!bytes) return '0 B'; const u = ['B','KB','MB','GB','TB']; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return v.toFixed(1)+' '+u[i]; };
  const online = agents.filter(a => a.status === 'active').length;
  const offline = agents.length - online;
  const regions = [...new Set(agents.map(a => a.country).filter(Boolean))].length;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agents.pageTitle')}</h1>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">已选 {selected.size} 项</span>
              <button onClick={handleBatchDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"><Cross2Icon className="w-3 h-3" />批量删除</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchAgents} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />{t('common.refresh')}</button>
          <button onClick={() => navigate('/agents/create')} className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm"><PlusIcon />{t('agents.create')}</button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {[
          { label: '服务器总数', value: agents.length, bg: 'bg-blue-500/10', text: 'text-blue-600', icon: <CubeIcon /> },
          { label: '在线', value: online, bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: <CheckCircledIcon /> },
          { label: '离线', value: offline, bg: 'bg-slate-500/10', text: 'text-slate-500', icon: <CrossCircled /> },
          { label: '地区', value: regions, bg: 'bg-purple-500/10', text: 'text-purple-600', icon: <GlobeIcon /> },
          { label: '总流量', value: fmt(totalTx + totalRx), bg: 'bg-orange-500/10', text: 'text-orange-600', icon: <ArrowUpIcon />, sub: `↑${fmt(totalTx)}  ↓${fmt(totalRx)}` },
        ].map((card, i) => (
          <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${card.bg} ${card.text} flex items-center justify-center flex-shrink-0`}>{card.icon}</div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 truncate">{card.label}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white truncate">{card.value}</div>
              {'sub' in card && card.sub && <div className="text-[10px] text-slate-400 truncate mt-0.5">{card.sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Search + Category */}
      <div className="flex gap-3 mb-3">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索名称、主机名、IP、标签..." className="flex-1 px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all" />
      </div>
      {(() => {
        const cats = [...new Set(agents.map(a => a.category).filter(Boolean))] as string[];
        if (!cats.length) return null;
        return (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setCategoryFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!categoryFilter ? 'bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-white/5'}`}>全部</button>
            {cats.map(cat => <button key={cat} onClick={() => setCategoryFilter(cat)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-white/5'}`}>{cat}</button>)}
          </div>
        );
      })()}

      {filtered.length === 0 ? (
        <div className="glass p-8 text-center border-dashed">
          <p className="text-slate-500 mb-3">{t('agents.noAgents')}</p>
          <button onClick={() => navigate('/agents/create')} className="btn-gradient px-4 py-2 text-sm inline-flex items-center gap-1.5"><PlusIcon />{t('agents.create')}</button>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                  <th className="w-10 px-3 py-3"><input type="checkbox" checked={filtered.length > 0 && filtered.every(a => selected.has(a.id))} onChange={toggleAll} className="chk-box" /></th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[140px]">名称</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[120px]">主机名</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[130px]">IP</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">状态</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[110px]">系统</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[60px]">地区</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">CPU</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">流量</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">标签</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => {
                  const cfg = sc(a.status || 'inactive');
                  const label = a.status === 'active' ? t('agent.status.online') : a.status === 'connecting' ? t('agent.status.connecting') : t('agent.status.offline');
                  const sel = selected.has(a.id);
                  const tags = a.tags ? a.tags.split(',').filter(Boolean) : [];
                  return (
                    <tr key={a.id} className={`border-b border-white/[0.04] transition-colors ${sel ? 'bg-blue-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={sel} onChange={() => toggle(a.id)} className="chk-box" /></td>
                      <td className="px-4 py-2.5"><span className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[130px]">{a.name}</span></td>
                      <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 truncate max-w-[110px]">{a.hostname || '--'}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 font-mono text-xs">{a.ip_address || '--'}</td>
                      <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{label}</span></td>
                      <td className="px-4 py-2.5">{a.os ? <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${osColor(a.os)}`}>{a.os.split(' ')[0]}</span> : <span className="text-sm text-slate-400">--</span>}</td>
                      <td className="px-4 py-2.5">{a.country ? <span className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><CountryFlag code={a.country} className="w-4 h-3 rounded-sm" />{a.country}</span> : <span className="text-slate-400">--</span>}</td>
                      <td className="px-4 py-2.5"><span className="text-sm font-mono text-slate-600 dark:text-slate-400">{a.cpu_usage != null ? `${Math.round(a.cpu_usage)}%` : '--'}</span></td>
                      <td className="px-4 py-2.5 text-xs text-slate-500">{fmt((a.network_rx_total || 0) + (a.network_tx_total || 0))}</td>
                      <td className="px-4 py-2.5"><div className="flex gap-1 flex-wrap">{tags.length === 0 ? <span className="text-[11px] text-slate-400">--</span> : tags.map(t => <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${tagColor(t)}`}>{t}</span>)}</div></td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => setDetailAgent(a)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="详情"><InfoCircledIcon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditing(a)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title="编辑"><Pencil1Icon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteOne(a.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="删除"><Cross2Icon className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && <EditModal agent={editing} onClose={() => setEditing(null)} onSaved={fetchAgents} />}
      {detailAgent && <AgentDetailModal agent={detailAgent} onClose={() => setDetailAgent(null)} showToken />}
    </div>
  );
};

export default AgentsList;
