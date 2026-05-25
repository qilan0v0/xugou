import { MonitorStatusHistory } from '../api/monitors';
import { useTranslation } from 'react-i18next';

const HeartbeatGrid = ({ uptime, history = [] }: { uptime: number, history?: (MonitorStatusHistory | string)[] }) => {
  const { t } = useTranslation();
  const normalizedUptime = Math.min(Math.max(uptime, 0), 100);

  const getColor = (status: string) => {
    switch (status) {
      case 'up': return 'bg-emerald-500';
      case 'down': return 'bg-red-500';
      case 'unknown': return 'bg-slate-400';
      default: return 'bg-slate-300 dark:bg-slate-600';
    }
  };

  let displayHistory: { status: string; timestamp?: string }[] = [];
  if (Array.isArray(history)) {
    displayHistory = history.slice(0, 24).map(item =>
      typeof item === 'string' ? { status: item } : item
    );
  }

  const emptyCount = Math.max(0, 24 - displayHistory.length);

  return (
    <div>
      <div className="flex gap-1 sm:gap-1.5">
        {displayHistory.map((item, i) => (
          <div key={i}
            className={`w-[7px] h-[7px] sm:w-2.5 sm:h-2.5 rounded-full shrink-0 ${getColor(item.status)} transition-all hover:scale-125 cursor-pointer`}
            title={`${item.timestamp ? new Date(item.timestamp).toLocaleString() : t('heartbeatGrid.unknownTime')}: ${item.status}`}
          />
        ))}
        {Array.from({ length: emptyCount }).map((_, i) => (
          <div key={`e-${i}`} className="w-[7px] h-[7px] sm:w-2.5 sm:h-2.5 rounded-full shrink-0 bg-slate-200 dark:bg-white/5" />
        ))}
      </div>
      <div className="flex justify-between items-center mt-3">
        <span className="text-xs text-slate-500">{t('heartbeatGrid.uptime')}: {normalizedUptime.toFixed(2)}%</span>
        <div className="flex gap-3 items-center">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {t('heartbeatGrid.up')}
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-2 h-2 rounded-full bg-red-500" /> {t('heartbeatGrid.down')}
          </span>
        </div>
      </div>
    </div>
  );
};

export default HeartbeatGrid;
