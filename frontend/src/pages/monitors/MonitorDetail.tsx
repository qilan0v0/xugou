import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircledIcon, CrossCircledIcon, ArrowLeftIcon, Pencil1Icon, TrashIcon, ReloadIcon, QuestionMarkCircledIcon, Cross2Icon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getMonitor, deleteMonitor, checkMonitor, Monitor } from '../../api/monitors';
import { useTranslation } from 'react-i18next';

const MonitorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [monitor, setMonitor] = useState<Monitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const { t } = useTranslation();

  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const res = await getMonitor(parseInt(id));
      if (res.success && res.monitor) setMonitor(res.monitor);
      else setError(res.message || t('common.error.fetch'));
    } catch { setError(t('common.error.fetch')); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 60000); return () => clearInterval(i); }, [id]);

  const handleCheck = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await checkMonitor(parseInt(id));
      if (res.success) { await fetchData(); setToastMsg(t('monitor.checkCompleted')); setToastType('success'); setToastOpen(true); }
      else { setToastMsg(res.message || t('monitor.checkFailed')); setToastType('error'); setToastOpen(true); }
    } catch { setToastMsg(t('monitor.checkFailed')); setToastType('error'); setToastOpen(true); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm(t('monitors.delete.confirm'))) return;
    try {
      const res = await deleteMonitor(parseInt(id));
      if (res.success) { setToastMsg(t('monitor.deleteSuccess')); setToastType('success'); setToastOpen(true); setTimeout(() => navigate('/monitors'), 1500); }
      else { setToastMsg(res.message || t('monitor.deleteFailed')); setToastType('error'); setToastOpen(true); }
    } catch { setToastMsg(t('monitor.deleteFailed')); setToastType('error'); setToastOpen(true); }
  };

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) { case 'up': return <CheckCircledIcon className="text-emerald-500" />; case 'down': return <CrossCircledIcon className="text-red-500" />; default: return <QuestionMarkCircledIcon className="text-slate-400" />; }
  };

  if (loading && !monitor) return <div className="flex justify-center items-center min-h-[50vh]"><div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm text-slate-500">{t('common.loading')}</span></div></div>;
  if (error || !monitor) return <div className="max-w-6xl mx-auto px-4 py-8"><div className="glass border-l-4 border-red-500 p-4 mb-4"><span className="text-red-500">{error || t('monitor.notExist')}</span></div><button onClick={() => navigate('/monitors')} className="btn-gradient px-4 py-2 text-sm">{t('monitor.returnToList')}</button></div>;

  const tabs = [
    { key: 'overview', label: t('monitor.tabs.overview') },
    { key: 'history', label: t('monitor.tabs.history') },
    { key: 'settings', label: t('monitor.tabs.settings') },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/monitors')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{monitor.name}</h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            monitor.status === 'up' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : monitor.status === 'down' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <StatusIcon status={monitor.status} />
            {monitor.status === 'up' ? t('monitor.status.normal') : monitor.status === 'down' ? t('monitor.status.failure') : t('monitor.status.pending')}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={handleCheck} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />{t('monitor.manualCheck')}</button>
          <button onClick={() => navigate(`/monitors/edit/${id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-500/10 transition-colors"><Pencil1Icon />{t('monitor.edit')}</button>
          <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors"><TrashIcon />{t('monitor.delete')}</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/[0.06]">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors relative -mb-px ${
              tab === t.key ? 'text-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            {t.label}
            {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('monitor.status.info')}</h3>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-500">{t('common.status')}:</span>
              <span className="flex items-center gap-1"><StatusIcon status={monitor.status} />{t(`monitor.status.${monitor.status === 'up' ? 'normal' : monitor.status === 'down' ? 'failure' : 'pending'}`)}</span>
              <span className="text-slate-500">{t('monitor.uptime')}:</span>
              <span>{Math.min(monitor.uptime || 0, 100).toFixed(2)}%</span>
              <span className="text-slate-500">{t('monitor.responseTime')}:</span>
              <span>{monitor.response_time}ms</span>
              <span className="text-slate-500">{t('monitor.lastCheck')}:</span>
              <span>{monitor.last_checked || t('monitor.notChecked')}</span>
            </div>
          </div>
          <div className="glass p-5">
            <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('monitor.basicInfo')}</h3>
            <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
              <span className="text-slate-500">URL:</span><span className="break-all">{monitor.url}</span>
              <span className="text-slate-500">{t('monitor.method')}:</span><span>{monitor.method}</span>
              <span className="text-slate-500">{t('monitor.interval')}:</span><span>{monitor.interval} {t('common.seconds')}</span>
              <span className="text-slate-500">{t('monitor.timeout')}:</span><span>{monitor.timeout} {t('common.seconds')}</span>
              <span className="text-slate-500">{t('monitor.expectedStatus')}:</span><span>{monitor.expected_status}</span>
              <span className="text-slate-500">{t('monitor.createTime')}:</span><span>{new Date(monitor.created_at).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="glass p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('monitor.checkHistory')}</h3>
          {monitor.checks && monitor.checks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-white/[0.06]">{['time','status','responseTime','statusCode','error'].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">{t(`monitor.history.${h}`)}</th>)}</tr></thead>
                <tbody>
                  {monitor.checks.map((c: any) => (
                    <tr key={c.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400">{new Date(c.checked_at).toLocaleString()}</td>
                      <td className="px-3 py-2"><span className="flex items-center gap-1 text-sm"><StatusIcon status={c.status} />{t(`monitor.status.${c.status === 'up' ? 'normal' : 'failure'}`)}</span></td>
                      <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400">{c.response_time}ms</td>
                      <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-400">{c.status_code}</td>
                      <td className="px-3 py-2 text-sm text-slate-500">{c.error || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-slate-500">{t('monitor.noCheckHistory')}</p>}
        </div>
      )}

      {tab === 'settings' && (
        <div className="glass p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('monitor.configDetails')}</h3>
          <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2 text-sm">
            {[
              [t('common.name'), monitor.name],
              ['URL', monitor.url],
              [t('monitor.method'), monitor.method],
              [t('monitor.interval'), `${monitor.interval} ${t('common.seconds')}`],
              [t('monitor.timeout'), `${monitor.timeout} ${t('common.seconds')}`],
              [t('monitor.expectedStatus'), String(monitor.expected_status)],
              [t('common.status'), monitor.active ? t('monitor.active') : t('monitor.inactive')],
            ].map(([k, v], i) => (
              <><span key={`k${i}`} className="text-slate-500">{k}:</span><span key={`v${i}`}>{v}</span></>
            ))}
          </div>
        </div>
      )}

      <Toast.Provider>
        <Toast.Root open={toastOpen} onOpenChange={setToastOpen} duration={3000}
          className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-slide-up ${toastType === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <Toast.Title className="font-semibold">{toastType === 'success' ? t('common.success') : t('common.error')}</Toast.Title>
          <Toast.Description className="text-white/80 text-xs mt-0.5">{toastMsg}</Toast.Description>
          <Toast.Close className="absolute top-2 right-2 text-white/70 hover:text-white"><Cross2Icon /></Toast.Close>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>
    </div>
  );
};

export default MonitorDetail;
