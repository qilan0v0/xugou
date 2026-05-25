import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllMonitors, Monitor } from '../api/monitors';
import { getAllAgents, Agent } from '../api/agents';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusSummaryCard from '../components/StatusSummaryCard';
import MonitorCard from '../components/MonitorCard';
import AgentCard from '../components/AgentCard';
import { useTranslation } from 'react-i18next';
import { CheckCircledIcon, CrossCircledIcon, ClockIcon, GlobeIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';
import { LayoutGrid, Rows3, List } from 'lucide-react';

const CARD_SIZE_KEY = 'xugou_agent_card_size';

const Dashboard = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cardSize, setCardSize] = useState<'small' | 'medium' | 'large'>(
    () => (localStorage.getItem(CARD_SIZE_KEY) as 'small' | 'medium' | 'large') || 'large'
  );
  const { t } = useTranslation();

  const toggleCardSize = (size: 'small' | 'medium' | 'large') => {
    setCardSize(size);
    localStorage.setItem(CARD_SIZE_KEY, size);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [monitorsRes, agentsRes] = await Promise.all([getAllMonitors(), getAllAgents()]);
        if (monitorsRes.success && monitorsRes.monitors) setMonitors(monitorsRes.monitors);
        if (agentsRes.success && agentsRes.agents) setAgents(agentsRes.agents);
      } catch (err) {
        setError(t('common.error'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [t]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <span className="text-red-500">{error}</span>
          <button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('dashboard.refresh')}</button>
        </div>
      </div>
    );
  }

  const apiMonitorItems = [
    { icon: <CheckCircledIcon className="w-4 h-4" />, label: t('monitors.status.up'), value: monitors.filter(m => m.status === 'up').length, bgColor: 'rgba(34,197,94,0.08)', iconColor: '#22c55e' },
    { icon: <CrossCircledIcon className="w-4 h-4" />, label: t('monitors.status.down'), value: monitors.filter(m => m.status === 'down').length, bgColor: 'rgba(239,68,68,0.08)', iconColor: '#ef4444' },
    { icon: <ClockIcon className="w-4 h-4" />, label: t('dashboard.totalMonitors'), value: monitors.length, bgColor: 'rgba(148,163,184,0.1)', iconColor: '#64748b' },
  ];

  const agentStatusItems = [
    { icon: <GlobeIcon className="w-4 h-4" />, label: t('agent.status.online'), value: agents.filter(a => a.status === 'active').length, bgColor: 'rgba(34,197,94,0.08)', iconColor: '#22c55e' },
    { icon: <ExclamationTriangleIcon className="w-4 h-4" />, label: t('agent.status.offline'), value: agents.filter(a => a.status === 'inactive').length, bgColor: 'rgba(245,158,11,0.08)', iconColor: '#f59e0b' },
    { icon: <GlobeIcon className="w-4 h-4" />, label: t('dashboard.totalMonitors'), value: agents.length, bgColor: 'rgba(148,163,184,0.1)', iconColor: '#64748b' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 animate-slide-up">
      {/* Summary */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">{t('dashboard.summary')}</h2>
        <p className="text-sm text-slate-500 mb-5">{t('dashboard.summary')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StatusSummaryCard title={t('navbar.apiMonitors')} items={apiMonitorItems} />
          <StatusSummaryCard title={t('navbar.agentMonitors')} items={agentStatusItems} />
        </div>
      </div>

      {/* API Monitors */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white section-heading">{t('navbar.apiMonitors')}</h3>
          <Link to="/monitors" className="text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors">{t('monitors.title')} →</Link>
        </div>
        {monitors.length === 0 ? (
          <div className="glass p-8 text-center border-dashed">
            <p className="text-sm text-slate-500 mb-3">{t('monitors.title')}</p>
            <Link to="/monitors/create" className="btn-gradient px-4 py-2 text-sm inline-block">{t('monitors.create')}</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitors.slice(0, 3).map(m => <MonitorCard key={m.id} monitor={m} />)}
          </div>
        )}
      </div>

      {/* Agents */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white section-heading">{t('navbar.agentMonitors')}</h3>
          <div className="flex items-center gap-2">
            {/* Card size toggle */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => toggleCardSize('small')}
                className={`p-1.5 rounded-md transition-colors ${cardSize === 'small' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="小卡片"
              >
                <List size={15} />
              </button>
              <button
                onClick={() => toggleCardSize('medium')}
                className={`p-1.5 rounded-md transition-colors ${cardSize === 'medium' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="中卡片"
              >
                <Rows3 size={15} />
              </button>
              <button
                onClick={() => toggleCardSize('large')}
                className={`p-1.5 rounded-md transition-colors ${cardSize === 'large' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                title="大卡片"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
            <Link to="/agents" className="text-sm text-blue-500 hover:text-blue-400 font-medium transition-colors">{t('agents.title')} →</Link>
          </div>
        </div>
        {agents.length === 0 ? (
          <div className="glass p-8 text-center border-dashed">
            <p className="text-sm text-slate-500 mb-3">{t('agents.title')}</p>
            <Link to="/agents/create" className="btn-gradient px-4 py-2 text-sm inline-block">{t('agents.create')}</Link>
          </div>
        ) : (
          <div className={`${
  cardSize === 'small' ? 'flex flex-col gap-2 overflow-x-auto' :
  cardSize === 'large' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' :
  'grid grid-cols-1 lg:grid-cols-2 gap-2'
}`}>
            {agents.slice(0, cardSize === 'small' ? 20 : cardSize === 'medium' ? 10 : 3).map(a => <AgentCard key={a.id} agent={a} size={cardSize} />)}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
