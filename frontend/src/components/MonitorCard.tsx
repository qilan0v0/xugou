import React from 'react';
import { Monitor } from '../api/monitors';
import HeartbeatGrid from './HeartbeatGrid';

interface MonitorCardProps {
  monitor: Monitor;
  onClick?: () => void;
}

const MonitorCard = React.memo(({ monitor, onClick }: MonitorCardProps) => {
  const currentStatus = monitor.status || 'pending';

  const statusConfig: Record<string, { text: string; dot: string }> = {
    up:       { text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
    down:     { text: 'text-red-500 dark:text-red-400', dot: 'bg-red-500' },
    degraded: { text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
    pending:  { text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  };

  const cfg = statusConfig[currentStatus] || statusConfig.pending;

  // Uptime pill color
  const uptimeColor = (() => {
    if (currentStatus === 'down') return 'bg-red-500';
    if (monitor.uptime >= 99.9) return 'bg-emerald-500';
    if (monitor.uptime >= 99) return 'bg-emerald-400';
    if (monitor.uptime >= 95) return 'bg-amber-500';
    return 'bg-red-400';
  })();

  return (
    <div
      onClick={onClick}
      className={`group flex flex-wrap items-center gap-2 gap-y-1 px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl transition-all duration-150
        bg-white/60 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.06]
        hover:bg-white dark:hover:bg-white/[0.06] hover:border-slate-300/60 dark:hover:border-white/[0.10]
        hover:shadow-sm ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Left: Uptime pill badge */}
      <div className={`shrink-0 min-w-[46px] sm:min-w-[52px] text-center text-[10px] sm:text-[11px] font-semibold text-white rounded-full px-1.5 sm:px-2 py-0.5 leading-5 ${uptimeColor}`}>
        {monitor.uptime != null ? `${Math.round(monitor.uptime * 100) / 100}%` : '--'}
      </div>

      {/* Middle: Name + tags + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${cfg.dot}`} />
          <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
            {monitor.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
          {monitor.tags && (
            <div className="flex items-center gap-1 flex-wrap">
              {monitor.tags.split(',').filter(Boolean).map((tag: string, i: number) => {
                const colors = [
                  'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
                  'bg-rose-500/10 text-rose-600 dark:text-rose-400',
                  'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
                ];
                let hash = 0;
                const t = tag.trim();
                for (let j = 0; j < t.length; j++) hash = ((hash << 5) - hash) + t.charCodeAt(j);
                const c = colors[Math.abs(hash) % colors.length];
                return (
                  <span key={i} className={`text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded font-medium ${c}`}>
                    {t}
                  </span>
                );
              })}
            </div>
          )}
          <span className="text-[10px] sm:text-[11px] text-slate-400">
            {monitor.response_time != null ? `${monitor.response_time}ms` : ''}
          </span>
        </div>
      </div>

      {/* Right: Heartbeat history dots — wraps to own row on mobile */}
      <div className="shrink-0 w-full sm:w-auto mt-0.5 sm:mt-0">
        <HeartbeatGrid history={monitor.history} />
      </div>
    </div>
  );
});

export default MonitorCard;
