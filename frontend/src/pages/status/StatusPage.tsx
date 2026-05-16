import { useState, useEffect, useRef } from 'react';
import { getStatusPageData, StatusAgent } from '../../api/status';
import { Monitor } from '../../api/monitors';
import AgentCard from '../../components/AgentCard';
import MonitorCard from '../../components/MonitorCard';
import { useTranslation } from 'react-i18next';

const StatusPage = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<{ monitors: Monitor[], agents: StatusAgent[] }>({ monitors: [], agents: [] });
  const [loading, setLoading] = useState(false);
  const [pageTitle, setPageTitle] = useState(t('statusPage.title'));
  const [pageDescription, setPageDescription] = useState(t('statusPage.allOperational'));
  const [error, setError] = useState<string | null>(null);
  const reqRef = useRef(false);
  const ctrlRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (reqRef.current && ctrlRef.current) ctrlRef.current.abort();
      reqRef.current = true;
      ctrlRef.current = new AbortController();
      const signal = ctrlRef.current.signal;
      try {
        setLoading(true);
        const res = await getStatusPageData();
        if (signal.aborted) return;
        if (res.success && res.data) {
          setPageTitle(res.data.title || t('statusPage.title'));
          setPageDescription(res.data.description || t('statusPage.allOperational'));
          setData({ monitors: res.data.monitors || [], agents: res.data.agents || [] });
        } else {
          setError(res.message || t('statusPage.fetchError'));
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') setError(t('statusPage.fetchError'));
      } finally {
        reqRef.current = false;
        ctrlRef.current = null;
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => { clearInterval(interval); if (ctrlRef.current) ctrlRef.current.abort(); };
  }, [t]);

  if (error) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-red-500">{error}</span></div>;
  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;

  const allUp = data.monitors.every(m => m.status === 'up') && data.agents.every(a => a.status === 'active');

  return (
    <div>
      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-radial from-blue-500/15 via-transparent to-transparent pointer-events-none" />
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
