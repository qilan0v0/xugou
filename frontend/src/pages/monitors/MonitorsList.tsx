import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Pencil1Icon, TrashIcon, Cross2Icon, ReloadIcon, InfoCircledIcon, ClockIcon, GlobeIcon, ActivityLogIcon, UpdateIcon } from '@radix-ui/react-icons';
import { getAllMonitors, deleteMonitor, updateMonitor, Monitor } from '../../api/monitors';
import StatusCodeSelect from '../../components/StatusCodeSelect';
import TagInput from '../../components/TagInput';
import { useTranslation } from 'react-i18next';

// ── helpers ──────────────────────────────────────────────
const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  up:    { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  down:  { bg: 'bg-red-500/10',    text: 'text-red-500 dark:text-red-400',          dot: 'bg-red-500' },
  pending: { bg: 'bg-amber-500/10',  text: 'text-amber-600 dark:text-amber-400',      dot: 'bg-amber-500' },
};
const sc = (s: string) => statusConfig[s] || statusConfig.pending;

const tagColors = ['bg-blue-500/10 text-blue-600', 'bg-emerald-500/10 text-emerald-600', 'bg-amber-500/10 text-amber-600', 'bg-purple-500/10 text-purple-600', 'bg-rose-500/10 text-rose-600', 'bg-cyan-500/10 text-cyan-600', 'bg-orange-500/10 text-orange-600', 'bg-indigo-500/10 text-indigo-600'];
function tagColor(t: string) {
  let h = 0; for (let i = 0; i < t.length; i++) h = ((h << 5) - h + t.charCodeAt(i)) | 0;
  return tagColors[Math.abs(h) % tagColors.length];
}

