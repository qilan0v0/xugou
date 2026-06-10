import { MonitorStatusHistory } from '../api/monitors';

const HeartbeatGrid = ({ history = [] }: { history?: (MonitorStatusHistory | string)[] }) => {
  const getColor = (status: string) => {
    switch (status) {
      case 'up': return 'bg-emerald-500';
      case 'down': return 'bg-red-500';
      case 'unknown': return 'bg-slate-400';
      default: return 'bg-slate-300 dark:bg-slate-600';
    }
  };

  let displayHistory: string[] = [];
  if (Array.isArray(history)) {
    displayHistory = history.slice(0, 24).map(item =>
      typeof item === 'string' ? item : item.status
    );
  }

  const emptyCount = Math.max(0, 24 - displayHistory.length);

  return (
    <div className="flex items-center gap-[2px] sm:gap-[3px]">
      {displayHistory.map((status, i) => (
        <div key={i}
          className={`w-[4px] sm:w-[6px] h-3 sm:h-4 rounded-sm shrink-0 ${getColor(status)}`}
        />
      ))}
      {Array.from({ length: emptyCount }).map((_, i) => (
        <div key={`e-${i}`} className="w-[4px] sm:w-[6px] h-3 sm:h-4 rounded-sm shrink-0 bg-slate-200 dark:bg-white/[0.08]" />
      ))}
    </div>
  );
};

export default HeartbeatGrid;
