import { useId } from 'react';

interface LoadingSpinnerProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function LoadingSpinner({ text = '加载中...', size = 'md' }: LoadingSpinnerProps) {
  const id = useId().replace(/:/g, '');
  const dims = { sm: 28, md: 40, lg: 56 }[size];
  const stroke = { sm: 3, md: 3.5, lg: 4 }[size];
  const fontSize = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size];
  const r = (dims - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3 select-none">
      <svg width={dims} height={dims} className="animate-spin">
        <circle cx={dims / 2} cy={dims / 2} r={r} fill="none"
          stroke="currentColor" className="text-slate-200 dark:text-white/8" strokeWidth={stroke} />
        <circle cx={dims / 2} cy={dims / 2} r={r} fill="none"
          stroke={`url(#${id})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${circ * 0.25} ${circ * 0.75}`} />
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
      </svg>
      <span className={`${fontSize} text-slate-400 animate-pulse`}>{text}</span>
    </div>
  );
}
