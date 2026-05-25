interface ResourceBarProps {
  value: number;
  color?: string;
  height?: number;
}

const ResourceBar = ({ value = 0, color = 'green', height = 5 }: ResourceBarProps) => {
  const safeValue = Math.min(Math.max(value, 0), 100);

  const barColor = color === 'dynamic'
    ? (safeValue > 90 ? 'bg-red-500' : safeValue > 70 ? 'bg-orange-400' : 'bg-green-500')
    : {
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        amber: 'bg-orange-400',
        red: 'bg-red-500',
        cyan: 'bg-cyan-500',
        indigo: 'bg-indigo-500',
        purple: 'bg-purple-500',
      }[color] || 'bg-green-500';

  return (
    <div className="w-full rounded-sm bg-slate-100 dark:bg-slate-800 overflow-hidden" style={{ height: `${height}px` }}>
      <div
        className={`h-full rounded-sm transition-all duration-500 ${barColor}`}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
};

export default ResourceBar;
