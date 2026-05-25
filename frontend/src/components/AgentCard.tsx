import React from 'react';
import { Agent } from '../api/agents';
import ResourceBar from './ResourceBar';
import CountryFlag from './CountryFlag';
import { useTranslation } from 'react-i18next';
import { getOSImage } from '../utils/osImageHelper';
import { TimerIcon, CalendarIcon } from '@radix-ui/react-icons';
import { Cpu, MemoryStick, HardDrive, ArrowDown, ArrowUp, Download, Upload, Activity } from 'lucide-react';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  size?: 'small' | 'medium' | 'large';
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

const AgentCard = React.memo(({ agent, onClick, size = 'large' }: AgentCardProps) => {
  const { t } = useTranslation();

  let cpu = 0, memPct = 0, diskPct = 0;
  try {
    if (agent.cpu_usage != null) cpu = Math.round(agent.cpu_usage * 10) / 10;
    if (agent.memory_total && agent.memory_used) memPct = Math.round((agent.memory_used / agent.memory_total) * 1000) / 10;
    if (agent.disk_total && agent.disk_used) diskPct = Math.round((agent.disk_used / agent.disk_total) * 1000) / 10;
  } catch (e) { /* ignore */ }

  const uptime = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;
  const uptimeStr = formatDuration(uptime);
  const connectMs = agent.connected_at ? Math.max(0, Date.now() - new Date(agent.connected_at).getTime()) : 0;
  const connectStr = connectMs ? formatDuration(connectMs) : '';
  const isOnline = agent.status === 'active';
  const netRx = agent.network_rx || 0;
  const netTx = agent.network_tx || 0;
  const totalTraffic = (agent.network_rx_total || 0) + (agent.network_tx_total || 0);
  const totalTrafficStr = formatBytes(totalTraffic);
  const trafficLimit = agent.traffic_limit || 0;
  const trafficLimitStr = trafficLimit > 0 ? formatBytes(trafficLimit) : '';
  const trafficPct = trafficLimit > 0 ? Math.round((totalTraffic / trafficLimit) * 1000) / 10 : 0;
  const hasExpiry = !!agent.expiry_time;
  const expiryMs = hasExpiry ? Math.max(0, new Date(agent.expiry_time!).getTime() - Date.now()) : 0;
  const isExpired = hasExpiry && expiryMs <= 0;
  const expiryStr = hasExpiry ? (isExpired ? '' : formatDuration(expiryMs)) : '';
  const hasDuration = !!(agent.duration_value && agent.duration_unit);
  const durationLabel = hasDuration
    ? `${agent.duration_value}${agent.duration_unit === 'day' ? '天' : agent.duration_unit === 'month' ? '个月' : '年'}`
    : '';
  const startLabel = agent.start_time ? new Date(agent.start_time).toLocaleDateString('zh-CN') : '';

  const rxTotalStr = formatBytes(agent.network_rx_total || 0);
  const txTotalStr = formatBytes(agent.network_tx_total || 0);
  const memUsedStr = formatBytes(agent.memory_used || 0);
  const memTotalStr = formatBytes(agent.memory_total || 0);
  const diskUsedStr = formatBytes(agent.disk_used || 0);
  const diskTotalStr = formatBytes(agent.disk_total || 0);

  const IconWrap = ({ children, color }: { children: React.ReactNode; color: string }) => (
    <span className={`w-4 h-4 flex items-center justify-center rounded ${color}`}>{children}</span>
  );

  const MetricItem = ({ icon, iconColor, label, value, sub, barValue, barColor }: { icon: React.ReactNode; iconColor: string; label: string; value: string; sub?: string; barValue?: number; barColor?: string }) => {
    const hasBar = barValue != null && barColor;
    const hasSub = !!sub;
    return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 flex items-center gap-1">
          <IconWrap color={iconColor}>{icon}</IconWrap>{label}
        </span>
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{value || ''}</span>
      </div>
      <div className="text-[10px] leading-[14px] h-[14px]">
        {hasSub && <span className="text-slate-400">{sub}</span>}
      </div>
      {hasBar && <ResourceBar value={Math.min(barValue!, 100)} color={barColor!} height={5} />}
    </div>
  );};

  const commonCardProps = {
    onClick,
    className: `glass rounded-xl hover:shadow-lg transition-shadow duration-200 ${onClick ? 'cursor-pointer' : ''} ${!isOnline ? 'offline-striped ring-2 ring-red-500/50' : ''}`,
  };

  // ── Small card (nezha ServerCardInline style) ──
  if (size === 'small') {
    const barColor = (v: number) =>
      v > 90 ? 'bg-red-500' : v > 70 ? 'bg-orange-400' : 'bg-green-500';
    const netUp = netTx >= 1024 ? `${(netTx / 1024).toFixed(1)}M/s` : `${netTx.toFixed(1)}K/s`;
    const netDown = netRx >= 1024 ? `${(netRx / 1024).toFixed(1)}M/s` : `${netRx.toFixed(1)}K/s`;
    const osBase = (agent.os || '').split(' ')[0].toLowerCase();
    const verBase = (agent.version || '').split(' ')[0];
    const osName = osBase === 'linux' ? (verBase || 'Linux') : (osBase || '');

    return isOnline ? (
      <div
        onClick={onClick}
        className={`rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg shadow-neutral-200/40 dark:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer`}
      >
        <div className="flex items-center justify-start gap-3 p-3 md:px-5 min-w-[680px] w-full">
          {/* Left: dot + flag + name */}
          <section className="grid items-center gap-2 shrink-0 lg:w-28" style={{ gridTemplateColumns: 'auto auto 1fr' }}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-green-500 self-center" />
            <div className="flex items-center justify-center min-w-[16px]"><CountryFlag code={agent.country} /></div>
            <div className="flex flex-col min-w-0 w-24">
              <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{agent.name}</p>
              {osName && <p className="text-[10px] text-slate-400 truncate">{osName}</p>}
            </div>
          </section>

          {/* Separator */}
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 shrink-0" />

          {/* Right: metrics grid */}
          <div className="flex-1 grid grid-cols-7 items-center gap-2">
            <div className="flex w-14 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('agent.uptime')}</p>
              <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{uptimeStr || '--'}</div>
            </div>
            <div className="flex w-14 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">CPU</p>
              <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{cpu.toFixed(1)}%</div>
              <div className="mt-0.5 h-[3px] w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-sm transition-all duration-500 ${barColor(cpu)}`} style={{ width: `${Math.min(Math.max(cpu, 0), 100)}%` }} />
              </div>
            </div>
            <div className="flex w-14 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('agent.memory')}</p>
              <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{memPct.toFixed(1)}%</div>
              <div className="mt-0.5 h-[3px] w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-sm transition-all duration-500 ${barColor(memPct)}`} style={{ width: `${Math.min(Math.max(memPct, 0), 100)}%` }} />
              </div>
            </div>
            <div className="flex w-14 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('agent.disk')}</p>
              <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{diskPct.toFixed(1)}%</div>
              <div className="mt-0.5 h-[3px] w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className={`h-full rounded-sm transition-all duration-500 ${barColor(diskPct)}`} style={{ width: `${Math.min(Math.max(diskPct, 0), 100)}%` }} />
              </div>
            </div>
            <div className="flex w-14 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('clientResource.download')}</p>
              <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{netDown}</div>
            </div>
            <div className="flex w-14 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('clientResource.upload')}</p>
              <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{netUp}</div>
            </div>
            <div className="flex w-20 flex-col">
              <p className="text-xs text-slate-400 dark:text-slate-500">{t('agent.networkTotal')} / {t('agent.traffic')}</p>
              <div className="flex items-center text-[10px] font-semibold text-slate-700 dark:text-slate-300">↓{rxTotalStr} ↑{txTotalStr}</div>
            </div>
          </div>
        </div>
      </div>
    ) : (
      <div
        onClick={onClick}
        className={`rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg shadow-neutral-200/40 dark:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer`}
      >
        <div className="flex items-center justify-start gap-3 p-3 md:px-5 min-w-[680px]">
          <section className="grid items-center gap-2 shrink-0 lg:w-28" style={{ gridTemplateColumns: 'auto auto 1fr' }}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400 self-center" />
            <div className="flex items-center justify-center min-w-[16px]"><CountryFlag code={agent.country} /></div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{agent.name}</p>
          </section>
          <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 shrink-0" />
          <span className="text-xs text-slate-400">{t('agent.status.offline')}</span>
        </div>
      </div>
    );
  }

  // ── Medium card (nezha-dash-v2 ServerCard style) ──
  if (size === 'medium') {
    const barColor = (v: number) =>
      v > 90 ? 'bg-red-500' : v > 70 ? 'bg-orange-400' : 'bg-green-500';

    const netUp = netTx >= 1024 ? `${(netTx / 1024).toFixed(2)}M/s` : `${netTx.toFixed(1)}K/s`;
    const netDown = netRx >= 1024 ? `${(netRx / 1024).toFixed(2)}M/s` : `${netRx.toFixed(1)}K/s`;
    const osBase = (agent.os || '').split(' ')[0].toLowerCase();
    const verBase = (agent.version || '').split(' ')[0];
    const osName = osBase === 'linux' ? (verBase || 'Linux') : (osBase || '');

    return (
      <div
        onClick={onClick}
        className={`rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/40 dark:shadow-none hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${!isOnline ? 'opacity-60' : ''}`}
      >
        {isOnline ? (
          <div className="flex flex-col items-center justify-start gap-3 p-3 md:px-5">
            {/* Top: dot + flag + name */}
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
              <CountryFlag code={agent.country} />
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">{agent.name}</span>
              {uptimeStr && <span className="ml-auto text-[10px] text-slate-400 whitespace-nowrap">⏱ {uptimeStr}</span>}
            </div>

            {/* Middle: OS + metrics grid */}
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-2 w-full">
              {agent.os && (
                <div className="hidden lg:flex items-center gap-1.5 shrink-0 lg:w-20">
                  <img src={getOSImage((agent.os || '') + ' ' + (agent.version || ''))} alt="" className="w-4 h-4 object-contain" title={`${agent.os} · ${agent.version || ''}`} />
                  <span className="text-[10px] text-slate-400 truncate">{osName}</span>
                </div>
              )}
              <section className="flex flex-nowrap items-center justify-between gap-1 sm:gap-3 flex-1 min-w-0">
                <div className="flex w-12 sm:w-14 flex-col shrink-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">CPU</p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{cpu.toFixed(1)}%</div>
                  <div className="mt-0.5 h-[3px] w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-sm transition-all duration-500 ${barColor(cpu)}`} style={{ width: `${Math.min(Math.max(cpu, 0), 100)}%` }} />
                  </div>
                </div>
                <div className="flex w-12 sm:w-14 flex-col shrink-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t('agent.memory')}</p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{memPct.toFixed(1)}%</div>
                  <div className="mt-0.5 h-[3px] w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-sm transition-all duration-500 ${barColor(memPct)}`} style={{ width: `${Math.min(Math.max(memPct, 0), 100)}%` }} />
                  </div>
                </div>
                <div className="flex w-12 sm:w-14 flex-col shrink-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t('agent.disk')}</p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{diskPct.toFixed(1)}%</div>
                  <div className="mt-0.5 h-[3px] w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div className={`h-full rounded-sm transition-all duration-500 ${barColor(diskPct)}`} style={{ width: `${Math.min(Math.max(diskPct, 0), 100)}%` }} />
                  </div>
                </div>
                <div className="flex w-12 sm:w-14 flex-col shrink-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t('clientResource.download')}</p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{netDown}</div>
                </div>
                <div className="flex w-12 sm:w-14 flex-col shrink-0">
                  <p className="text-xs text-slate-400 dark:text-slate-500">{t('clientResource.upload')}</p>
                  <div className="flex items-center text-xs font-semibold text-slate-700 dark:text-slate-300">{netUp}</div>
                </div>
              </section>
            </div>

            {/* Bottom: totals */}
            <div className="flex items-center w-full justify-between gap-1">
              <span className="flex-1 text-center rounded-[8px] text-nowrap text-[11px] py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm">
                ↓ {rxTotalStr}
              </span>
              <span className="flex-1 text-center rounded-[8px] text-nowrap text-[11px] py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 shadow-sm">
                ↑ {txTotalStr}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3">
            <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
            <CountryFlag code={agent.country} />
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 truncate">{agent.name}</span>
            <span className="ml-auto text-[10px] text-slate-400">{t('agent.status.offline')}</span>
          </div>
        )}
      </div>
    );
  }

  // ── Large (full detail) card ──
  return (
    <div {...commonCardProps} className={`${commonCardProps.className} p-4`}>
      {/* Header: flag + OS + name + status */}
      <div className="flex items-center gap-2 mb-3">
        <CountryFlag code={agent.country} />
        {agent.os && (
          <img src={getOSImage((agent.os || '') + ' ' + (agent.version || ''))} alt={agent.os.split(' ')[0]} className="w-4 h-4 object-contain flex-shrink-0" title={`${agent.os} · ${agent.version || ''}`} />
        )}
        <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{agent.name}</span>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`} />
          <span className={`text-[11px] font-medium ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'}`}>
            {isOnline ? t('agent.status.online') : t('agent.status.offline')}
          </span>
        </span>
      </div>

      {/* Tags row */}
      {(agent.category || agent.tags) && (
        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          {agent.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {agent.category}
            </span>
          )}
          {agent.tags && agent.tags.split(',').filter(Boolean).map((tag: string, i: number) => {
            const colors = ['bg-blue-500/10 text-blue-600', 'bg-emerald-500/10 text-emerald-600', 'bg-amber-500/10 text-amber-600', 'bg-purple-500/10 text-purple-600', 'bg-rose-500/10 text-rose-600', 'bg-cyan-500/10 text-cyan-600', 'bg-orange-500/10 text-orange-600', 'bg-indigo-500/10 text-indigo-600', 'bg-teal-500/10 text-teal-600', 'bg-pink-500/10 text-pink-600', 'bg-lime-500/10 text-lime-600', 'bg-violet-500/10 text-violet-600'];
            let hash = 0;
            const t = tag.trim();
            for (let j = 0; j < t.length; j++) hash = ((hash << 5) - hash) + t.charCodeAt(j);
            const c = colors[Math.abs(hash) % colors.length];
            return (
              <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${c}`}>
                {t}
              </span>
            );
          })}
        </div>
      )}

      {/* Two-column metrics - paired rows for alignment */}
      <div className="flex flex-col gap-1.5">
        {[
          [<MetricItem key="cpu" icon={<Cpu size={14} />} iconColor="bg-blue-500/10 text-blue-600" label="CPU" value={`${cpu.toFixed(1)}%`} barValue={cpu} barColor="blue" />,
           <MetricItem key="mem" icon={<MemoryStick size={14} />} iconColor="bg-green-500/10 text-green-600" label={t('agent.memory')} value={`${memPct.toFixed(1)}%`} sub={`${memUsedStr} / ${memTotalStr}`} barValue={memPct} barColor="green" />],
          [<MetricItem key="disk" icon={<HardDrive size={14} />} iconColor="bg-red-500/10 text-red-600" label={t('agent.disk')} value={`${diskPct.toFixed(1)}%`} sub={`${diskUsedStr} / ${diskTotalStr}`} barValue={diskPct} barColor="red" />,
           <MetricItem key="traf" icon={<Activity size={14} />} iconColor="bg-violet-500/10 text-violet-600" label={t('agent.traffic')} value={trafficLimit > 0 ? `${totalTrafficStr} / ${trafficLimitStr}` : '--'} barValue={trafficLimit > 0 ? trafficPct : 0} barColor="purple" />],
          [<MetricItem key="dl" icon={<ArrowDown size={14} />} iconColor="bg-cyan-500/10 text-cyan-600" label={t('clientResource.download')} value={netRx >= 1024 ? `${(netRx / 1024).toFixed(1)} MB/s` : `${netRx.toFixed(1)} KB/s`} />,
           <MetricItem key="ul" icon={<ArrowUp size={14} />} iconColor="bg-indigo-500/10 text-indigo-600" label={t('clientResource.upload')} value={netTx >= 1024 ? `${(netTx / 1024).toFixed(1)} MB/s` : `${netTx.toFixed(1)} KB/s`} />],
          [<MetricItem key="tdl" icon={<Download size={14} />} iconColor="bg-slate-500/10 text-slate-500" label={t('agent.networkTotalRx')} value={rxTotalStr} />,
           <MetricItem key="tul" icon={<Upload size={14} />} iconColor="bg-slate-500/10 text-slate-500" label={t('agent.networkTotalTx')} value={txTotalStr} />],
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
            icon={<CalendarIcon />} iconColor="bg-orange-500/10 text-orange-600"
            label={t('agent.expiry')}
            value={hasExpiry ? (expiryStr || (hasDuration ? '已过期' : t('agent.expired'))) : '--'}
            sub={hasDuration ? `${startLabel} / ${durationLabel}` : undefined}
          />
        </div>
        <div className="flex-1">
          <MetricItem
            icon={<TimerIcon />} iconColor="bg-teal-500/10 text-teal-600"
            label={t('agent.uptime')}
            value={uptimeStr || '--'}
            sub={connectStr}
          />
        </div>
      </div>
    </div>
  );
});

export default AgentCard;
