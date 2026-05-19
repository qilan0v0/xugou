import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Pencil1Icon, TrashIcon, ReloadIcon, InfoCircledIcon, ClockIcon, GlobeIcon, ActivityLogIcon } from '@radix-ui/react-icons';
import { getAllMonitors, deleteMonitor, Monitor } from '../../api/monitors';
import { useTranslation } from 'react-i18next';

const MonitorsList = () => {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 60000); return () => clearInterval(i); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('monitors.delete.confirm'))) return;
    try {
      const res = await deleteMonitor(id);
      if (res.success) setMonitors(monitors.filter(m => m.id !== id));
      else alert(res.message || t('monitors.delete.failed'));
    } catch { alert(t('monitors.delete.failed')); }
  };

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

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (error) return <div className="max-w-[1400px] mx-auto px-4 py-8"><div className="glass p-4 mb-4 border-l-4 border-red-500"><span className="text-red-500">{error}</span></div><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('monitors.retry')}</button></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('monitors.pageTitle')}</h1>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />{t('monitors.refresh')}</button>
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
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[180px]">名称</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">URL</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[70px]">方法</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[90px]">状态</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[90px]">延迟</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">可用率</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[80px]">间隔</th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[120px]">标签</th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider w-[100px]">操作</th>
                </tr>
              </thead>
              <tbody>
                {monitors.map(m => {
                  const cfg = sc(m.status);
                  const tags = m.tags ? m.tags.split(',').filter(Boolean) : [];
                  return (
                    <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate block max-w-[170px]">{m.name}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
                          <GlobeIcon className="w-3 h-3 flex-shrink-0 text-slate-400" />
                          <span className="truncate max-w-[280px]">{m.url}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] font-mono font-medium text-slate-500 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded">{m.method}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-medium ${cfg.bg} ${cfg.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                          {m.status === 'up' ? '正常' : m.status === 'down' ? '故障' : '待检'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-400">
                          <ActivityLogIcon className="w-3 h-3 text-slate-400" />
                          <span className="font-mono text-xs">{m.response_time || 0}<span className="text-[10px]">ms</span></span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-sm font-mono ${(m.uptime || 100) >= 99 ? 'text-emerald-600' : (m.uptime || 100) >= 95 ? 'text-amber-600' : 'text-red-500'}`}>
                          {(m.uptime || 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <ClockIcon className="w-3 h-3 text-slate-400" />
                          <span>{Math.round((m.interval || 60) / 60)}分</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 flex-wrap">
                          {tags.length === 0 ? <span className="text-[11px] text-slate-400">--</span> : tags.map(t => (
                            <span key={t} className={`text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${tagColor(t)}`}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex justify-end gap-0.5">
                          <button onClick={() => navigate(`/monitors/${m.id}`)} className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title="详情"><InfoCircledIcon className="w-3.5 h-3.5" /></button>
                          <button onClick={() => navigate(`/monitors/edit/${m.id}`)} className="p-1.5 rounded-md text-slate-400 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title="编辑"><Pencil1Icon className="w-3.5 h-3.5" /></button>
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
    </div>
  );
};

export default MonitorsList;
