interface ResourceBarProps {
  value: number;
  color?: string;
  height?: number;
}

const ResourceBar = ({ value = 0, color = 'green', height = 8 }: ResourceBarProps) => {
  const safeValue = Math.min(Math.max(value, 0), 100);

  const colorMap: Record<string, string> = {
    green: 'from-emerald-500 to-emerald-400',
    blue: 'from-blue-500 to-blue-400',
    amber: 'from-amber-500 to-amber-400',
    red: 'from-red-500 to-red-400',
    cyan: 'from-cyan-500 to-cyan-400',
    indigo: 'from-indigo-500 to-indigo-400',
    purple: 'from-purple-500 to-purple-400',
    dynamic: safeValue < 50 ? 'from-emerald-500 to-emerald-400' : safeValue < 75 ? 'from-amber-500 to-amber-400' : 'from-red-500 to-red-400',
  };

  const barGradient = color === 'dynamic' ? colorMap.dynamic : (colorMap[color] || colorMap.green);

  return (
    <div className="w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden" style={{ height: `${height}px` }}>
      <div
        className={`h-full w-full rounded-full bg-gradient-to-r ${barGradient} origin-left will-change-transform backface-hidden`}
        style={{
          transform: `scaleX(${safeValue / 100})`,
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      />
    </div>
  );
};

export default ResourceBar;
