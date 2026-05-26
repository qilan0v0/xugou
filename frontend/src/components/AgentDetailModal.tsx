import { useEffect } from 'react';
import { Cross2Icon, CopyIcon, ClockIcon, DesktopIcon, GlobeIcon, LaptopIcon, Component1Icon, StackIcon, ActivityLogIcon, TimerIcon, CodeIcon, CrumpledPaperIcon, CheckIcon, TargetIcon, ArrowDownIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { HardDrive } from 'lucide-react';
import { useState } from 'react';
import { Agent } from '../api/agents';
import CountryFlag from './CountryFlag';
import AgentCharts from './AgentCharts';
import { ENV_API_BASE_URL } from '../config';

const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GiB';
  return (bytes / 1048576).toFixed(0) + ' MiB';
};

const toCountryName = (code: string) => {
  if (!code) return '--';
  try {
    return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(code.toUpperCase()) || code;
  } catch { return code; }
};

function CopyStartCmd({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const cmd = `./qltz-agent start --server ${ENV_API_BASE_URL || window.location.origin} --uuid ${token} --interval 60`;
  const handleCopy = () => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-500 flex-shrink-0">启动:</span>
      <code className="flex-1 font-mono text-slate-600 dark:text-slate-400 truncate text-[11px]">{cmd}</code>
      <button onClick={handleCopy} className="text-blue-500 hover:text-blue-400 flex-shrink-0 flex items-center gap-1">
        {copied ? <CheckIcon className="w-3 h-3 text-emerald-500" /> : <CopyIcon className="w-3 h-3" />}
        {copied ? '已复制' : '复制'}
      </button>
    </div>
  );
}

const CircularProgress = ({ value, size, color }: { value: number; size: number; color: string }) => {
  const r = (size - 4) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(value, 100) / 100) * circ;
  return (
    <div className="relative inline-flex items-center shrink-0" style={{ width: size + 4, height: size + 4 }}>
      <svg width={size + 4} height={size + 4} className="absolute inset-0">
        <circle cx={(size+4)/2} cy={(size+4)/2} r={r} fill="none" stroke="currentColor" strokeWidth={3} className="text-slate-200 dark:text-slate-700" />
        <circle cx={(size+4)/2} cy={(size+4)/2} r={r} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset} transform={`rotate(-90 ${(size+4)/2} ${(size+4)/2})`} className="transition-all duration-700" />
      </svg>
      <span className="text-[10px] font-bold mx-auto" style={{ color }}>{Math.round(value)}%</span>
    </div>
  );
};

interface AgentDetailModalProps {
  agent: Agent;
  onClose: () => void;
  showToken?: boolean;
}

