import { useState, useEffect, useRef } from 'react';
import { EyeOpenIcon, CopyIcon, CheckIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getAllMonitors, Monitor } from '../../api/monitors';
import { getAllAgents, Agent } from '../../api/agents';
import { getStatusPageConfig, saveStatusPageConfig, StatusPageConfig as StatusConfig, StatusPageConfigResponse } from '../../api/status';
import { useTranslation } from 'react-i18next';

interface MonitorWithSelection extends Monitor { selected: boolean; }
interface AgentWithSelection extends Agent { selected: boolean; }
interface StatusConfigWithDetails {
  title: string; description: string; logoUrl: string; customCss: string; publicUrl: string;
  monitors: MonitorWithSelection[]; agents: AgentWithSelection[];
}

const StatusPageConfig = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState('general');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [notifyDown, setNotifyDown] = useState(true);
  const [notifyUp, setNotifyUp] = useState(true);
  const hasInit = useRef(false);
  const { t } = useTranslation();

  const [config, setConfig] = useState<StatusConfigWithDetails>({
    title: t('statusPage.title'), description: t('statusPage.allOperational'), logoUrl: '', customCss: '',
    publicUrl: window.location.origin + '/status', monitors: [], agents: []
  });

  useEffect(() => {
    if (hasInit.current) return; hasInit.current = true;
    setLoading(true);
    (async () => {
      try {
        const configRes = await getStatusPageConfig();
        let configData: StatusPageConfigResponse | null = null;
        if (configRes?.config) configData = configRes.config;
        else if (configRes && 'monitors' in configRes && Array.isArray((configRes as any).monitors)) configData = configRes as unknown as StatusPageConfigResponse;

        const [monRes, agentRes] = await Promise.all([getAllMonitors(), getAllAgents()]);
        const monitors: MonitorWithSelection[] = (monRes.monitors || []).map(m => ({
          ...m, selected: configData?.monitors?.find((cm: any) => cm.id === m.id)?.selected === true
        }));
        const agents: AgentWithSelection[] = (agentRes.agents || []).map((a: Agent) => ({
          ...a, selected: configData?.agents?.find((ca: any) => ca.id === a.id)?.selected === true
        }));
        setConfig(prev => ({
          ...prev,
          title: configData?.title || t('statusPage.title'),
          description: configData?.description || t('statusPage.allOperational'),
          logoUrl: configData?.logoUrl || '', customCss: configData?.customCss || '',
          monitors, agents
        }));
      } catch (err) { setError(t('statusPageConfig.fetchDataError')); }
      finally { setLoading(false); }
    })();
  }, [t]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setConfig(prev => ({ ...prev, [name]: value }));
  };

  const toggleMonitor = (id: number) => setConfig(prev => ({
    ...prev, monitors: prev.monitors.map(m => m.id === id ? { ...m, selected: !m.selected } : m)
  }));
  const toggleAgent = (id: number) => setConfig(prev => ({
    ...prev, agents: prev.agents.map(a => a.id === id ? { ...a, selected: !a.selected } : a)
  }));

  const handleCopyUrl = () => { navigator.clipboard.writeText(config.publicUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave: StatusConfig = {
        title: config.title, description: config.description, logoUrl: config.logoUrl, customCss: config.customCss,
        monitors: config.monitors.filter(m => m.selected).map(m => m.id),
        agents: config.agents.filter(a => a.selected).map(a => a.id)
      };
      const res = await saveStatusPageConfig(toSave);
      if (res.success) { setToastMsg(t('statusPageConfig.configSaved')); setToastType('success'); }
      else { setToastMsg(res.message || t('statusPageConfig.saveError')); setToastType('error'); }
    } catch { setToastMsg(t('statusPageConfig.saveError')); setToastType('error'); }
    finally { setSaving(false); setShowToast(true); setTimeout(() => setShowToast(false), 3000); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;
  if (error) return <div className="flex justify-center items-center min-h-[50vh] gap-3"><span className="text-red-500">{error}</span><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('common.retry')}</button></div>;

  const tabs = [
    { key: 'general', label: t('statusPageConfig.general') },
    { key: 'services', label: t('statusPageConfig.services') },
    { key: 'agents', label: t('statusPageConfig.agents') },
    { key: 'notifications', label: t('statusPageConfig.notifications') },
    { key: 'appearance', label: t('statusPageConfig.appearance') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('statusPageConfig.title')}</h1>
        <div className="flex gap-3">
          <button onClick={() => window.open('/status', '_blank')} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            <EyeOpenIcon />{t('statusPageConfig.preview')}
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-gradient px-5 py-2 text-sm flex items-center gap-1.5 disabled:opacity-60">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t('common.savingChanges')}</>
            ) : (
              <><CheckIcon />{t('statusPageConfig.save')}</>
            )}
          </button>
        </div>
      </div>

      <div className="glass overflow-hidden">
        <div className="flex border-b border-white/[0.06]">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                tab === t.key ? 'text-blue-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}>
              {t.label}
              {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full" />}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === 'general' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.pageTitle')}</label>
                <input name="title" value={config.title} onChange={handleChange} placeholder={t('statusPageConfig.pageTitlePlaceholder')} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.pageDescription')}</label>
                <textarea name="description" value={config.description} onChange={handleChange} placeholder={t('statusPageConfig.pageDescriptionPlaceholder')} className={inputClass} rows={3} style={{ minHeight: '80px' }} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.publicUrl')}</label>
                <div className="flex gap-2">
                  <input value={config.publicUrl} readOnly className={`${inputClass} flex-1 text-slate-500 cursor-default`} />
                  <button onClick={handleCopyUrl} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors flex-shrink-0">
                    {copied ? <CheckIcon /> : <CopyIcon />}{copied ? t('common.copied') : t('common.copy')}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">{t('statusPageConfig.publicUrlHelp')}</p>
              </div>
            </div>
          )}

          {tab === 'services' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">{t('statusPageConfig.selectServicesPrompt')}</p>
              {config.monitors.length === 0 ? (
                <p className="text-slate-500">{t('monitors.noMonitors')}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {config.monitors.map(m => (
                    <label key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{m.name}</span>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        m.selected ? 'bg-blue-500 border-blue-500' : 'border-slate-400'
                      }`}>
                        {m.selected && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <input type="checkbox" checked={m.selected} onChange={() => toggleMonitor(m.id)} className="sr-only" />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'agents' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">{t('statusPageConfig.selectAgentsPrompt')}</p>
              {config.agents.length === 0 ? (
                <p className="text-slate-500">{t('agents.noAgents')}</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {config.agents.map(a => (
                    <label key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                      <span className="text-sm text-slate-700 dark:text-slate-300">{a.name}</span>
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        a.selected ? 'bg-blue-500 border-blue-500' : 'border-slate-400'
                      }`}>
                        {a.selected && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                      </span>
                      <input type="checkbox" checked={a.selected} onChange={() => toggleAgent(a.id)} className="sr-only" />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'notifications' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.webhookUrl')}</label>
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/..." className={inputClass} />
                <p className="text-xs text-slate-500 mt-1">{t('statusPageConfig.webhookHint')}</p>
              </div>
              <div className="flex flex-col gap-3">
                <label className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{t('statusPageConfig.notifyOnDown')}</span>
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${notifyDown ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
                    {notifyDown && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                  </span>
                  <input type="checkbox" checked={notifyDown} onChange={() => setNotifyDown(!notifyDown)} className="sr-only" />
                </label>
                <label className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                  <span className="text-sm text-slate-700 dark:text-slate-300">{t('statusPageConfig.notifyOnUp')}</span>
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${notifyUp ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
                    {notifyUp && <CheckIcon className="w-3.5 h-3.5 text-white" />}
                  </span>
                  <input type="checkbox" checked={notifyUp} onChange={() => setNotifyUp(!notifyUp)} className="sr-only" />
                </label>
              </div>
            </div>
          )}

          {tab === 'appearance' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.logoUrl')}</label>
                <input name="logoUrl" value={config.logoUrl} onChange={handleChange} placeholder={t('statusPageConfig.logoUrlPlaceholder')} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.customCss')}</label>
                <textarea name="customCss" value={config.customCss} onChange={handleChange} placeholder={t('statusPageConfig.customCssPlaceholder')} className={`${inputClass} font-mono`} rows={6} style={{ minHeight: '150px' }} />
                <p className="text-xs text-slate-500 mt-1">{t('statusPageConfig.customCssHelp')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Toast.Provider>
        <Toast.Root open={showToast} onOpenChange={setShowToast} duration={3000}
          className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-slide-up ${toastType === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <Toast.Title className="font-semibold">{toastType === 'success' ? t('common.success') : t('common.error')}</Toast.Title>
          <Toast.Description className="text-white/80 text-xs mt-0.5">{toastMsg}</Toast.Description>
          <Toast.Close className="absolute top-2 right-2 text-white/70 hover:text-white">×</Toast.Close>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>
    </div>
  );
};

export default StatusPageConfig;
