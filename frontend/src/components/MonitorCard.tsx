import React from 'react';
import { Monitor } from '../api/monitors';
import HeartbeatGrid from './HeartbeatGrid';
import { useTranslation } from 'react-i18next';

interface MonitorCardProps {
  monitor: Monitor;
  onClick?: () => void;
}

const MonitorCard = React.memo(({ monitor, onClick }: MonitorCardProps) => {
  const { t } = useTranslation();

  const currentStatus = monitor.status || 'pending';

  const statusConfig: Record<string, { bg: string; text: string; dot: string; border: string; icon: string }> = {
    up: {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      dot: 'bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse-dot',
      border: 'from-emerald-500 to-emerald-400',
      icon: '✓',
    },
    down: {
      bg: 'bg-red-500/10',
      text: 'text-red-500 dark:text-red-400',
      dot: 'bg-red-500',
      border: 'from-red-500 to-red-400',
      icon: '✕',
    },
    degraded: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-600 dark:text-orange-400',
      dot: 'bg-orange-500',
      border: 'from-orange-500 to-orange-400',
      icon: '!',
    },
    pending: {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      dot: 'bg-amber-500',
      border: 'from-amber-500 to-amber-400',
      icon: '?',
    },
  };

  const config = statusConfig[currentStatus] || statusConfig.pending;
  const label = t(`monitorCard.status.${currentStatus}`, currentStatus);

  return (
    <div
      onClick={onClick}
      className={`glass glass-hover relative overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${config.border}`} />
      <div className="p-4">
        <div className="flex justify-between items-start mb-3 gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`text-sm font-bold shrink-0 ${config.text}`}>{config.icon}</span>
            <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{monitor.name}</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap shrink-0 ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {label}
          </span>
        </div>

        <div className="text-xs text-slate-500 mb-3">
          {t('monitorCard.responseTime')}: {monitor.response_time || t('monitorCard.unknown')}ms
        </div>

        {monitor.tags && (
          <div className="flex items-center gap-1 mb-2 flex-wrap">
            {monitor.tags.split(',').filter(Boolean).map((tag: string, i: number) => {
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

        <HeartbeatGrid uptime={monitor.uptime} history={monitor.history} />
      </div>
    </div>
  );
});

export default MonitorCard;
