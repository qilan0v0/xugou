import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusPageData, StatusAgent } from '../../api/status';
import { Monitor } from '../../api/monitors';
import AgentCard from '../../components/AgentCard';
import AgentDetailModal from '../../components/AgentDetailModal';
import MonitorCard from '../../components/MonitorCard';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import LanguageSelector from "../../components/LanguageSelector";
import { SunIcon, MoonIcon, CubeIcon, CheckCircledIcon, CrossCircledIcon, GlobeIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { ENV_API_BASE_URL } from '../../config';
import { useTranslation } from 'react-i18next';

const StatusPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<{ monitors: Monitor[], agents: StatusAgent[] }>({ monitors: [], agents: [] });
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<StatusAgent | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await getStatusPageData();
        if (res.success && res.data) {
          setData({ monitors: res.data.monitors || [], agents: res.data.agents || [] });
        } else {
          setError(res.message || t('statusPage.fetchError'));
        }
      } catch (err: any) {
        setError(t('statusPage.fetchError'));
      } finally {
        setFetched(true);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);

    let sseDebounce: any = null;
    const es = new EventSource((ENV_API_BASE_URL || '') + '/api/events');
    const refresh = () => {
      if (sseDebounce) clearTimeout(sseDebounce);
      sseDebounce = setTimeout(() => fetchData(), 300);
    };
    es.addEventListener('agent-update', refresh);
    es.addEventListener('monitor-update', refresh);

    return () => {
      clearInterval(interval);
      es.close();
    };
  }, []);

  if (error) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-red-500">{error}</span></div>;
  if (!fetched) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;

  return (
    <div>
      {/* Top bar */}
      <nav className="sticky top-0 z-50 w-full bg-white/[0.85] dark:bg-[#0f0f1a]/[0.85] backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 h-[54px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <CubeIcon className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">XUGOU</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
              {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
              className="btn-gradient text-sm px-4 py-2">
              {isAuthenticated ? t('navbar.dashboard') : t('navbar.login')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 pb-16">
        {/* Summary cards */}
        {(() => {
          const agents = data.agents || [];
          const monitors = data.monitors || [];
          const totalRx = agents.reduce((s: number, a: any) => s + (a.network_rx_total || 0), 0);
          const totalTx = agents.reduce((s: number, a: any) => s + (a.network_tx_total || 0), 0);
          const fmt = (bytes: number) => { if (!bytes) return '0 B'; const u = ['B','KB','MB','GB','TB']; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return v.toFixed(1)+' '+u[i]; };
          const online = agents.filter((a: any) => a.status === 'active').length;
          const offline = agents.length - online;
          const regions = [...new Set(agents.map((a: any) => a.country).filter(Boolean))].length;
          const upMonitors = monitors.filter((m: any) => m.status === 'up').length;
          const cards = [
            { label: '服务器', value: agents.length, bg: 'bg-blue-500/10', text: 'text-blue-600', icon: <CubeIcon /> },
            { label: '在线', value: online, bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: <CheckCircledIcon /> },
            { label: '离线', value: offline, bg: 'bg-slate-500/10', text: 'text-slate-500', icon: <CrossCircledIcon /> },
            { label: '地区', value: regions, bg: 'bg-purple-500/10', text: 'text-purple-600', icon: <GlobeIcon /> },
            { label: '服务', value: `${upMonitors}/${monitors.length}`, bg: 'bg-amber-500/10', text: 'text-amber-600', icon: <CheckCircledIcon /> },
            { label: '总流量', value: fmt(totalTx + totalRx), sub: `↑${fmt(totalTx)}  ↓${fmt(totalRx)}`, bg: 'bg-orange-500/10', text: 'text-orange-600', icon: <ArrowUpIcon /> },
          ];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {cards.map((card: any, i: number) => (
                <div key={i} className="glass rounded-xl p-3 flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.text} flex items-center justify-center flex-shrink-0`}>
                    {card.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-500 truncate">{card.label}</div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{card.value}</div>
                    {card.sub && <div className="text-[10px] text-slate-400 truncate">{card.sub}</div>}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {data.monitors.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white section-heading mb-4">{t('statusPage.apiServices')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.monitors.map(m => <MonitorCard key={m.id} monitor={m} />)}
            </div>
          </section>
        )}

        {data.agents.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white section-heading mb-4">{t('statusPage.agentStatus')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} onClick={() => setSelectedAgent(agent)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {selectedAgent && (
        <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
};

export default StatusPage;
