import { useEffect, useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useTranslation } from 'react-i18next';
import { getAgentMetrics, AgentMetric } from '../api/agents';
import { Cpu, MemoryStick, HardDrive, Activity } from 'lucide-react';

interface Props {
  agentId: number;
}

const COLORS = { cpu: '#3b82f6', mem: '#22c55e', disk: '#ef4444', net_rx: '#06b6d4', net_tx: '#8b5cf6' };

const formatTime = (ts: string) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const round = (v: number) => Math.round(v * 10) / 10;

function ChartCard({ title, dataKey, data, color, icon, current, unit = '%' }: {
  title: string; dataKey: string; data: AgentMetric[]; color: string; icon: React.ReactNode; current: number; unit?: string;
}) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-400">{icon}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{title}</span>
        </div>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {round(current)}{unit}
        </span>
      </div>
      <div className="h-[180px] sm:h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} syncId="agent-charts" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="ts" tickFormatter={formatTime} tick={{ fontSize: 9 }} interval="preserveStartEnd" hide />
            <Tooltip
              contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, padding: '4px 8px' }}
              labelFormatter={(v) => new Date(v as string).toLocaleString()}
              formatter={(v: number) => [`${round(v)}${unit}`, title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              fill={`url(#fill-${dataKey})`}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function AgentCharts({ agentId }: Props) {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<AgentMetric[]>([]);
  const [hours, setHours] = useState(1);

  useEffect(() => {
    let alive = true;
    const fetch = async () => {
      const res = await getAgentMetrics(agentId, hours);
      if (alive && res.success) setMetrics(res.metrics);
    };
    fetch();
    const iv = setInterval(fetch, 15000);
    return () => { alive = false; clearInterval(iv); };
  }, [agentId, hours]);

  const latest = metrics[metrics.length - 1] || { cpu: 0, mem: 0, disk: 0, net_rx: 0, net_tx: 0 } as AgentMetric;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('agent.charts') || 'Metrics History'}</h3>
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {[1, 6, 24].map(h => (
            <button key={h}
              onClick={() => setHours(h)}
              className={`px-2.5 py-0.5 rounded-md text-[11px] font-medium transition-colors ${hours === h ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >{h}h</button>
          ))}
        </div>
      </div>
      {metrics.length === 0 ? (
        <div className="glass rounded-xl p-8 text-center text-xs text-slate-400">Waiting for agent data...</div>
      ) : (
        <div className="flex flex-col gap-3">
          <ChartCard title="CPU" dataKey="cpu" data={metrics} color={COLORS.cpu} icon={<Cpu size={14} />} current={latest.cpu} />
          <ChartCard title={t('agent.memory')} dataKey="mem" data={metrics} color={COLORS.mem} icon={<MemoryStick size={14} />} current={latest.mem} />
          <ChartCard title={t('agent.disk')} dataKey="disk" data={metrics} color={COLORS.disk} icon={<HardDrive size={14} />} current={latest.disk} />
          <ChartCard title={t('agent.traffic')} dataKey="net_rx" data={metrics} color={COLORS.net_rx} icon={<Activity size={14} />} current={latest.net_rx} unit=" KB/s" />
        </div>
      )}
    </div>
  );
}