export default function AgentDetailModal({ agent, onClose, showToken }: AgentDetailModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const isOnline = agent.status === 'active';
  const uptime = agent.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;
  const uptimeStr = uptime ? `${Math.floor(uptime / 86400000)}d ${Math.floor((uptime % 86400000) / 3600000)}h ${Math.floor((uptime % 3600000) / 60000)}m` : '';
  const connectedMs = agent.connected_at ? Math.max(0, Date.now() - new Date(agent.connected_at).getTime()) : 0;
  const connectStr = connectedMs > 0 ? `${Math.floor(connectedMs / 86400000)}d ${Math.floor((connectedMs % 86400000) / 3600000)}h ${Math.floor((connectedMs % 3600000) / 60000)}m` : '';
  const formatDateTime = (s: string) => s ? new Date(s).toLocaleString() : '--';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* card */}
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto glass rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* close button */}
        <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors z-10">
          <Cross2Icon className="w-5 h-5" />
        </button>

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5 pr-8">
            <CircularProgress value={isOnline ? (() => { const upH = uptime / 3600000; return Math.min(Math.round((upH / 24) * 100), 100); })() : 0} size={38} color={isOnline ? '#22c55e' : '#94a3b8'} />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{agent.name}</h2>
              <p className="text-xs text-slate-500">
                {agent.hostname || '--'}
                {agent.country && <> · <CountryFlag code={agent.country} className="inline-block w-4 h-3 align-middle rounded-sm" /> {agent.country}</>}
              </p>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ${
              isOnline ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-500/10 text-slate-500'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-slate-400'}`} />
              {isOnline ? '在线' : '离线'}
            </span>
          </div>

          {/* quick info */}
          <div className="grid grid-cols-2 gap-2 mb-5 text-xs">
            <div className="flex items-center gap-2"><ClockIcon className="text-teal-500 w-3.5 h-3.5" /><span className="text-slate-500">最后更新:</span><span className="text-slate-700 dark:text-slate-300">{formatDateTime(agent.updated_at)}</span></div>
            <div className="flex items-center gap-2"><GlobeIcon className="text-blue-500 w-3.5 h-3.5" /><span className="text-slate-500">地区:</span><span className="text-slate-700 dark:text-slate-300">{toCountryName(agent.country || '')}</span></div>
          </div>

          {/* UUID — admin only */}
          {showToken && agent.token && (
            <div className="flex flex-col gap-2 mb-5 p-2 rounded-lg bg-slate-50 dark:bg-white/[0.02] text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 flex-shrink-0">UUID:</span>
                <code className="flex-1 font-mono text-slate-600 dark:text-slate-400 truncate">{agent.token}</code>
                <button onClick={() => navigator.clipboard.writeText(agent.token || '')} className="text-blue-500 hover:text-blue-400 flex-shrink-0 flex items-center gap-1">
                  <CopyIcon className="w-3 h-3" />复制
                </button>
              </div>
              <CopyStartCmd token={agent.token} />
            </div>
          )}

          {/* System Info — full width, 2-3 column grid */}
          <div className="glass rounded-xl p-4">
            <h3 className="font-semibold text-sm text-slate-900 dark:text-white mb-3">系统信息</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
              {/* System */}
              <div className="flex items-center gap-2"><DesktopIcon className="text-indigo-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">OS:</span><span className="text-slate-700 dark:text-slate-300 truncate">{agent.os || '--'}</span></div>
              <div className="flex items-center gap-2"><LaptopIcon className="text-violet-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">版本:</span><span className="text-slate-700 dark:text-slate-300 truncate">{agent.version || '--'}</span></div>
              {agent.boot_time && <div className="flex items-center gap-2"><TimerIcon className="text-amber-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">启动:</span><span className="text-slate-700 dark:text-slate-300 truncate">{formatDateTime(agent.boot_time)}</span></div>}
              {uptimeStr && <div className="flex items-center gap-2"><TimerIcon className="text-teal-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">运行:</span><span className="text-slate-700 dark:text-slate-300">{uptimeStr}</span></div>}
              {connectStr && <div className="flex items-center gap-2"><ActivityLogIcon className="text-cyan-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">连接:</span><span className="text-slate-700 dark:text-slate-300">{connectStr}</span></div>}

              {/* CPU */}
              {agent.cpu_arch && <div className="flex items-center gap-2"><Component1Icon className="text-emerald-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">CPU架构:</span><span className="text-slate-700 dark:text-slate-300">{agent.cpu_arch}</span></div>}
              {agent.cpu_model_name && <div className="flex items-center gap-2"><CrumpledPaperIcon className="text-orange-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">CPU型号:</span><span className="text-slate-700 dark:text-slate-300 truncate">{agent.cpu_model_name}</span></div>}
              {agent.cpu_cores != null && <div className="flex items-center gap-2"><Component1Icon className="text-emerald-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">CPU核心:</span><span className="text-slate-700 dark:text-slate-300">{agent.cpu_cores}</span></div>}
              {(agent.load1 != null) && <div className="flex items-center gap-2"><ActivityLogIcon className="text-rose-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">负载:</span><span className="text-slate-700 dark:text-slate-300 truncate">{[agent.load1, agent.load5, agent.load15].map(v => v?.toFixed(2) ?? '-').join(' / ')}</span></div>}
              {/* Memory / Disk */}
              {agent.memory_total != null && <div className="flex items-center gap-2"><StackIcon className="text-blue-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">内存:</span><span className="text-slate-700 dark:text-slate-300">{formatSize(agent.memory_used || 0)} / {formatSize(agent.memory_total)}</span></div>}
              {agent.disk_total != null && <div className="flex items-center gap-2"><HardDrive size={14} className="text-red-500 shrink-0" /><span className="text-slate-500">磁盘:</span><span className="text-slate-700 dark:text-slate-300">{formatSize(agent.disk_used || 0)} / {formatSize(agent.disk_total)}</span></div>}

              {/* Network */}
              {agent.network_rx != null && <div className="flex items-center gap-2"><ArrowDownIcon className="text-cyan-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">↓下载:</span><span className="text-slate-700 dark:text-slate-300">{agent.network_rx.toFixed(0)} KB/s</span></div>}
              {agent.network_tx != null && <div className="flex items-center gap-2"><ArrowUpIcon className="text-indigo-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">↑上传:</span><span className="text-slate-700 dark:text-slate-300">{agent.network_tx.toFixed(0)} KB/s</span></div>}

              {/* Process / Connections */}
              {agent.process_count != null && <div className="flex items-center gap-2"><TargetIcon className="text-orange-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">进程:</span><span className="text-slate-700 dark:text-slate-300">{agent.process_count}</span></div>}
              {agent.tcp_count != null && <div className="flex items-center gap-2"><ArrowDownIcon className="text-blue-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">TCP:</span><span className="text-slate-700 dark:text-slate-300">{agent.tcp_count}</span></div>}
              {agent.udp_count != null && <div className="flex items-center gap-2"><ArrowUpIcon className="text-sky-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">UDP:</span><span className="text-slate-700 dark:text-slate-300">{agent.udp_count}</span></div>}

              {/* Agent */}
              {agent.agent_version && <div className="flex items-center gap-2"><CodeIcon className="text-purple-500 w-3.5 h-3.5 shrink-0" /><span className="text-slate-500">Agent:</span><span className="text-slate-700 dark:text-slate-300">{agent.agent_version}</span></div>}
            </div>
            {(agent.network_rx_total != null || agent.network_tx_total != null) && (
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-white/5 text-[11px] text-slate-500 flex gap-4">
                {agent.network_rx_total != null && <span>总下载: {formatSize(agent.network_rx_total)}</span>}
                {agent.network_tx_total != null && <span>总上传: {formatSize(agent.network_tx_total)}</span>}
              </div>
            )}
          </div>

          {/* Agent metrics history charts — full width below */}
          {agent.id && <AgentCharts agentId={agent.id} />}
        </div>
      </div>
    </div>
  );
}
