import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllMonitors, Monitor } from '../api/monitors';
import { getAllAgents, Agent } from '../api/agents';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CubeIcon, ActivityLogIcon, CrossCircledIcon,
  ExclamationTriangleIcon, ArrowRightIcon
} from '@radix-ui/react-icons';

const Dashboard = () => {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [monitorsRes, agentsRes] = await Promise.all([getAllMonitors(), getAllAgents()]);
        if (monitorsRes.success && monitorsRes.monitors) setMonitors(monitorsRes.monitors);
        if (agentsRes.success && agentsRes.agents) setAgents(agentsRes.agents);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const onlineAgents = agents.filter(a => a.status === 'active').length;
  const offlineAgents = agents.filter(a => a.status !== 'active').length;
  const upMonitors = monitors.filter(m => m.status === 'up').length;
  const downMonitors = monitors.filter(m => m.status === 'down').length;

  const stats = [
    {
      label: '在线探针',
      value: onlineAgents,
      total: agents.length,
      icon: <CubeIcon className="w-5 h-5" />,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      link: '/agents',
    },
    {
      label: 'API 监控正常',
      value: upMonitors,
      total: monitors.length,
      icon: <ActivityLogIcon className="w-5 h-5" />,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      link: '/monitors',
    },
    {
      label: '离线探针',
      value: offlineAgents,
      total: agents.length,
      icon: <ExclamationTriangleIcon className="w-5 h-5" />,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      link: '/agents',
    },
    {
      label: 'API 故障',
      value: downMonitors,
      total: monitors.length,
      icon: <CrossCircledIcon className="w-5 h-5" />,
      color: 'text-red-600 dark:text-red-400',
      bg: 'bg-red-50 dark:bg-red-500/10',
      link: '/monitors',
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">控制台</h1>
        <p className="text-sm text-slate-500 mt-1">监控系统运行状态概览</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <Link key={i} to={stat.link}
            className="block bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 transition-all no-underline group"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
              <ArrowRightIcon className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 transition-colors" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-bold text-slate-900 dark:text-white">{stat.value}</span>
              <span className="text-sm text-slate-400">/ {stat.total}</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Recent agents */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">探针状态</h2>
            <Link to="/agents" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">查看全部</Link>
          </div>
          <div className="p-5">
            {agents.length === 0 ? (
              <div className="text-center py-8">
                <CubeIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">暂无探针</p>
                <Link to="/agents/create" className="text-xs text-blue-600 hover:underline mt-1 inline-block">添加第一个探针</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {agents.slice(0, 8).map(agent => (
                  <Link key={agent.id} to={`/agents/${agent.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors no-underline"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      agent.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`} />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{agent.name || agent.hostname || `Agent #${agent.id}`}</span>
                    <span className="text-xs text-slate-500">{agent.os ? agent.os.split(' ')[0] : ''}</span>
                    <span className={`text-xs font-medium ${
                      agent.status === 'active' ? 'text-emerald-600' : 'text-slate-500'
                    }`}>
                      {agent.status === 'active' ? '在线' : '离线'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent monitors */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700/50">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">API 监控状态</h2>
            <Link to="/monitors" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">查看全部</Link>
          </div>
          <div className="p-5">
            {monitors.length === 0 ? (
              <div className="text-center py-8">
                <ActivityLogIcon className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                <p className="text-sm text-slate-500">暂无监控</p>
                <Link to="/monitors/create" className="text-xs text-blue-600 hover:underline mt-1 inline-block">添加第一个监控</Link>
              </div>
            ) : (
              <div className="space-y-2">
                {monitors.slice(0, 8).map(monitor => (
                  <Link key={monitor.id} to={`/monitors/${monitor.id}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors no-underline"
                  >
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      monitor.status === 'up' ? 'bg-emerald-500' :
                      monitor.status === 'down' ? 'bg-red-500' : 'bg-amber-500'
                    }`} />
                    <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{monitor.name}</span>
                    <span className="text-xs text-slate-500">{monitor.url?.replace(/^https?:\/\//, '').split('/')[0]}</span>
                    <span className={`text-xs font-medium ${
                      monitor.status === 'up' ? 'text-emerald-600' :
                      monitor.status === 'down' ? 'text-red-500' : 'text-amber-600'
                    }`}>
                      {monitor.status === 'up' ? '正常' : monitor.status === 'down' ? '故障' : '待检'}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;