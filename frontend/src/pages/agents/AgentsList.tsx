import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon, Cross2Icon, Pencil1Icon, InfoCircledIcon, ReloadIcon, LayoutIcon, ViewGridIcon, CubeIcon, CheckCircledIcon, CrossCircledIcon, GlobeIcon, ArrowUpIcon } from '@radix-ui/react-icons';
import { getAllAgents, deleteAgent, Agent } from '../../api/agents';
import AgentCard from '../../components/AgentCard';
import { ENV_API_BASE_URL } from '../../config';
import { useTranslation } from 'react-i18next';

interface ClientWithStatus extends Agent {
  status?: 'active' | 'inactive' | 'connecting';
}

const AgentsList = () => {
  const navigate = useNavigate();
  const [agents, setAgents] = useState<ClientWithStatus[]>([]);
  const [fetched, setFetched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [categoryFilter, setCategoryFilter] = useState('');
  const { t } = useTranslation();

  const fetchAgents = async () => {
    setError(null);
    try {
      const response = await getAllAgents();
      if (!response.success || !response.agents) throw new Error(response.message || t('common.error.fetch'));
      setAgents(response.agents.map((a: Agent) => ({
        ...a,
        status: (a.status === 'active' || a.status === 'connecting') ? a.status as 'active' | 'connecting' : 'inactive'
      })));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error.fetch'));
    } finally {
      setFetched(true);
    }
  };

  useEffect(() => {
    fetchAgents();
    const i = setInterval(fetchAgents, 60000);

    let sseDebounce: any = null;
    const es = new EventSource((ENV_API_BASE_URL || '') + '/api/events');
    es.addEventListener('agent-update', () => {
      if (sseDebounce) clearTimeout(sseDebounce);
      sseDebounce = setTimeout(() => fetchAgents(), 5000);
    });
    es.addEventListener('monitor-update', () => {
      if (sseDebounce) clearTimeout(sseDebounce);
      sseDebounce = setTimeout(() => fetchAgents(), 5000);
    });

    return () => { clearInterval(i); es.close(); };
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const r = await deleteAgent(deleteId);
      if (r.success) fetchAgents();
      else setError(r.message || t('common.error.delete'));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error.delete'));
    } finally { setDeleteId(null); }
  };

  const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
    active: { bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500 animate-pulse-dot shadow-[0_0_6px_rgba(34,197,94,0.6)]' },
    connecting: { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
    inactive: { bg: 'bg-slate-500/10', text: 'text-slate-500', dot: 'bg-slate-400' },
  };

  if (!fetched) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (error) return <div className="max-w-[1400px] mx-auto px-4 py-8"><div className="glass p-4 mb-4 border-l-4 border-red-500"><span className="text-red-500">{error}</span></div><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('common.retry')}</button></div>;

  const totalRx = agents.reduce((s, a) => s + (a.network_rx_total || 0), 0);
  const totalTx = agents.reduce((s, a) => s + (a.network_tx_total || 0), 0);
  const formatBytes = (bytes: number) => { if (!bytes) return '0 B'; const u = ['B','KB','MB','GB','TB']; let i=0,v=bytes; while(v>=1024&&i<u.length-1){v/=1024;i++;} return v.toFixed(1)+' '+u[i]; };
  const online = agents.filter(a => a.status === 'active').length;
  const offline = agents.length - online;
  const regions = [...new Set(agents.map(a => a.country).filter(Boolean))].length;

  const summaryCards = [
    { label: '服务器总数', value: agents.length, bg: 'bg-blue-500/10', text: 'text-blue-600', icon: <CubeIcon /> },
    { label: '在线', value: online, bg: 'bg-emerald-500/10', text: 'text-emerald-600', icon: <CheckCircledIcon /> },
    { label: '离线', value: offline, bg: 'bg-slate-500/10', text: 'text-slate-500', icon: <CrossCircledIcon /> },
    { label: '地区', value: regions, bg: 'bg-purple-500/10', text: 'text-purple-600', icon: <GlobeIcon /> },
    { label: '总流量', value: formatBytes(totalTx + totalRx), sub: `↑${formatBytes(totalTx)}  ↓${formatBytes(totalRx)}`, bg: 'bg-orange-500/10', text: 'text-orange-600', icon: <ArrowUpIcon /> },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agents.pageTitle')}</h1>
        <div className="flex items-center gap-3">
          <button onClick={fetchAgents} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"><ReloadIcon />{t('common.refresh')}</button>
          <div className="flex rounded-lg bg-slate-100 dark:bg-white/5 p-0.5">
            <button onClick={() => setViewMode('card')} className={`p-2 rounded-md transition-colors ${viewMode === 'card' ? 'bg-white dark:bg-white/10 shadow-sm text-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><ViewGridIcon /></button>
            <button onClick={() => setViewMode('table')} className={`p-2 rounded-md transition-colors ${viewMode === 'table' ? 'bg-white dark:bg-white/10 shadow-sm text-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}><LayoutIcon /></button>
          </div>
          <button onClick={() => navigate('/agents/create')} className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-sm"><PlusIcon />{t('agents.create')}</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {summaryCards.map((card, i) => (
          <div key={i} className="glass rounded-xl p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${card.bg} ${card.text} flex items-center justify-center flex-shrink-0`}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500 truncate">{card.label}</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white truncate">{card.value}</div>
              {'sub' in card && (card as any).sub && <div className="text-[10px] text-slate-400 truncate mt-0.5">{(card as any).sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Search + Category bar */}
      <div className="flex gap-3 mb-4">
        <input
          type="text" placeholder="搜索名称、主机名、IP、标签..."
          className="flex-1 px-4 py-2.5 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
        />
      </div>

      {/* Category filter */}
      {(() => {
        const cats = [...new Set(agents.map(a => a.category).filter(Boolean))] as string[];
        if (cats.length === 0) return null;
        return (
          <div className="flex gap-2 mb-4 flex-wrap">
            <button onClick={() => setCategoryFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!categoryFilter ? 'bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-white/5'}`}>
              全部
            </button>
            {cats.map(cat => (
              <button key={cat} onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${categoryFilter === cat ? 'bg-blue-500/10 text-blue-600' : 'text-slate-500 hover:text-slate-700 bg-slate-100 dark:bg-white/5'}`}>
                {cat}
              </button>
            ))}
          </div>
        );
      })()}

      {agents.filter(a => !categoryFilter || a.category === categoryFilter).length === 0 ? (
        <div className="glass p-8 text-center border-dashed">
          <p className="text-slate-500 mb-3">{t('agents.noAgents')}</p>
          <button onClick={() => navigate('/agents/create')} className="btn-gradient px-4 py-2 text-sm inline-flex items-center gap-1.5"><PlusIcon />{t('agents.create')}</button>
        </div>
      ) : viewMode === 'table' ? (
        <div className="glass overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.name')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.host')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.ip')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.status')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.os')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.version')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('agents.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {agents.filter(a => !categoryFilter || a.category === categoryFilter).map(a => {
                const cfg = statusConfig[a.status || 'inactive'] || statusConfig.inactive;
                const label = a.status === 'active' ? t('agent.status.online') : a.status === 'connecting' ? t('agent.status.connecting') : t('agent.status.offline');
                return (
                  <tr key={a.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{a.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.hostname || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.ip_address || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.os || '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{a.version || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => navigate(`/agents/${a.id}`)} className="p-1.5 rounded-md text-slate-500 hover:text-blue-500 hover:bg-blue-500/10 transition-colors"><InfoCircledIcon /></button>
                        <button onClick={() => navigate(`/agents/edit/${a.id}`)} className="p-1.5 rounded-md text-slate-500 hover:text-amber-500 hover:bg-amber-500/10 transition-colors"><Pencil1Icon /></button>
                        <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-md text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"><Cross2Icon /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.filter(a => !categoryFilter || a.category === categoryFilter).map(a => (
            <div key={a.id} className="relative group cursor-pointer" onClick={() => navigate(`/agents/${a.id}`)}>
              <AgentCard agent={a} />
              <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                <button onClick={() => navigate(`/agents/${a.id}`)} className="p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 hover:text-blue-500 transition-colors"><InfoCircledIcon className="w-3.5 h-3.5" /></button>
                <button onClick={() => navigate(`/agents/edit/${a.id}`)} className="p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 hover:text-amber-500 transition-colors"><Pencil1Icon className="w-3.5 h-3.5" /></button>
                <button onClick={() => setDeleteId(a.id)} className="p-1.5 rounded-md bg-white/80 dark:bg-slate-800/80 backdrop-blur text-slate-500 hover:text-red-500 transition-colors"><Cross2Icon className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Dialog */}
      {deleteId !== null && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setDeleteId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass p-6 w-full max-w-sm animate-scale-in">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('common.deleteConfirmation')}</h3>
            <p className="text-sm text-slate-500 mb-5">{t('common.deleteConfirmMessage')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors">{t('common.delete')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AgentsList;
