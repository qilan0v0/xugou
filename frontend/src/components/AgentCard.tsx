import { Agent } from '../api/agents';
import ResourceBar from './ResourceBar';
import { useTranslation } from 'react-i18next';

interface AgentCardProps {
  agent: Agent;
}

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0; let v = bytes;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

const formatDuration = (ms: number): string => {
  if (ms <= 0) return '';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}天 ${h}小时 ${m}分`;
  if (h > 0) return `${h}小时 ${m}分`;
  return `${m}分`;
};

const flagUrl = (c?: string) => c && c.length === 2 ? `https://flagcdn.com/48x36/${c.toLowerCase()}.png` : '';

const AgentCard = ({ agent }: AgentCardProps) => {
  const { t } = useTranslation();

  let cpu = 0, memPct = 0, diskPct = 0;
  try {
    if (agent.cpu_usage != null) cpu = Math.round(agent.cpu_usage * 10) / 10;
    if (agent.memory_total && agent.memory_used) memPct = Math.round((agent.memory_used / agent.memory_total) * 1000) / 10;
    if (agent.disk_total && agent.disk_used) diskPct = Math.round((agent.disk_used / agent.disk_total) * 1000) / 10;
  } catch (e) { /* ignore */ }

  const uptime = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;
  const uptimeStr = formatDuration(uptime);
  const isOnline = agent.status === 'active';
  const netRx = agent.network_rx || 0;
  const netTx = agent.network_tx || 0;
  const rxTotalStr = formatBytes(agent.network_rx_total || 0);
  const txTotalStr = formatBytes(agent.network_tx_total || 0);
  const memUsedStr = formatBytes(agent.memory_used || 0);
  const memTotalStr = formatBytes(agent.memory_total || 0);
  const diskUsedStr = formatBytes(agent.disk_used || 0);
  const diskTotalStr = formatBytes(agent.disk_total || 0);
  const osIcon = (agent.os || '').toLowerCase().includes('debian') ? '🦊' :
                 (agent.os || '').toLowerCase().includes('ubuntu') ? '🔴' :
                 (agent.os || '').toLowerCase().includes('centos') ? '🟠' :
                 (agent.os || '').toLowerCase().includes('alpine') ? '🏔️' :
                 (agent.os || '').toLowerCase().includes('arch') ? '🔵' : '💻';

  const MetricItem = ({ icon, label, value, sub, barValue, barColor }: { icon: string; label: string; value: string; sub?: string; barValue?: number; barColor?: string }) => (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <span className="text-xs">{icon}</span>{label}
        </span>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{value}</span>
      </div>
      {sub && <span className="text-[10px] text-slate-400 leading-none -mt-0.5">{sub}</span>}
      {barValue != null && barColor && <ResourceBar value={Math.min(barValue, 100)} color={barColor} height={3} />}
    </div>
  );

  return (
    <div className="glass rounded-xl p-4 hover:shadow-lg transition-shadow duration-200">
      {/* Header: flag + name + OS + status */}
      <div className="flex items-center gap-2 mb-3">
        {flagUrl(agent.country) ? (
          <img src={flagUrl(agent.country)} alt={agent.country || ''} className="w-5 h-4 rounded-sm shadow-sm flex-shrink-0" />
        ) : (
          <span className="text-xs flex-shrink-0">🏳️</span>
        )}
        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{agent.name}</span>
        <span className="text-xs flex-shrink-0">{osIcon}</span>
        <span className="text-[10px] text-slate-400 truncate hidden sm:inline">{agent.os || ''} {agent.version?.split(' ')[0] || ''}</span>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`} />
          <span className={`text-[11px] font-medium ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
            {isOnline ? t('agent.status.online') : t('agent.status.offline')}
          </span>
        </span>
      </div>

      {/* Two-column metrics grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <MetricItem icon="📊" label="CPU" value={`${cpu.toFixed(1)}%`} barValue={cpu} barColor="green" />
        <MetricItem icon="🧠" label={t('agent.memory')} value={`${memPct.toFixed(1)}%`} sub={`${memUsedStr} / ${memTotalStr}`} barValue={memPct} barColor="blue" />
        <MetricItem icon="💾" label={t('agent.disk')} value={`${diskPct.toFixed(1)}%`} sub={`${diskUsedStr} / ${diskTotalStr}`} barValue={diskPct} barColor="amber" />
        <MetricItem icon="📥" label={t('agent.networkTotalRx')} value="" sub={rxTotalStr} />
        <MetricItem icon="⬇" label={t('clientResource.download')} value={netRx >= 1024 ? `${(netRx / 1024).toFixed(1)} MB/s` : `${netRx.toFixed(1)} KB/s`} barValue={Math.min(netRx / 51.2, 100)} barColor="cyan" />
        <MetricItem icon="⬆" label={t('clientResource.upload')} value={netTx >= 1024 ? `${(netTx / 1024).toFixed(1)} MB/s` : `${netTx.toFixed(1)} KB/s`} barValue={Math.min(netTx / 51.2, 100)} barColor="indigo" />
        <MetricItem icon="📤" label={t('agent.networkTotalTx')} value="" sub={txTotalStr} />
      </div>

      {/* Bottom divider + uptime */}
      {uptimeStr && (
        <>
          <div className="my-2.5 border-t border-slate-200 dark:border-white/[0.06]" />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>{t('agent.uptime')}</span>
            <span className="font-medium text-slate-600 dark:text-slate-400">{uptimeStr}</span>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentCard;