// ── inline edit modal ────────────────────────────────────
function EditModal({ monitor, onClose, onSaved }: { monitor: Monitor; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: monitor.name, url: monitor.url, method: monitor.method, interval: Math.round((monitor.interval || 60) / 60), timeout: monitor.timeout || 30, expectedStatus: monitor.expected_status || 200, body: monitor.body || '', active: monitor.active !== false });
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(() => {
    let p: Record<string, string> = {};
    try { p = typeof monitor.headers === 'string' ? JSON.parse(monitor.headers) : (monitor.headers || {}); } catch {}
    const h = Object.entries(p).map(([k, v]) => ({ key: k, value: String(v) }));
    return h.length ? h : [{ key: '', value: '' }];
  });
  const [tags, setTags] = useState<string[]>(monitor.tags ? monitor.tags.split(',').filter(Boolean) : []);
  const [isPublic, setIsPublic] = useState(monitor.public !== 0);
  const [saving, setSaving] = useState(false);

  const hToJson = () => { const r: Record<string, string> = {}; headers.forEach(({ key, value }) => { if (key.trim()) r[key.trim()] = value; }); return r; };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMonitor(monitor.id, {
        ...form, interval: form.interval * 60, headers: hToJson(),
        public: isPublic, active: form.active,
        tags: tags.length > 0 ? tags.join(',') : null,
      });
      onSaved();
      onClose();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  const inputC = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const labelC = "block text-xs font-medium text-slate-500 mb-1.5";
  const showBody = ['POST', 'PUT', 'PATCH'].includes(form.method);

  const f = (k: string) => (e: any) => setForm(prev => ({ ...prev, [k]: ['interval', 'timeout', 'expectedStatus'].includes(k) ? parseInt(e.target.value) || 0 : e.target.value }));

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative w-full max-w-xl glass rounded-2xl shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-white/[0.06]">
          <h3 className="font-semibold text-slate-900 dark:text-white">编辑监控 · {monitor.name}</h3>
          <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"><Cross2Icon /></button>
        </div>
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          <div><label className={labelC}>名称 *</label><input value={form.name} onChange={f('name')} required className={inputC} /></div>
          <div><label className={labelC}>URL *</label><input value={form.url} onChange={f('url')} required className={inputC} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelC}>方法</label><select value={form.method} onChange={f('method')} className={inputC}>{['GET','POST','PUT','DELETE','HEAD'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className={labelC}>间隔(分)</label><input type="number" value={form.interval} onChange={f('interval')} min="1" className={inputC} /></div>
            <div><label className={labelC}>超时(秒)</label><input type="number" value={form.timeout} onChange={f('timeout')} min="1" className={inputC} /></div>
          </div>
          <div><label className={labelC}>期望状态码</label><StatusCodeSelect value={form.expectedStatus} onChange={v => setForm(prev => ({ ...prev, expectedStatus: v }))} /></div>
          <div>
            <label className={labelC}>标签</label>
            <TagInput value={tags} onChange={setTags} placeholder="输入标签，回车添加" poolUrl="/api/monitors/tags/pool" />
          </div>
          <div>
            <label className={labelC}>请求头</label>
            <div className="border border-white/[0.08] rounded-lg p-3 flex flex-col gap-2">
              {headers.map((h, i) => (
                <div key={i} className="flex gap-2">
                  <input placeholder="名称" value={h.key} onChange={e => { const n = [...headers]; n[i] = { ...n[i], key: e.target.value }; if (i === n.length - 1 && (n[i].key || n[i].value)) n.push({ key: '', value: '' }); setHeaders(n); }} className={`${inputC} flex-1`} />
                  <input placeholder="值" value={h.value} onChange={e => { const n = [...headers]; n[i] = { ...n[i], value: e.target.value }; setHeaders(n); }} className={`${inputC} flex-1`} />
                  {headers.length > 1 && <button type="button" onClick={() => { const n = [...headers]; n.splice(i, 1); setHeaders(n); }} className="p-2 text-slate-400 hover:text-red-500"><Cross2Icon /></button>}
                </div>
              ))}
            </div>
          </div>
          {showBody && <div><label className={labelC}>Body</label><textarea value={form.body} onChange={f('body')} className={inputC} rows={4} /></div>}
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.active} onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))} className="w-4 h-4" /><span className="text-xs text-slate-500">启用</span></label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="w-4 h-4" /><span className="text-xs text-slate-500">公开显示</span></label>
          </div>
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
const MonitorsList = () => {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<Monitor | null>(null);
  const { t } = useTranslation();

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getAllMonitors();
      if (response.success && response.monitors) setMonitors(response.monitors);
      else setError(response.message || t('monitors.loadingError'));
    } catch {
      setError(t('monitors.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggle = (id: number) => { const n = new Set(selected); if (n.has(id)) n.delete(id); else n.add(id); setSelected(n); };
  const toggleAll = () => { if (selected.size === monitors.length) setSelected(new Set()); else setSelected(new Set(monitors.map(m => m.id))); };

  const handleBatchDelete = async () => {
    if (!window.confirm(`确定删除选中的 ${selected.size} 个监控吗？`)) return;
    let ok = 0;
    for (const id of selected) { try { const r = await deleteMonitor(id); if (r.success) ok++; } catch {} }
    setSelected(new Set());
    fetchData();
    alert(`已删除 ${ok} / ${selected.size} 个`);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('monitors.delete.confirm'))) return;
    try {
      const res = await deleteMonitor(id);
      if (res.success) setMonitors(monitors.filter(m => m.id !== id));
      else alert(res.message || t('monitors.delete.failed'));
    } catch { alert(t('monitors.delete.failed')); }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (error) return <div className="max-w-[1400px] mx-auto px-4 py-8"><div className="glass p-4 mb-4 border-l-4 border-red-500"><span className="text-red-500">{error}</span></div><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('monitors.retry')}</button></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('monitors.pageTitle')}</h1>
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">已选 {selected.size} 项</span>
              <button onClick={handleBatchDelete} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-colors"><TrashIcon className="w-3 h-3" />批量删除</button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />刷新</button>
          <button onClick={() => navigate('/monitors/create')} className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm"><PlusIcon />{t('monitors.create')}</button>
        </div>
      </div>

      {monitors.length === 0 ? (
        <div className="glass p-8 text-center border-dashed">
          <p className="text-slate-500 mb-3">{t('monitors.notFound')}</p>
          <button onClick={() => navigate('/monitors/create')} className="btn-gradient px-4 py-2 text-sm inline-flex items-center gap-1.5"><PlusIcon />{t('monitors.addOne')}</button>
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
                  <th className="w-10 px-3 py-3"><input type="checkbox" checked={selected.size === monitors.length && monitors.length > 0} onChange={toggleAll} className="w-4 h-4 rounded accent-blue-500" /></th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[160px]">名称</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">URL</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[70px]">方法</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[85px]">状态</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[85px]">延迟</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">可用率</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">间隔</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[110px]">标签</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map(m => {
                  const cfg = sc(m.status);
                  const tags = m.tags ? m.tags.split(',').filter(Boolean) : [];
                  const sel = selected.has(m.id);
                  return (
                    <tr key={m.id} className={`border-b border-white/[0.04] transition-colors ${sel ? 'bg-blue-500/[0.04]' : 'hover:bg-white/[0.02]'}`}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={sel} onChange={() => toggle(m.id)} className="w-4 h-4 rounded accent-blue-500" /></td>
                      <td className="px-4 py-2.5"><span className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[150px]">{m.name}</span></td>
                      <td className="px-4 py-2.5"><div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><GlobeIcon className="w-3 h-3 flex-shrink-0 text-slate-400" /><span className="truncate max-w-[260px]">{m.url}</span></div></td>
                      <td className="px-4 py-2.5"><span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">{m.method}</span></td>
                      <td className="px-4 py-2.5"><span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}><span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{m.status === 'up' ? '正常' : m.status === 'down' ? '故障' : '待检'}</span></td>
                      <td className="px-4 py-2.5"><div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400"><ActivityLogIcon className="w-3 h-3 text-slate-400" /><span className="font-mono text-xs">{m.response_time || 0}<span className="text-[10px]">ms</span></span></div></td>
                      <td className="px-4 py-2.5"><span className={`text-sm font-mono ${(m.uptime || 100) >= 99 ? 'text-emerald-600' : (m.uptime || 100) >= 95 ? 'text-amber-600' : 'text-red-500'}`}>{(m.uptime || 100).toFixed(1)}%</span></td>
                      <td className="px-4 py-2.5"><div className="flex items-center gap-1 text-xs text-slate-500"><ClockIcon className="w-3 h-3 text-slate-400" /><span>{Math.round((m.interval || 60) / 60)}分</span></div></td>
                      <td className="px-4 py-2.5"><div className="flex gap-1 flex-wrap">{tags.length === 0 ? <span className="text-[11px] text-slate-400">--</span> : tags.map(t => <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${tagColor(t)}`}>{t}</span>)}</div></td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => navigate(`/monitors/${m.id}`)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="详情"><InfoCircledIcon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditing(m)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title="编辑"><Pencil1Icon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-colors" title="删除"><TrashIcon className="w-3.5 h-3.5" /></button>
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

      {editing && <EditModal monitor={editing} onClose={() => setEditing(null)} onSaved={fetchData} />}
    </div>
  );
};

export default MonitorsList;
