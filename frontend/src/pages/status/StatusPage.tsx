import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStatusPageData, StatusAgent } from '../../api/status';
import { Monitor } from '../../api/monitors';
import AgentCard from '../../components/AgentCard';
import AgentDetailModal from '../../components/AgentDetailModal';
import MonitorCard from '../../components/MonitorCard';
import MonitorDetailModal from '../../components/MonitorDetailModal';
import LoadingSpinner from '../../components/LoadingSpinner';
import CustomInjector from '../../components/CustomInjector';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import LanguageSelector from "../../components/LanguageSelector";
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { LayoutGrid, Rows3, List, Server, Activity, CheckCircle, XCircle, Box, Globe, ArrowUp } from 'lucide-react';
import { ENV_API_BASE_URL } from '../../config';
import { useTranslation } from 'react-i18next';

const CARD_SIZE_KEY = 'qltz_agent_card_size';
const TAB_KEY = 'qltz_status_tab';

const StatusPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>(
    () => (localStorage.getItem(CARD_SIZE_KEY) as 'small' | 'medium' | 'large') || 'large'
  );
  const [activeTab, setActiveTab] = useState<'agents' | 'monitors'>(
    () => (localStorage.getItem(TAB_KEY) as 'agents' | 'monitors') || 'agents'
  );
  const [data, setData] = useState<{ title: string; description: string; logoUrl: string; customCss: string; monitors: Monitor[]; agents: StatusAgent[] }>({ title: '系统状态', description: '', logoUrl: '', customCss: '', monitors: [], agents: [] });
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<StatusAgent | null>(null);
  const [selectedMonitor, setSelectedMonitor] = useState<Monitor | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [monitorsLoading, setMonitorsLoading] = useState(false);

  // Track if monitors have been loaded at least once for the fade-in
  const monitorsLoadedRef = useRef(false);

  // Universal fetch (summary + current tab)
  const fetchData = async () => {
    try {
      const res = await getStatusPageData();
      if (res.success && res.data) {
        setError(null);
        setData(prev => ({
          title: res.data!.title || prev.title,
          description: res.data!.description || prev.description,
          logoUrl: res.data!.logoUrl || prev.logoUrl,
          customCss: res.data!.customCss || prev.customCss,
          agents: res.data!.agents || prev.agents,
          monitors: activeTab === 'monitors' ? (res.data!.monitors || prev.monitors) : prev.monitors,
        }));
      } else if (!fetched) {
        setError(res.message || t('statusPage.fetchError'));
      }
    } catch (err: any) {
      if (!fetched) setError(t('statusPage.fetchError'));
    } finally {
      setFetched(true);
    }
  };

  // Extra monitor-only fetch (only when monitors tab is active)
  const fetchMonitors = async () => {
    setMonitorsLoading(true);
    try {
      const res = await getStatusPageData();
      if (res.success && res.data?.monitors) {
        setData(prev => ({ ...prev, monitors: res.data!.monitors! }));
        monitorsLoadedRef.current = true;
      }
    } catch { /* ignore */ }
    finally { setMonitorsLoading(false); }
  };

  // Main effect: initial fetch + SSE + polling
  useEffect(() => {
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

    const sseTimeout = setTimeout(() => { es.close(); }, 30 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(sseTimeout);
      es.close();
    };
  }, []);

  // Monitors tab: fetch monitors data when tab becomes active
  useEffect(() => {
    if (activeTab === 'monitors') {
      fetchMonitors();
    }
  }, [activeTab]);

  // Tab switch handler
  const switchTab = (tab: 'agents' | 'monitors') => {
    setActiveTab(tab);
    localStorage.setItem(TAB_KEY, tab);
  };

  // Dynamically set browser title and favicon from config
  useEffect(() => {
    document.title = data.title || '系统状态';
    if (data.logoUrl) {
      let link = document.querySelector('link[rel="icon"][data-custom]') as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        link.setAttribute('data-custom', '1');
        document.head.appendChild(link);
      }
      link.href = data.logoUrl;
    }
    localStorage.setItem('qltz_page_config', JSON.stringify({ title: data.title, logoUrl: data.logoUrl }));
  }, [data.title, data.logoUrl]);

  // Search filter — matches both agents and monitors
  const filteredAgents = data.agents.filter(a => {
    if (categoryFilter && a.category !== categoryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [a.name, a.hostname, a.os, a.tags].join(' ').toLowerCase().includes(q);
  });

  const filteredMonitors = data.monitors.filter(m => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return [m.name, m.tags].join(' ').toLowerCase().includes(q);
  });

  // Summary stats
  const agents = data.agents || [];
  const monitors = data.monitors || [];
  const totalRx = agents.reduce((s: number, a: any) => s + (a.network_rx_total || 0), 0);
  const totalTx = agents.reduce((s: number, a: any) => s + (a.network_tx_total || 0), 0);
  const fmt = (bytes: number) => { if (!bytes) return '0 B'; const u = ['B','KB','MB','GB','TB']; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return v.toFixed(1)+' '+u[i]; };
  const online = agents.filter((a: any) => a.status === 'active').length;
  const offline = agents.length - online;
  const regions = [...new Set(agents.map((a: any) => a.country).filter(Boolean))].length;
  const upMonitors = monitors.filter((m: any) => m.status === 'up').length;
  const cats = [...new Set(agents.map(a => a.category).filter(Boolean))] as string[];
  const catCounts: Record<string, number> = {};
  cats.forEach(c => { catCounts[c] = agents.filter(a => a.category === c).length; });

  if (error) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-red-500">{error}</span></div>;
  if (!fetched) return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>;

  return (
    <div>
      {data.customCss && <CustomInjector code={data.customCss} />}
      {/* Top bar */}
      <nav className="sticky top-0 z-50 w-full bg-white/[0.85] dark:bg-[#0f0f1a]/[0.85] backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 h-[54px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <Box className="w-3.5 h-3.5 text-white" />
              </div>
            )}
            <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{data.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
              {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>
            <button onClick={() => navigate(isAuthenticated ? '/agents' : '/login')}
              className="btn-gradient text-sm px-4 py-2">
              {isAuthenticated ? t('navbar.dashboard') : t('navbar.login')}
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto px-4 pt-6 pb-16">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {[
            { label: '服务器', value: agents.length, bg: 'bg-blue-500/10', text: 'text-blue-600', icon: <Server size={16} /> },
            { label: '在线', value: online, bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: <CheckCircle size={16} /> },
            { label: '离线', value: offline, bg: 'bg-slate-500/10', text: 'text-slate-500', icon: <XCircle size={16} /> },
            { label: '地区', value: regions, bg: 'bg-purple-500/10', text: 'text-purple-600', icon: <Globe size={16} /> },
            { label: '服务', value: `${upMonitors}/${monitors.length}`, bg: 'bg-amber-500/10', text: 'text-amber-600', icon: <Activity size={16} /> },
            { label: '总流量', value: fmt(totalTx + totalRx), sub: `↑${fmt(totalTx)}  ↓${fmt(totalRx)}`, bg: 'bg-orange-500/10', text: 'text-orange-600', icon: <ArrowUp size={16} /> },
          ].map((card, i) => (
            <div key={i} className="glass rounded-xl p-3 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.text} flex items-center justify-center flex-shrink-0`}>
                {card.icon}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-slate-500 truncate">{card.label}</div>
                <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{card.value}</div>
                {(card as any).sub && <div className="text-[10px] text-slate-400 truncate">{(card as any).sub}</div>}
              </div>
            </div>
          ))}
        </div>

        {/* Search bar */}
        <div className="mb-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 6.5C10 8.433 8.433 10 6.5 10C4.567 10 3 8.433 3 6.5C3 4.567 4.567 3 6.5 3C8.433 3 10 4.567 10 6.5ZM9.30884 10.0159C8.53901 10.6318 7.56251 11 6.5 11C4.01472 11 2 8.98528 2 6.5C2 4.01472 4.01472 2 6.5 2C8.98528 2 11 4.01472 11 6.5C11 7.56251 10.6318 8.53901 10.0159 9.30884L12.8536 12.1464C13.0488 12.3417 13.0488 12.6583 12.8536 12.8536C12.6583 13.0488 12.3417 13.0488 12.1464 12.8536L9.30884 10.0159Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"/></svg>
          </span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索服务器、API服务、标签..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border-2 border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm" />
        </div>

        {/* Tab switcher */}
        <div className="flex justify-center mb-5">
          <div className="relative flex gap-1 bg-slate-200 dark:bg-white/[0.08] rounded-xl p-1">
            <div className={`absolute top-1 bottom-1 rounded-lg bg-white dark:bg-slate-700 shadow-sm transition-all duration-300 ease-in-out ${
              activeTab === 'agents'
                ? 'left-1 right-[50%]'
                : 'left-[50%] right-1'
            }`} />
            <button
              onClick={() => switchTab('agents')}
              className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                activeTab === 'agents'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Server size={15} />
              服务器状态
            </button>
            <button
              onClick={() => switchTab('monitors')}
              className={`relative z-10 flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
                activeTab === 'monitors'
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Activity size={15} />
              API服务状态
            </button>
          </div>
        </div>

        {/* ── 服务器状态 tab ── */}
        {activeTab === 'agents' && (
          <section>
            <div className="flex justify-end items-center mb-4">
              {/* Card size toggle */}
              <div className="flex items-center bg-slate-200 dark:bg-slate-700 rounded-lg p-0.5">
                {(['small', 'medium', 'large'] as const).map((s) => {
                  const Icon = s === 'small' ? List : s === 'medium' ? Rows3 : LayoutGrid;
                  return (
                    <button key={s}
                      onClick={() => { setCardSize(s); localStorage.setItem(CARD_SIZE_KEY, s); }}
                      className={`p-1.5 rounded-md transition-colors ${cardSize === s ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                      title={s === 'small' ? '小卡片' : s === 'medium' ? '中卡片' : '大卡片'}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category filter */}
            {cats.length > 0 && (
              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={() => setCategoryFilter('')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!categoryFilter ? 'bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-white/5'}`}>
                  全部 <span className="text-[10px] opacity-60">{agents.length}</span>
                </button>
                {cats.map(cat => (
                  <button key={cat} onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-white/5'}`}>
                    {cat} <span className="text-[10px] opacity-60">{catCounts[cat]}</span>
                  </button>
                ))}
              </div>
            )}

            {filteredAgents.length === 0 ? (
              <div className="glass p-8 text-center"><p className="text-sm text-slate-500">没有匹配的客户端</p></div>
            ) : (
              <div className={`${
                cardSize === 'small' ? 'flex flex-col gap-2 overflow-x-scroll scrollbar-hidden' :
                cardSize === 'large' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' :
                'grid grid-cols-1 lg:grid-cols-2 gap-2'
              }`}>
                {filteredAgents.map(agent => (
                  <AgentCard key={agent.id} agent={agent} size={cardSize} onClick={() => setSelectedAgent(agent)} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── API服务状态 tab ── */}
        {activeTab === 'monitors' && (
          <section>
            {monitorsLoading && !monitorsLoadedRef.current ? (
              <div className="flex justify-center py-12"><LoadingSpinner size="sm" /></div>
            ) : filteredMonitors.length === 0 ? (
              <div className="glass p-8 text-center"><p className="text-sm text-slate-500">没有匹配的API服务</p></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredMonitors.map(m => (
                  <MonitorCard key={m.id} monitor={m} onClick={() => setSelectedMonitor(m)} />
                ))}
              </div>
            )}
          </section>
        )}

      {selectedAgent && (
        <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
      {selectedMonitor && (
        <MonitorDetailModal monitorId={selectedMonitor.id} monitorName={selectedMonitor.name} onClose={() => setSelectedMonitor(null)} />
      )}
    </div>
    </div>
  );
};

export default StatusPage;
