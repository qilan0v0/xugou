import { useState, useEffect, useRef } from 'react';
import { Cross2Icon, ClockIcon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import { ENV_API_BASE_URL } from '../config';

interface MonitorCheck {
  status: string;
  response_time: number;
  status_code: number;
  checked_at: string;
}

interface MonitorDetailModalProps {
  monitorId: number;
  monitorName: string;
  onClose: () => void;
}

const LIMITS = [10, 25, 50] as const;
const RING_R = 16;
const RING_CIRC = 2 * Math.PI * RING_R;

function RingGauge({ pct, upCount, downCount }: { pct: number; upCount: number; downCount: number }) {
  const offset = RING_CIRC * (1 - pct / 100);
  const isGreen = pct >= 99;
  const isAmber = pct >= 95 && pct < 99;
  const strokeColor = isGreen ? '#22c55e' : isAmber ? '#f59e0b' : '#ef4444';

  return (
    <div className="relative w-10 h-10 flex-shrink-0" title={`${upCount}上 / ${downCount}下 · 24次检查`}>
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        {/* bg ring */}
        <circle cx="20" cy="20" r={RING_R} fill="none"
          stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth="3" />
        {/* progress ring */}
        <circle cx="20" cy="20" r={RING_R} fill="none"
          stroke={strokeColor} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={RING_CIRC} strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700 ease-out" />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[9px] font-bold ${isGreen ? 'text-emerald-600' : isAmber ? 'text-amber-600' : 'text-red-500'}`}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default function MonitorDetailModal({ monitorId, monitorName, onClose }: MonitorDetailModalProps) {
  const [allChecks, setAllChecks] = useState<MonitorCheck[]>([]);
  const [limit, setLimit] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; check: MonitorCheck; idx: number } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const fetchChecks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${ENV_API_BASE_URL}/api/status/monitor/${monitorId}/checks?limit=50`);
      const data = await res.json();
      if (data.success) setAllChecks(data.checks || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchChecks(); }, [monitorId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Chart data: slice from allChecks based on selected limit
  const checks = allChecks.slice(-limit);

  // Ring data: last 24 checks
  const ringChecks = allChecks.slice(-24);
  const ringUp = ringChecks.filter(c => c.status === 'up').length;
  const ringDown = ringChecks.length - ringUp;
  const ringPct = ringChecks.length ? Math.round((ringUp / ringChecks.length) * 100) : 100;

  // Chart constants
  const padLeft = 44;
  const padRight = 16;
  const padTop = 12;
  const padBottom = 24;
  const chartW = 600;
  const chartH = 220;
  const plotW = chartW - padLeft - padRight;
  const plotH = chartH - padTop - padBottom;

  // Compute scale
  const maxRT = checks.length ? Math.max(...checks.map(c => c.response_time || 0), 100) : 100;
  const yMax = Math.ceil(maxRT / 100) * 100 + 50;

  const getX = (i: number) => padLeft + (checks.length > 1 ? (i / (checks.length - 1)) * plotW : plotW / 2);
  const getY = (v: number) => padTop + plotH - (v / yMax) * plotH;

  const points = checks.map((c, i) => `${getX(i)},${getY(c.response_time || 0)}`).join(' ');
  const numYL = 4;
  const yTicks = Array.from({ length: numYL }, (_, i) => Math.round((yMax / (numYL - 1)) * i));

  const avgRT = checks.length
    ? Math.round(checks.reduce((s, c) => s + (c.response_time || 0), 0) / checks.length)
    : 0;
  const upCount = checks.filter(c => c.status === 'up').length;
  const downCount = checks.length - upCount;
  const avail = checks.length ? Math.round((upCount / checks.length) * 10000) / 100 : 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl glass rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10">
          <Cross2Icon className="w-5 h-5" />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <RingGauge pct={ringPct} upCount={ringUp} downCount={ringDown} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{monitorName}</h2>
              <p className="text-xs text-slate-500">延迟监控详情</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">平均延迟</div>
              <div className="text-base font-bold text-slate-900 dark:text-white">{avgRT}<span className="text-xs font-normal text-slate-400">ms</span></div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">可用率</div>
              <div className={`text-base font-bold ${avail >= 99 ? 'text-emerald-600' : avail >= 95 ? 'text-amber-600' : 'text-red-500'}`}>{avail}%</div>
            </div>
            <div className="glass rounded-xl p-3 text-center">
              <div className="text-[10px] text-slate-500 mb-0.5">检查次数</div>
              <div className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                <span className="text-emerald-600 text-xs flex items-center gap-0.5"><CheckCircledIcon className="w-3 h-3" />{upCount}</span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="text-red-500 text-xs flex items-center gap-0.5"><CrossCircledIcon className="w-3 h-3" />{downCount}</span>
              </div>
            </div>
          </div>

          {/* Limit selector */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-500">延迟趋势</span>
            <div className="flex gap-1">
              {LIMITS.map(n => (
                <button
                  key={n}
                  onClick={() => setLimit(n)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    limit === n
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >最近{n}次</button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">加载中...</div>
          ) : checks.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">暂无检查数据</div>
          ) : (
            <div
              ref={chartRef}
              className="relative"
              style={{ height: chartH }}
              onMouseMove={e => {
                if (!chartRef.current || !checks.length) return;
                const rect = chartRef.current.getBoundingClientRect();
                const mx = ((e.clientX - rect.left) / rect.width) * chartW;
                const my = ((e.clientY - rect.top) / rect.height) * chartH;
                let nearestIdx = 0;
                let nearestDist = Infinity;
                checks.forEach((c, i) => {
                  const dx = getX(i) - mx;
                  const dy = getY(c.response_time || 0) - my;
                  const d = dx * dx + dy * dy;
                  if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
                });
                if (nearestDist < 2500) {
                  setTooltip({
                    x: (getX(nearestIdx) / chartW) * rect.width,
                    y: (getY(checks[nearestIdx].response_time || 0) / chartH) * rect.height,
                    check: checks[nearestIdx],
                    idx: nearestIdx,
                  });
                } else {
                  setTooltip(null);
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Grid lines */}
                {yTicks.map(v => (
                  <g key={v}>
                    <line x1={padLeft} x2={chartW - padRight} y1={getY(v)} y2={getY(v)}
                      stroke="currentColor" className="text-slate-200 dark:text-white/[0.06]" strokeWidth={0.5} />
                    <text x={padLeft - 6} y={getY(v) + 4} textAnchor="end"
                      className="text-[9px] fill-slate-400 select-none">{v}ms</text>
                  </g>
                ))}

                {/* Area fill */}
                {checks.length > 1 && (
                  <polygon
                    points={`${getX(0)},${padTop + plotH} ${points} ${getX(checks.length - 1)},${padTop + plotH}`}
                    className="fill-emerald-500/10"
                  />
                )}

                {/* Line */}
                {checks.length > 1 && (
                  <polyline points={points} fill="none" stroke="currentColor"
                    className="text-emerald-500" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Dots */}
                {checks.map((c, i) => (
                  <circle key={i} cx={getX(i)} cy={getY(c.response_time || 0)} r={3}
                    className={`fill-white dark:fill-slate-800 stroke-[2] ${c.status === 'up' ? 'stroke-emerald-500' : 'stroke-red-500'}`}
                  />
                ))}

                {/* X axis labels */}
                {checks.length > 1 && (
                  <>
                    <text x={getX(0)} y={chartH - 4} textAnchor="middle" className="text-[8px] fill-slate-400 select-none">
                      {checks[0]?.checked_at ? new Date(checks[0].checked_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </text>
                    <text x={getX(checks.length - 1)} y={chartH - 4} textAnchor="middle" className="text-[8px] fill-slate-400 select-none">
                      {checks[checks.length - 1]?.checked_at ? new Date(checks[checks.length - 1].checked_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
                    </text>
                  </>
                )}
              </svg>

              {/* Tooltip overlay */}
              {tooltip && (
                <div className="absolute pointer-events-none bg-slate-900 text-white text-[10px] rounded-md px-2 py-1.5 shadow-lg whitespace-nowrap"
                  style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%)' }}>
                  <div>#{tooltip.idx + 1} · {new Date(tooltip.check.checked_at).toLocaleString('zh-CN')}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span>延迟: <b>{tooltip.check.response_time}ms</b></span>
                    <span>状态码: {tooltip.check.status_code || '--'}</span>
                    <span className={tooltip.check.status === 'up' ? 'text-emerald-400' : 'text-red-400'}>
                      {tooltip.check.status === 'up' ? 'UP' : 'DOWN'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Refresh */}
          <div className="flex justify-end mt-4 pt-3 border-t border-white/[0.06]">
            <button onClick={fetchChecks} className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
              <ClockIcon className="w-3 h-3 inline mr-1" />刷新
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
