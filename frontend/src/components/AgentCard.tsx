import { Agent } from '../api/agents';
import ResourceBar from './ResourceBar';
import { useTranslation } from 'react-i18next';

interface AgentCardProps {
  agent: Agent;
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
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

const flagUrl = (c?: string) => c && c.length === 2 ? `https://flagcdn.com/48x36/${c.toLowerCase()}.png` : '';

const AgentCard = ({ agent }: AgentCardProps) => {
  const { t } = useTranslation();

  let cpu = 0, memPct = 0, diskPct = 0;
  try {
    if (agent.cpu_usage != null) cpu = Math.round(agent.cpu_usage);
    if (agent.memory_total && agent.memory_used) memPct = Math.round((agent.memory_used / agent.memory_total) * 100);
    if (agent.disk_total && agent.disk_used) diskPct = Math.round((agent.disk_used / agent.disk_total) * 100);
  } catch (e) { /* ignore */ }

  const memUsedStr = formatBytes(agent.memory_used || 0);
  const memTotalStr = formatBytes(agent.memory_total || 0);
  const diskUsedStr = formatBytes(agent.disk_used || 0);
  const diskTotalStr = formatBytes(agent.disk_total || 0);
  const rxTotalStr = formatBytes(agent.network_rx_total || 0);
  const txTotalStr = formatBytes(agent.network_tx_total || 0);

  const uptime = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;
  const uptimeStr = formatDuration(uptime);

  const agentStatus = agent.status || 'inactive';
  const config: Record<string, { bg: string; text: string; dot: string; bar: string }> = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse-dot', bar: 'from-emerald-500 to-cyan-400' },
    connecting: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500', bar: 'from-amber-500 to-yellow-400' },
    inactive: { bg: 'bg-slate-500/10', text: 'text-slate-500', dot: 'bg-slate-400', bar: 'from-slate-500 to-slate-400' },
  };
  const cfg = config[agentStatus] || config.inactive;
  const statusLabel: Record<string, string> = {
    active: t('agent.status.online'),
    inactive: t('agent.status.offline'),
    connecting: t('agent.status.connecting'),
  };

  return (
    <div className="glass glass-hover relative overflow-hidden group">
      <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${cfg.bar} rounded-r-sm`} />
      <div className="p-4 pl-5">
        {/* Header: flag + name + status */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            {flagUrl(agent.country) ? (
              <img src={flagUrl(agent.country)} alt={agent.country || ''} className="w-5 h-4 rounded-sm shadow-sm" />
            ) : (
              <span className={`${agentStatus === 'active' ? 'text-emerald-500' : 'text-slate-400'}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" strokeWidth="2"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" strokeWidth="2"/></svg>
              </span>
            )}
            <span className="font-semibold text-sm text-slate-900 dark:text-white">{agent.name}</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {statusLabel[agentStatus] || agentStatus}
          </span>
        </div>

        {/* OS line */}
        <div className="text-xs text-slate-500 mb-3 truncate">
          {agent.os && <span>{agent.os}</span>}
          {agent.cpu_arch && <span> / {agent.cpu_arch}</span>}
          {agent.hostname && <span> · {agent.hostname}</span>}
        </div>

        {/* Metrics */}
        <div className="flex flex-col gap-1.5 text-xs">
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-slate-500">CPU</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{cpu}%</span>
            </div>
            <ResourceBar value={cpu} color="green" height={4} />
          </div>
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-slate-500">{t('agent.memory')}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{memPct}% <span className="text-slate-400 font-normal">({memUsedStr} / {memTotalStr})</span></span>
            </div>
            <ResourceBar value={memPct} color="blue" height={4} />
          </div>
          <div>
            <div className="flex justify-between mb-0.5">
              <span className="text-slate-500">{t('agent.disk')}</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{diskPct}% <span className="text-slate-400 font-normal">({diskUsedStr} / {diskTotalStr})</span></span>
            </div>
            <ResourceBar value={diskPct} color="amber" height={4} />
          </div>

          {/* Traffic totals */}
          {(txTotalStr !== '0 B' || rxTotalStr !== '0 B') && (
            <div className="flex justify-between items-center pt-1">
              <span className="text-slate-500">{t('agent.totalTraffic')}</span>
              <span className="text-slate-600 dark:text-slate-400">
                {txTotalStr !== '0 B' && <span>↑ {txTotalStr} </span>}
                {rxTotalStr !== '0 B' && <span>↓ {rxTotalStr}</span>}
              </span>
            </div>
          )}

          {/* Uptime */}
          {uptimeStr && (
            <div className="flex justify-between items-center">
              <span className="text-slate-500">{t('agent.uptime')}</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium">{uptimeStr}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
