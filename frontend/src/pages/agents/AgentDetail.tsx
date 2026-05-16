import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, Pencil1Icon, Cross2Icon, ReloadIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getAgent, Agent, deleteAgent } from '../../api/agents';
import ResourceBar from '../../components/ResourceBar';
import { useTranslation } from 'react-i18next';

interface AgentWithResources extends Agent {
  uptime: number; uptimeStr: string; connectStr?: string;
  cpuUsage?: number; memoryUsage?: number; diskUsage?: number;
  networkRx?: number; networkTx?: number;
  memUsedStr?: string; memTotalStr?: string; diskUsedStr?: string; diskTotalStr?: string;
  rxTotalStr?: string; txTotalStr?: string;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatDuration = (ms: number): string => {
  if (ms <= 0) return '';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d > 0 ? d + 'd ' : ''}${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
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
      const uptimeStr = formatDuration(uptime);
      const connectMs = a.updated_at ? Math.max(0, Date.now() - new Date(a.updated_at).getTime()) : 0;
      const connectStr = connectMs < 60000 ? t('agent.justNow') : formatDuration(connectMs) + t('agent.ago');
      setAgent({
        ...a, uptime, uptimeStr, connectStr,
        cpuUsage: a.cpu_usage || 0, memoryUsage: mem, diskUsage: disk,
        networkRx: a.network_rx || 0, networkTx: a.network_tx || 0,
        memUsedStr: formatBytes(a.memory_used || 0),
        memTotalStr: formatBytes(a.memory_total || 0),
        diskUsedStr: formatBytes(a.disk_used || 0),
        diskTotalStr: formatBytes(a.disk_total || 0),
        rxTotalStr: formatBytes(a.network_rx_total || 0),
        txTotalStr: formatBytes(a.network_tx_total || 0),
      });
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
  const flagUrl = (c?: string) => c && c.length === 2 ? `https://flagcdn.com/48x36/${c.toLowerCase()}.png` : '';

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('agents.loadingDetail')}</span></div>;
  if (error || !agent) return <div className="flex justify-center items-center min-h-[50vh]"><div className="glass p-6 text-center"><h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('common.loadingError')}</h2><p className="text-slate-500 mb-4">{error || t('agents.notFound')}</p><button onClick={() => navigate('/agents')} className="btn-gradient px-4 py-2 text-sm">{t('common.backToList')}</button></div></div>;

  const StatRow = ({ label, value, sub, barValue, barColor }: { label: string; value: string; sub?: string; barValue?: number; barColor?: string }) => (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</span>
      </div>
      {sub && <span className="text-xs text-slate-400">{sub}</span>}
      {barValue != null && barColor && <ResourceBar value={barValue} color={barColor} height={4} />}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 animate-slide-up">
      {/* Header */}
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

      {/* Main Card */}
      <div className="glass p-6 mb-6">
        {/* Top: Name + Flag + Hostname */}
        <div className="flex items-center gap-3 mb-5">
          {flagUrl(agent.country) ? (
            <img src={flagUrl(agent.country)} alt={agent.country || ''} className="w-9 h-7 rounded shadow-sm border border-white/10" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-base font-bold">{agent.name.charAt(0)}</div>
          )}
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{agent.name}</h2>
            <p className="text-xs text-slate-500">{agent.hostname || '-'}{agent.ip_address ? ` · ${agent.ip_address}` : ''}</p>
          </div>
          <div className="ml-auto text-right text-xs text-slate-400 space-y-0.5">
            {agent.status === 'active' && agent.connectStr && <div><span className="text-slate-500">{t('agent.connectDuration')}:</span> {agent.connectStr}</div>}
            <div><span className="text-slate-500">{t('agent.lastUpdated')}:</span> {formatDateTime(agent.updated_at)}</div>
          </div>
        </div>

        {/* OS info */}
        <div className="mb-5 text-sm text-slate-600 dark:text-slate-400">
          {agent.os && <span className="font-medium">{agent.os}</span>}
          {agent.version && <span> {agent.version.replace(agent.os + ' ', '')}</span>}
          {agent.cpu_arch && <span> / {agent.cpu_arch}</span>}
        </div>

        {/* Resource Grid */}
        <div className="flex flex-col gap-3">
          <StatRow label="CPU" value={`${(agent.cpuUsage || 0).toFixed(1)}%`} barValue={agent.cpuUsage || 0} barColor="green" />
          <StatRow label={t('agent.memory') || 'Memory'} value={`${agent.memoryUsage || 0}%`} sub={`${agent.memUsedStr} / ${agent.memTotalStr}`} barValue={agent.memoryUsage || 0} barColor="blue" />
          <StatRow label={t('agent.disk') || 'Disk'} value={`${agent.diskUsage || 0}%`} sub={`${agent.diskUsedStr} / ${agent.diskTotalStr}`} barValue={agent.diskUsage || 0} barColor="amber" />

          {/* Total Traffic */}
          {(agent.rxTotalStr || agent.txTotalStr) && (
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-slate-500">{t('agent.totalTraffic')}</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {agent.txTotalStr && <span>↑ {agent.txTotalStr}</span>}
                {agent.rxTotalStr && <span> ↓ {agent.rxTotalStr}</span>}
              </span>
            </div>
          )}

          {/* Network Rates */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">{t('agent.network')}</span>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              ↑ {((agent.networkTx || 0) >= 1024 ? ((agent.networkTx || 0) / 1024).toFixed(2) + ' MB/s' : (agent.networkTx || 0).toFixed(2) + ' KB/s')}
              &nbsp;↓ {((agent.networkRx || 0) >= 1024 ? ((agent.networkRx || 0) / 1024).toFixed(2) + ' MB/s' : (agent.networkRx || 0).toFixed(2) + ' KB/s')}
            </span>
          </div>

          {/* Uptime */}
          {agent.uptimeStr && (
            <div className="flex justify-between items-center pt-1">
              <span className="text-xs text-slate-500">{t('agent.uptime')}</span>
              <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{agent.uptimeStr}</span>
            </div>
          )}
        </div>

        {/* Extra system info */}
        {(agent.cpu_model_name || agent.cpu_cores != null || agent.load1 != null || agent.agent_version) && (
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/5 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-400">
            {agent.cpu_model_name && <span>{agent.cpu_model_name}</span>}
            {agent.cpu_cores != null && <span>{agent.cpu_cores} cores</span>}
            {(agent.load1 != null || agent.load5 != null || agent.load15 != null) && <span>Load: {[agent.load1, agent.load5, agent.load15].map(v => v?.toFixed(2) ?? '-').join(' / ')}</span>}
            {agent.agent_version && <span>Agent v{agent.agent_version}</span>}
          </div>
        )}
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
