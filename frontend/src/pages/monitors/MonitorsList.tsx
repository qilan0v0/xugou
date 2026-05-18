import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Pencil1Icon, TrashIcon, CheckCircledIcon, CrossCircledIcon, QuestionMarkCircledIcon, LayoutIcon, ViewGridIcon, ReloadIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { getAllMonitors, deleteMonitor, Monitor } from '../../api/monitors';
import MonitorCard from '../../components/MonitorCard';
import { useTranslation } from 'react-i18next';

const MonitorsList = () => {
  const navigate = useNavigate();
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'grid'>('grid');
  const { t } = useTranslation();

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await getAllMonitors();
      if (response.success && response.monitors) setMonitors(response.monitors);
      else setError(response.message || t('monitors.loadingError'));
    } catch (err) {
      setError(t('monitors.loadingError'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 60000); return () => clearInterval(i); }, []);

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('monitors.delete.confirm'))) return;
    try {
      const response = await deleteMonitor(id);
      if (response.success) setMonitors(monitors.filter(m => m.id !== id));
      else alert(response.message || t('monitors.delete.failed'));
    } catch (err) { alert(t('monitors.delete.failed')); }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case 'up': return <CheckCircledIcon className="text-emerald-500" />;
      case 'down': return <CrossCircledIcon className="text-red-500" />;
      default: return <QuestionMarkCircledIcon className="text-slate-400" />;
    }
  };

  const statusColors: Record<string, string> = { up: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', down: 'bg-red-500/10 text-red-500', pending: 'bg-slate-500/10 text-slate-500' };
  const statusLabels: Record<string, string> = { up: t('monitors.status.up'), down: t('monitors.status.down'), pending: t('monitor.status.pending') };

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (error) return <div className="max-w-[1400px] mx-auto px-4 py-8"><div className="glass p-4 mb-4 border-l-4 border-red-500"><span className="text-red-500">{error}</span></div><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('monitors.retry')}</button></div>;

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('monitors.pageTitle')}</h1>
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-slate-100 dark:bg-white/5 p-0.5">
            <button onClick={() => setView('grid')} className={`p-2 rounded-md transition-colors ${view === 'grid' ? 'bg-white dark:bg-white/10 shadow-sm text-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><ViewGridIcon /></button>
            <button onClick={() => setView('list')} className={`p-2 rounded-md transition-colors ${view === 'list' ? 'bg-white dark:bg-white/10 shadow-sm text-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><LayoutIcon /></button>
          </div>
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />{t('monitors.refresh')}</button>
          <button onClick={() => navigate('/monitors/create')} className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm"><PlusIcon />{t('monitors.create')}</button>
        </div>
      </div>

      {monitors.length === 0 ? (
        <div className="glass p-8 text-center border-dashed">
          <p className="text-slate-500 mb-3">{t('monitors.notFound')}</p>
          <button onClick={() => navigate('/monitors/create')} className="btn-gradient px-4 py-2 text-sm inline-flex items-center gap-1.5"><PlusIcon />{t('monitors.addOne')}</button>
        </div>
      ) : view === 'list' ? (
        <div className="glass overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('monitors.table.name')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('monitors.table.url')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('monitors.table.status')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('monitors.table.responseTime')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('monitors.table.uptime')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('monitors.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map(m => (
                <tr key={m.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{m.name}</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 break-all">{m.url}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[m.status] || statusColors.pending}`}>
                      <StatusIcon status={m.status} />{statusLabels[m.status] || m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{m.response_time}ms</td>
                  <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{Math.min(m.uptime || 0, 100).toFixed(2)}%</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => navigate(`/monitors/${m.id}`)} className="p-1.5 rounded-md text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 transition-colors" title={t('monitors.viewDetails')}><InfoCircledIcon /></button>
                      <button onClick={() => navigate(`/monitors/edit/${m.id}`)} className="p-1.5 rounded-md text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 transition-colors" title={t('monitors.edit')}><Pencil1Icon /></button>
                      <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-md text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors" title={t('monitors.delete')}><TrashIcon /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monitors.map(m => (
            <div key={m.id} className="relative group">
              <MonitorCard monitor={m} />
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => navigate(`/monitors/${m.id}`)} className="p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 hover:text-blue-500 transition-colors" title={t('monitors.viewDetails')}><InfoCircledIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => navigate(`/monitors/edit/${m.id}`)} className="p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 hover:text-amber-500 transition-colors" title={t('monitors.edit')}><Pencil1Icon className="w-3.5 h-3.5" /></button>
                <button onClick={() => handleDelete(m.id)} className="p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 hover:text-red-500 transition-colors" title={t('monitors.delete')}><TrashIcon className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonitorsList;
