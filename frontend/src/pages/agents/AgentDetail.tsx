import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, Pencil1Icon, Cross2Icon, ReloadIcon, ClockIcon, DesktopIcon, GlobeIcon, LaptopIcon, CrumpledPaperIcon, Component1Icon, ActivityLogIcon, TimerIcon, CodeIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getAgent, Agent, deleteAgent } from '../../api/agents';
import ClientResourceSection from '../../components/ClientResourceSection';
import { useTranslation } from 'react-i18next';

interface AgentWithResources extends Agent {
  uptime: number; uptimeStr: string; connectStr?: string; cpuUsage?: number; memoryUsage?: number; diskUsage?: number; networkRx?: number; networkTx?: number;
}

const countryToFlag = (code: string) => {
  if (!code || code.length !== 2) return '';
  return `https://flagcdn.com/24x18/${code.toLowerCase()}.png`;
};

const AgentDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentWithResources | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const { t } = useTranslation();

  const fetchData = async () => {
    if (initialLoad) setLoading(true);
    setError(null);
    try {
      const res = await getAgent(Number(id));
      if (!res.success || !res.agent) throw new Error(res.message || t('common.error.fetch'));
      const a = res.agent;
      const mem = a.memory_total && a.memory_used ? Math.round((a.memory_used / a.memory_total) * 100) : 0;
      const disk = a.disk_total && a.disk_used ? Math.round((a.disk_used / a.disk_total) * 100) : 0;
      const uptime = a.boot_time ? Math.max(0, Date.now() - new Date(a.boot_time).getTime()) : 0;
      const uptimeStr = uptime ? `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m` : '';
      const connectMs = a.updated_at ? Math.max(0, Date.now() - new Date(a.updated_at).getTime()) : 0;
      const connectStr = connectMs < 60000 ? '刚刚' : `${Math.floor(connectMs / 3600000)}h ${Math.floor((connectMs % 3600000) / 60000)}m 前`;
      setAgent({ ...a, uptime, uptimeStr, connectStr, cpuUsage: a.cpu_usage || 0, memoryUsage: mem, diskUsage: disk, networkRx: a.network_rx || 0, networkTx: a.network_tx || 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error.fetch'));
    } finally {
      if (initialLoad) { setLoading(false); setInitialLoad(false); }
    }
  };

  useEffect(() => {
    if (id && !isNaN(Number(id))) { fetchData(); const i = setInterval(fetchData, 60000); return () => clearInterval(i); }
    else { setError(t('agents.notFoundId', { id })); setLoading(false); }
  }, [id]);

  const handleDelete = async () => {
    if (!confirm(t('agent.deleteConfirm'))) return;
    try {
      setDeleteLoading(true);
      setToastMsg(t('agent.deleting')); setToastType('success'); setToastOpen(true);
      const res = await deleteAgent(Number(id));
      if (res.success) {
        setToastMsg(t('agent.deleteSuccess')); setToastType('success'); setToastOpen(true);
        setTimeout(() => navigate('/agents'), 3000);
      } else {
        setToastMsg(res.message || t('agent.deleteError')); setToastType('error'); setToastOpen(true);
      }
    } catch { setToastMsg(t('agent.deleteError')); setToastType('error'); setToastOpen(true); }
    finally { setDeleteLoading(false); }
  };

  const formatDateTime = (s: string) => s ? new Date(s).toLocaleString() : t('common.notFound');

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('agents.loadingDetail')}</span></div>;
  if (error || !agent) return <div className="flex justify-center items-center min-h-[50vh]"><div className="glass p-6 text-center"><h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('common.loadingError')}</h2><p className="text-slate-500 mb-4">{error || t('agents.notFound')}</p><button onClick={() => navigate('/agents')} className="btn-gradient px-4 py-2 text-sm">{t('common.backToList')}</button></div></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.details')}</h1>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            agent.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${agent.status === 'active' ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`} />
            {agent.status === 'active' ? t('agent.status.online') : t('agent.status.offline')}
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchData} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />{t('common.refresh')}</button>
          <button onClick={() => navigate(`/agents/edit/${id}`)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-amber-600 hover:bg-amber-500/10 transition-colors"><Pencil1Icon />{t('agent.edit')}</button>
          <button onClick={handleDelete} disabled={deleteLoading} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"><Cross2Icon />{deleteLoading ? t('common.deleting') : t('agent.delete')}</button>
        </div>
      </div>

      {/* Info Card */}
      <div className="glass p-5 mb-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg font-bold">{agent.name.charAt(0)}</div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{agent.name}</h2>
            <p className="text-sm text-slate-500">
              {agent.hostname}{agent.hostname && agent.ip_address ? ` (${agent.ip_address})` : ''}
              {agent.country && <> · <img src={countryToFlag(agent.country)} alt={agent.country} className='inline-block w-4 h-3 align-middle' /> {agent.country}</>}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2"><ClockIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.lastUpdated')}:</span><span>{formatDateTime(agent.updated_at)}</span></div>
          {agent.status === 'active' && agent.connectStr && <div className="flex items-center gap-2"><ActivityLogIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.connectDuration')}:</span><span>{agent.connectStr}</span></div>}
        </div>
      </div>

      {/* System Info & Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('agent.systemInfo')}</h3>
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2"><DesktopIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.os')}:</span><span>{agent.os || t('common.notFound')}</span></div>
            <div className="flex items-center gap-2"><LaptopIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.version')}:</span><span>{agent.version || t('common.notFound')}</span></div>
            <div className="flex items-center gap-2"><GlobeIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.hostname')}:</span><span>{agent.hostname || t('common.notFound')}</span></div>
            <div className="flex items-center gap-2"><GlobeIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.ipAddress')}:</span><span>{agent.ip_address || t('common.notFound')}</span></div>
            {agent.cpu_arch && <div className="flex items-center gap-2"><Component1Icon className="text-slate-400" /><span className="text-slate-500">{t('agent.cpuArch')}:</span><span>{agent.cpu_arch}</span></div>}
            {agent.cpu_model_name && <div className="flex items-center gap-2"><CrumpledPaperIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.cpuModel')}:</span><span className="truncate max-w-[200px]">{agent.cpu_model_name}</span></div>}
            {agent.cpu_cores != null && <div className="flex items-center gap-2"><Component1Icon className="text-slate-400" /><span className="text-slate-500">{t('agent.cpuCores')}:</span><span>{agent.cpu_cores}</span></div>}
            {(agent.load1 != null || agent.load5 != null || agent.load15 != null) && <div className="flex items-center gap-2"><ActivityLogIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.loadAverage')}:</span><span>{[agent.load1, agent.load5, agent.load15].map(v => v?.toFixed(2) ?? '-').join(' / ')}</span></div>}
            {agent.boot_time && <div className="flex items-center gap-2"><TimerIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.bootTime')}:</span><span>{formatDateTime(agent.boot_time)}</span></div>}
            {agent.uptimeStr && <div className="flex items-center gap-2"><TimerIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.uptime')}:</span><span>{agent.uptimeStr}</span></div>}
            {agent.agent_version && <div className="flex items-center gap-2"><CodeIcon className="text-slate-400" /><span className="text-slate-500">{t('agent.agentVersion')}:</span><span>{agent.agent_version}</span></div>}
          </div>
        </div>
        <div className="glass p-5">
          <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{t('agent.systemResources')}</h3>
          <ClientResourceSection cpuUsage={agent.cpuUsage || 0} memoryUsage={agent.memoryUsage || 0} diskUsage={agent.diskUsage || 0} networkRx={agent.networkRx || 0} networkTx={agent.networkTx || 0} />
          {(agent.network_rx_total != null || agent.network_tx_total != null) && (
            <div className='mt-3 pt-3 border-t border-slate-200 dark:border-white/5 text-xs text-slate-500 flex gap-4'>
              {agent.network_rx_total != null && <span>{t('agent.networkTotalRx')}: {(agent.network_rx_total / 1073741824).toFixed(2)} GiB</span>}
              {agent.network_tx_total != null && <span>{t('agent.networkTotalTx')}: {(agent.network_tx_total / 1073741824).toFixed(2)} GiB</span>}
            </div>
          )}
        </div>
      </div>

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

export default AgentDetail;
