import { Agent } from '../api/agents';
import ResourceBar from './ResourceBar';
import { useTranslation } from 'react-i18next';
import {
  CrumpledPaperIcon, MixerHorizontalIcon, StackIcon, TimerIcon, CalendarIcon,
  DownloadIcon, UploadIcon, ArrowDownIcon, ArrowUpIcon, ActivityLogIcon,
} from '@radix-ui/react-icons';

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
  const totalTraffic = (agent.network_rx_total || 0) + (agent.network_tx_total || 0);
  const totalTrafficStr = formatBytes(totalTraffic);
  const trafficLimit = agent.traffic_limit || 0;
  const trafficLimitStr = trafficLimit > 0 ? formatBytes(trafficLimit) : '';
  const trafficPct = trafficLimit > 0 ? Math.round((totalTraffic / trafficLimit) * 1000) / 10 : 0;
  const expiryDays = agent.expiry_time ? Math.ceil((new Date(agent.expiry_time).getTime() - Date.now()) / 86400000) : -1;

  const rxTotalStr = formatBytes(agent.network_rx_total || 0);
  const txTotalStr = formatBytes(agent.network_tx_total || 0);
  // Agent reports mem/disk in KB, convert to bytes for formatBytes
  const memUsedStr = formatBytes((agent.memory_used || 0) * 1024);
  const memTotalStr = formatBytes((agent.memory_total || 0) * 1024);
  const diskUsedStr = formatBytes((agent.disk_used || 0) * 1024);
  const diskTotalStr = formatBytes((agent.disk_total || 0) * 1024);
  const osBadgeColor = (agent.os || '').toLowerCase().includes('debian') ? 'text-rose-500 bg-rose-500/10' :
                       (agent.os || '').toLowerCase().includes('ubuntu') ? 'text-orange-500 bg-orange-500/10' :
                       (agent.os || '').toLowerCase().includes('alpine') ? 'text-sky-500 bg-sky-500/10' :
                       (agent.os || '').toLowerCase().includes('arch') ? 'text-cyan-500 bg-cyan-500/10' :
                       'text-slate-500 bg-slate-500/10';

  const IconWrap = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <span className={`w-4 h-4 flex items-center justify-center rounded ${color}`}>{children}</span>
  );

  const hasAny = (v: any) => v != null;
  const MetricItem = ({ icon, iconColor, label, value, sub, barValue, barColor }: { icon: React.ReactNode; iconColor: string; label: string; value: string; sub?: string; barValue?: number; barColor?: string }) => (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <IconWrap color={iconColor}>{icon}</IconWrap>{label}
        </span>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{value || ''}</span>
      </div>
      {sub ? <span className="text-[10px] text-slate-400 leading-none">{sub}</span> : <div className="h-[2px]" />}
      {hasAny(barValue) && barColor ? (
        <ResourceBar value={Math.min(barValue!, 100)} color={barColor} height={5} />
      ) : sub ? <div className="h-[5px]" /> : null}
    </div>
  );

  return (
    <div className="glass rounded-xl p-4 hover:shadow-lg transition-shadow duration-200">
      {/* Header: flag + name + OS + status */}
      <div className="flex items-center gap-2 mb-3">
        {flagUrl(agent.country) ? (
          <img src={flagUrl(agent.country)} alt={agent.country || ''} className="w-5 h-3.5 rounded-sm shadow-sm flex-shrink-0" />
        ) : (
          <span className="w-5 h-3.5 rounded-sm bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
        )}
        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{agent.name}</span>
        {agent.os && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 hidden sm:inline ${osBadgeColor}`}>
            {agent.os.split(' ')[0]} {agent.version?.split(' ')[0] || ''}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`} />
          <span className={`text-[11px] font-medium ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
            {isOnline ? t('agent.status.online') : t('agent.status.offline')}
          </span>
        </span>
      </div>

      {/* Two-column metrics - paired rows for alignment */}
      <div className="flex flex-col gap-1.5">
        {[
          [<MetricItem key="cpu" icon={<MixerHorizontalIcon />} iconColor="bg-emerald-500/10 text-emerald-600" label="CPU" value={`${cpu.toFixed(1)}%`} barValue={cpu} barColor="green" />,
           <MetricItem key="mem" icon={<StackIcon />} iconColor="bg-blue-500/10 text-blue-600" label={t('agent.memory')} value={`${memPct.toFixed(1)}%`} sub={`${memUsedStr} / ${memTotalStr}`} barValue={memPct} barColor="blue" />],
          [<MetricItem key="disk" icon={<CrumpledPaperIcon />} iconColor="bg-amber-500/10 text-amber-600" label={t('agent.disk')} value={`${diskPct.toFixed(1)}%`} sub={`${diskUsedStr} / ${diskTotalStr}`} barValue={diskPct} barColor="amber" />,
           <MetricItem key="traf" icon={<ActivityLogIcon />} iconColor="bg-violet-500/10 text-violet-600" label={t('agent.traffic')} value={trafficLimit > 0 ? `${totalTrafficStr} / ${trafficLimitStr}` : '--'} barValue={trafficLimit > 0 ? trafficPct : 0} barColor="purple" />],
          [<MetricItem key="dl" icon={<ArrowDownIcon />} iconColor="bg-cyan-500/10 text-cyan-600" label={t('clientResource.download')} value={netRx >= 1024 ? `${(netRx / 1024).toFixed(1)} MB/s` : `${netRx.toFixed(1)} KB/s`} />,
           <MetricItem key="ul" icon={<ArrowUpIcon />} iconColor="bg-indigo-500/10 text-indigo-600" label={t('clientResource.upload')} value={netTx >= 1024 ? `${(netTx / 1024).toFixed(1)} MB/s` : `${netTx.toFixed(1)} KB/s`} />],
          [<MetricItem key="tdl" icon={<DownloadIcon />} iconColor="bg-slate-500/10 text-slate-500" label={t('agent.networkTotalRx')} value={rxTotalStr} />,
           <MetricItem key="tul" icon={<UploadIcon />} iconColor="bg-slate-500/10 text-slate-500" label={t('agent.networkTotalTx')} value={txTotalStr} />],
        ].map((row, i) => (
          <div key={i} className="flex gap-4">
            <div className="flex-1">{row[0]}</div>
            <div className="flex-1">{row[1]}</div>
          </div>
        ))}
      </div>

      {/* Bottom divider + expiry + uptime */}
      <div className="my-2.5 border-t border-slate-200 dark:border-white/[0.06]" />
      <div className="flex gap-4">
        <div className="flex-1">
          <MetricItem
            icon={<CalendarIcon />} iconColor="bg-slate-500/10 text-slate-500"
            label={t('agent.expiry')}
            value={expiryDays >= 0 ? `${expiryDays}${t('agent.days')}` : '--'}
          />
        </div>
        <div className="flex-1">
          <MetricItem
            icon={<TimerIcon />} iconColor="bg-slate-500/10 text-slate-500"
            label={t('agent.uptime')}
            value={uptimeStr || '--'}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
