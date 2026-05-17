import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusPageData, StatusAgent } from '../../api/status';
import { Monitor } from '../../api/monitors';
import AgentCard from '../../components/AgentCard';
import MonitorCard from '../../components/MonitorCard';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { SunIcon, MoonIcon, CubeIcon, CheckCircledIcon, CrossCircledIcon, GlobeIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { useTranslation } from 'react-i18next';

const StatusPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [data, setData] = useState<{ monitors: Monitor[], agents: StatusAgent[] }>({ monitors: [], agents: [] });
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [pageTitle, setPageTitle] = useState(t('statusPage.title'));
  const [pageDescription, setPageDescription] = useState(t('statusPage.allOperational'));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (initialLoad) setLoading(true);
        const res = await getStatusPageData();
        if (res.success && res.data) {
          setPageTitle(res.data.title || t('statusPage.title'));
          setPageDescription(res.data.description || t('statusPage.allOperational'));
          setData({ monitors: res.data.monitors || [], agents: res.data.agents || [] });
        } else {
          setError(res.message || t('statusPage.fetchError'));
        }
      } catch (err: any) {
        setError(t('statusPage.fetchError'));
      } finally {
        if (initialLoad) { setLoading(false); setInitialLoad(false); }
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (error) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-red-500">{error}</span></div>;
  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;

  const allUp = data.monitors.every(m => m.status === 'up') && data.agents.every(a => a.status === 'active');

  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-radial from-blue-500/15 via-transparent to-transparent pointer-events-none" />
        {/* Top bar: theme + login */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button onClick={toggleTheme}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
            title={theme === 'dark' ? 'Light' : 'Dark'}>
            {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
          </button>
          <button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/login')}
            className="btn-gradient text-sm px-4 py-2">
            {isAuthenticated ? t('navbar.dashboard') : t('navbar.login')}
          </button>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 py-16 flex flex-col items-center gap-4 text-center">
          <span className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium ${
            allUp ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${allUp ? 'bg-emerald-500 animate-pulse-dot' : 'bg-amber-500'}`} />
            {allUp ? t('statusPage.allOperational') : t('statusPage.someIssues')}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white">{pageTitle}</h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl">{pageDescription}</p>
          <span className="text-xs text-slate-400 bg-slate-100 dark:bg-white/5 px-3 py-1 rounded-full">
            {t('statusPage.lastUpdated')}: {t('statusPage.justNow')}
          </span>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 pb-16">
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
            { label: t('statusPage.summary.servers'), value: agents.length, bg: 'bg-blue-500/10', text: 'text-blue-600', icon: <CubeIcon /> },
            { label: t('statusPage.summary.online'), value: online, bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: <CheckCircledIcon /> },
            { label: t('statusPage.summary.offline'), value: offline, bg: 'bg-slate-500/10', text: 'text-slate-500', icon: <CrossCircledIcon /> },
            { label: t('statusPage.summary.regions'), value: regions, bg: 'bg-purple-500/10', text: 'text-purple-600', icon: <GlobeIcon /> },
            { label: t('statusPage.summary.services'), value: `${upMonitors}/${monitors.length}`, bg: 'bg-amber-500/10', text: 'text-amber-600', icon: <CheckCircledIcon /> },
            { label: t('statusPage.summary.traffic'), value: fmt(totalTx + totalRx), sub: `↑${fmt(totalTx)}  ↓${fmt(totalRx)}`, bg: 'bg-orange-500/10', text: 'text-orange-600', icon: <ArrowUpIcon /> },
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.monitors.map(m => <MonitorCard key={m.id} monitor={m} />)}
            </div>
          </section>
        )}

        {data.agents.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white section-heading mb-4">{t('statusPage.agentStatus')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.agents.map(agent => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default StatusPage;
