import { useState, useEffect, useRef } from 'react';
import { Cross2Icon, CheckCircledIcon, CrossCircledIcon } from '@radix-ui/react-icons';
import LoadingSpinner from './LoadingSpinner';
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

const RING_R = 18;
const RING_CIRC = 2 * Math.PI * RING_R;

function RingGauge({ pct }: { pct: number }) {
  const offset = RING_CIRC * (1 - Math.min(pct, 100) / 100);
  const color = pct >= 99.9 ? '#22c55e' : pct >= 99 ? '#4ade80' : pct >= 95 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-[44px] h-[44px] shrink-0">
      <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
        <circle cx="22" cy="22" r={RING_R} fill="none" stroke="currentColor" className="text-slate-200 dark:text-white/10" strokeWidth="3" />
        <circle cx="22" cy="22" r={RING_R} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={RING_CIRC} strokeDashoffset={offset} className="transition-all duration-700 ease-out" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>{Math.round(pct)}%</span>
    </div>
  );
}

export default function MonitorDetailModal({ monitorId, monitorName, onClose }: MonitorDetailModalProps) {
  const [allChecks, setAllChecks] = useState<MonitorCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; check: MonitorCheck } | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Period selector: hours, 0 = "auto" (just whatever we fetched)
  const [periodHrs, setPeriodHrs] = useState<number>(0);
  const PERIODS = [
    { label: '即时', value: 0 },
    { label: '3h', value: 3 },
    { label: '6h', value: 6 },
    { label: '24h', value: 24 },
  ];

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

  // Filter by period
  let checks = allChecks;
  if (periodHrs > 0 && allChecks.length > 0) {
    const cutoff = Date.now() - periodHrs * 3600 * 1000;
    checks = allChecks.filter(c => new Date(c.checked_at).getTime() >= cutoff);
  }

  // Stats
  const upCount = checks.filter(c => c.status === 'up').length;
  const downCount = checks.length - upCount;
  const avail = checks.length ? Math.round((upCount / checks.length) * 10000) / 100 : 100;
  const avgRT = checks.length ? Math.round(checks.reduce((s, c) => s + (c.response_time || 0), 0) / checks.length) : 0;

  // Ring: last 24 checks regardless of period
  const ringChecks = allChecks.slice(-24);
  const ringUp = ringChecks.filter(c => c.status === 'up').length;
  const ringPct = ringChecks.length ? Math.round((ringUp / ringChecks.length) * 100) : 100;

  // ── Chart constants (Kuma style) ──
  const CHART_W = 600;
  const CHART_H = 220;
  const PAD_L = 48;
  const PAD_R = 20;
  const PAD_T = 16;
  const PAD_B = 28;
  const PLOT_W = CHART_W - PAD_L - PAD_R;
  const PLOT_H = CHART_H - PAD_T - PAD_B;

  // Compute Y axis
  const maxRT = checks.length ? Math.max(...checks.map(c => c.response_time || 0), 100) : 100;
  const yMax = Math.ceil(maxRT / 100) * 100 + 50;

  // Time range for X axis
  const ts = checks.map(c => new Date(c.checked_at).getTime());
  const tMin = checks.length ? Math.min(...ts) : Date.now() - 3600000;
  const tMax = checks.length ? Math.max(...ts) : Date.now();
  const tRange = Math.max(tMax - tMin, 60000); // at least 1 min

  const getX = (t: number) => PAD_L + ((t - tMin) / tRange) * PLOT_W;
  const getY = (v: number) => PAD_T + PLOT_H - (v / yMax) * PLOT_H;

  // Build polyline points for avg ping
  const linePoints = checks
    .map((c) => {
      const x = getX(new Date(c.checked_at).getTime());
      const y = getY(c.response_time || 0);
      return `${x},${y}`;
    })
    .join(' ');

  // Area points (line + bottom edge for fill)
  const areaPoints = checks.length > 1
    ? `${getX(ts[0])},${PAD_T + PLOT_H} ${linePoints} ${getX(ts[ts.length - 1])},${PAD_T + PLOT_H}`
    : '';

  // Down bar positions — show at bottom of chart
  const downBars = checks
    .map((c, i) => {
      if (c.status === 'up') return null;
      const cx = getX(new Date(c.checked_at).getTime());
      if (i < checks.length - 1) {
        const nextT = new Date(checks[i + 1].checked_at).getTime();
        const nx = getX(nextT);
        return { x: cx, w: Math.max(nx - cx, 3), color: 'rgba(239, 68, 68, 0.5)' };
      }
      return { x: cx - 2, w: 4, color: 'rgba(239, 68, 68, 0.5)' };
    })
    .filter(Boolean) as { x: number; w: number; color: string }[];

  // Y axis ticks
  const numYTicks = 4;
  const yTicks = Array.from({ length: numYTicks }, (_, i) => Math.round((yMax / (numYTicks - 1)) * i));

  // X axis labels (start & end)
  const fmtTime = (t: number) => new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  // Handle hover tooltip
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!chartRef.current || !checks.length) return;
    const rect = chartRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * CHART_W;
    const my = ((e.clientY - rect.top) / rect.height) * CHART_H;

    let nearestIdx = 0;
    let nearestDist = Infinity;
    checks.forEach((c, i) => {
      const dx = getX(new Date(c.checked_at).getTime()) - mx;
      const dy = getY(c.response_time || 0) - my;
      const d = dx * dx + dy * dy;
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });

    if (nearestDist < 3000) {
      setTooltip({
        x: (getX(new Date(checks[nearestIdx].checked_at).getTime()) / CHART_W) * rect.width,
        y: (getY(checks[nearestIdx].response_time || 0) / CHART_H) * rect.height,
        check: checks[nearestIdx],
      });
    } else {
      setTooltip(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-2xl glass rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10">
          <Cross2Icon className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <RingGauge pct={ringPct} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{monitorName}</h2>
              <p className="text-xs text-slate-500">延迟监控详情</p>
            </div>
          </div>

          {/* Stats row */}
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

          {/* Period selector (Kuma style pills) */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-slate-500">延迟趋势</span>
            <div className="flex gap-0.5 bg-slate-100 dark:bg-white/[0.06] rounded-lg p-0.5">
              {PERIODS.map(p => (
                <button
                  key={p.value}
                  onClick={() => setPeriodHrs(p.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    periodHrs === p.value
                      ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >{p.label}</button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {loading ? (
            <div className="flex items-center justify-center h-[220px]"><LoadingSpinner size="sm" /></div>
          ) : checks.length === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-sm text-slate-400">暂无检查数据</div>
          ) : (
            <div
              ref={chartRef}
              className="relative select-none"
              style={{ height: CHART_H }}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
            >
              <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
                {/* Horizontal grid lines */}
                {yTicks.map(v => (
                  <g key={v}>
                    <line x1={PAD_L} x2={CHART_W - PAD_R} y1={getY(v)} y2={getY(v)}
                      stroke="currentColor" className="text-slate-200 dark:text-white/[0.06]" strokeWidth={0.5} />
                    <text x={PAD_L - 6} y={getY(v) + 4} textAnchor="end"
                      className="text-[9px] fill-slate-400 select-none">{v}ms</text>
                  </g>
                ))}

                {/* Down bars at bottom */}
                {downBars.length > 0 && (
                  <g>
                    {downBars.map((bar, i) => (
                      <rect key={i} x={bar.x} y={PAD_T + PLOT_H - 8} width={bar.w} height={8}
                        fill={bar.color} rx={1} />
                    ))}
                  </g>
                )}

                {/* Area fill */}
                {checks.length > 1 && (
                  <polygon points={areaPoints}
                    className="fill-emerald-500/10 dark:fill-emerald-400/10"
                  />
                )}

                {/* Avg ping line */}
                {checks.length > 1 && (
                  <polyline points={linePoints} fill="none"
                    className="text-emerald-500 dark:text-emerald-400"
                    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                  />
                )}

                {/* Data dots */}
                {checks.map((c, i) => (
                  <circle key={i}
                    cx={getX(new Date(c.checked_at).getTime())}
                    cy={getY(c.response_time || 0)} r={3}
                    className={`fill-white dark:fill-slate-800 stroke-[2] ${c.status === 'up' ? 'stroke-emerald-500' : 'stroke-red-500'}`}
                  />
                ))}

                {/* X axis labels */}
                {checks.length > 1 && (
                  <>
                    <text x={getX(tMin)} y={CHART_H - 6} textAnchor="middle"
                      className="text-[8px] fill-slate-400 select-none">{fmtTime(tMin)}</text>
                    <text x={getX(tMax)} y={CHART_H - 6} textAnchor="middle"
                      className="text-[8px] fill-slate-400 select-none">{fmtTime(tMax)}</text>
                  </>
                )}
              </svg>

              {/* Tooltip overlay (Kuma style) */}
              {tooltip && (
                <div className="absolute pointer-events-none bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[10px] rounded-lg px-3 py-2 shadow-xl border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                  style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -100%) translateY(-10px)' }}>
                  <div className="font-medium">{new Date(tooltip.check.checked_at).toLocaleString('zh-CN')}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <span>延迟: <b>{tooltip.check.response_time}ms</b></span>
                    <span>状态码: {tooltip.check.status_code || '--'}</span>
                    <span className={tooltip.check.status === 'up' ? 'text-emerald-600' : 'text-red-500'}>
                      {tooltip.check.status === 'up' ? '✓ Up' : '✕ Down'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
