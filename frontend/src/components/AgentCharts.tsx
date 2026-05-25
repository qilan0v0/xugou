import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';
import { getAgentMetrics, AgentMetric } from '../api/agents';

interface Props {
  agentId: number;
}

const COLORS = {
  cpu: '#3b82f6',
  mem: '#22c55e',
  disk: '#ef4444',
  net_rx: '#06b6d4',
  net_tx: '#8b5cf6',
};

const formatTime = (ts: string) => {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
};

const ChartCard = ({ title, dataKey, data, color, unit = '%', domain }: {
  title: string; dataKey: string; data: AgentMetric[]; color: string; unit?: string; domain?: [number, number];
}) => (
  <div className="glass rounded-xl p-3">
    <h4 className="text-xs font-semibold text-slate-500 mb-2">{title}</h4>
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} syncId="agentCharts" margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ts" tickFormatter={formatTime} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
          <YAxis domain={domain || [0, 'auto']} tick={{ fontSize: 10 }} unit={unit} width={35} />
          <Tooltip
            labelFormatter={(v) => new Date(v).toLocaleString()}
            formatter={(value: number) => [`${value.toFixed(1)}${unit}`, title]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('agent.charts') || 'Metrics'}</h3>
        <div className="flex gap-1">
          {[1, 6, 24].map(h => (
            <button key={h}
              onClick={() => setHours(h)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${hours === h ? 'bg-blue-500/10 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
            >{h}h</button>
          ))}
        </div>
      </div>
      {metrics.length === 0 ? (
        <div className="text-center py-8 text-xs text-slate-400">暂无历史数据，等待 agent 上报...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ChartCard title="CPU" dataKey="cpu" data={metrics} color={COLORS.cpu} domain={[0, 100]} />
          <ChartCard title={t('agent.memory')} dataKey="mem" data={metrics} color={COLORS.mem} domain={[0, 100]} />
          <ChartCard title={t('agent.disk')} dataKey="disk" data={metrics} color={COLORS.disk} domain={[0, 100]} />
          <ChartCard title={t('agent.traffic')} dataKey="net_rx" data={metrics} color={COLORS.net_rx} unit=" KB/s" />
        </div>
      )}
    </div>
  );
}
