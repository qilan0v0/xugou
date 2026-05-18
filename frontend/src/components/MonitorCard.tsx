import { Monitor } from '../api/monitors';
import HeartbeatGrid from './HeartbeatGrid';
import { useTranslation } from 'react-i18next';

interface MonitorCardProps {
  monitor: Monitor;
}

const MonitorCard = ({ monitor }: MonitorCardProps) => {
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
    <div className="glass glass-hover relative overflow-hidden group">
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${config.border}`} />
      <div className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold ${config.text}`}>{config.icon}</span>
            <span className="font-semibold text-sm text-slate-900 dark:text-white">{monitor.name}</span>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {label}
          </span>
        </div>

        <div className="text-xs text-slate-500 mb-3">
          {t('monitorCard.responseTime')}: {monitor.response_time || t('monitorCard.unknown')}ms
        </div>

        <HeartbeatGrid uptime={monitor.uptime} history={monitor.history} />
      </div>
    </div>
  );
};

export default MonitorCard;
