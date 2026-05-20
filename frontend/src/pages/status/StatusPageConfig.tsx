import { useState, useEffect, useRef } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getAllMonitors, Monitor } from '../../api/monitors';
import { getAllAgents, Agent } from '../../api/agents';
import LoadingSpinner from '../../components/LoadingSpinner';
import { getStatusPageConfig, saveStatusPageConfig, StatusPageConfig as StatusConfig, StatusPageConfigResponse } from '../../api/status';
import { useTranslation } from 'react-i18next';

interface MonitorWithSelection extends Monitor { selected: boolean; }
interface AgentWithSelection extends Agent { selected: boolean; }
interface StatusConfigWithDetails {
  title: string; logoUrl: string; customCss: string;
  monitors: MonitorWithSelection[]; agents: AgentWithSelection[];
}

const StatusPageConfig = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const [tab, setTab] = useState('general');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookMethod, setWebhookMethod] = useState('POST');
  const [webhookContentType, setWebhookContentType] = useState('json');
  const [webhookBody, setWebhookBody] = useState('{"name":"{name}","status":"{status}","time":"{time}"}');
  const [webhookHeaders, setWebhookHeaders] = useState('');
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState('');
  const [webhookTls, setWebhookTls] = useState(true);
  const [notifyDown, setNotifyDown] = useState(true);
  const [notifyUp, setNotifyUp] = useState(true);
  const [adminCss, setAdminCss] = useState('');
  const hasInit = useRef(false);
  const { t } = useTranslation();

  const [config, setConfig] = useState<StatusConfigWithDetails>({
    title: t('statusPage.title'), logoUrl: '', customCss: '',
    monitors: [], agents: []
  });

  useEffect(() => {
    if (hasInit.current) return; hasInit.current = true;
    // Restore admin CSS + webhook settings from localStorage
    try {
      const c = JSON.parse(localStorage.getItem('xugou_page_config') || '{}');
      if (c.adminCss) setAdminCss(c.adminCss);
      if (c.webhookUrl) setWebhookUrl(c.webhookUrl);
      if (c.webhookMethod) setWebhookMethod(c.webhookMethod);
      if (c.webhookContentType) setWebhookContentType(c.webhookContentType);
      if (c.webhookBody) setWebhookBody(c.webhookBody);
      if (c.webhookHeaders) setWebhookHeaders(c.webhookHeaders);
      if (c.webhookTls !== undefined) setWebhookTls(c.webhookTls);
    } catch {}
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const toSave: StatusConfig = {
        title: config.title, description: '', logoUrl: config.logoUrl, customCss: config.customCss,
        monitors: config.monitors.filter(m => m.selected).map(m => m.id),
        agents: config.agents.filter(a => a.selected).map(a => a.id)
      };
      const res = await saveStatusPageConfig(toSave);
      if (res.success) {
        setToastMsg(t('statusPageConfig.configSaved')); setToastType('success');
        localStorage.setItem('xugou_page_config', JSON.stringify({
          title: config.title, logoUrl: config.logoUrl, adminCss,
          webhookUrl, webhookMethod, webhookContentType, webhookBody, webhookHeaders, webhookTls,
        }));
      }
      else { setToastMsg(res.message || t('statusPageConfig.saveError')); setToastType('error'); }
    } catch { setToastMsg(t('statusPageConfig.saveError')); setToastType('error'); }
    finally { setSaving(false); setShowToast(true); setTimeout(() => setShowToast(false), 3000); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>;
  if (error) return <div className="flex justify-center items-center min-h-[50vh] gap-3"><span className="text-red-500">{error}</span><button onClick={() => window.location.reload()} className="btn-gradient px-4 py-2 text-sm">{t('common.retry')}</button></div>;

  const tabs = [
    { key: 'general', label: t('statusPageConfig.general') },
    { key: 'notifications', label: t('statusPageConfig.notifications') },
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('statusPageConfig.title')}</h1>
        <div className="flex gap-3">
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
              {tab === t.key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-600 to-cyan-500 rounded-full" />}
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
                <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('statusPageConfig.logoUrl')}</label>
                <input name="logoUrl" value={config.logoUrl} onChange={handleChange} placeholder={t('statusPageConfig.logoUrlPlaceholder')} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">首页 CSS（公开状态页生效）</label>
                <textarea name="customCss" value={config.customCss} onChange={handleChange} placeholder={t('statusPageConfig.customCssPlaceholder')} className={`${inputClass} font-mono`} rows={6} style={{ minHeight: '150px' }} />
                <p className="text-xs text-slate-500 mt-1">支持 CSS + &lt;script&gt; 标签</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">后台 CSS（管理页面生效）</label>
                <textarea value={adminCss} onChange={e => setAdminCss(e.target.value)} placeholder="输入仅用于后台管理页面的自定义样式..." className={`${inputClass} font-mono`} rows={6} style={{ minHeight: '150px' }} />
                <p className="text-xs text-slate-500 mt-1">仪表盘、API监控、客户端监控等管理页面生效，同样支持 &lt;script&gt;</p>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">通知开关</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifyDown} onChange={() => setNotifyDown(!notifyDown)} className="chk-box" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">故障时通知</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={notifyUp} onChange={() => setNotifyUp(!notifyUp)} className="chk-box" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">恢复时通知</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">Webhook URL</label>
                <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-webhook.example.com/alert" className={inputClass} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">请求方法</label>
                  <select value={webhookMethod} onChange={e => setWebhookMethod(e.target.value)} className={inputClass}>
                    {['GET','POST'].map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">内容类型</label>
                  <select value={webhookContentType} onChange={e => setWebhookContentType(e.target.value)} className={inputClass}>
                    <option value="json">JSON</option>
                    <option value="text">纯文本</option>
                  </select>
                </div>
              </div>

              {webhookMethod === 'POST' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">
                    提交内容 {webhookContentType === 'json' ? '(JSON格式)' : '(纯文本)'}
                  </label>
                  <textarea value={webhookBody} onChange={e => setWebhookBody(e.target.value)}
                    placeholder={webhookContentType === 'json' ? '{"name":"{name}","status":"{status}"}' : '{name} {status} 于 {time}'}
                    className={`${inputClass} font-mono`} rows={4} style={{ minHeight: '80px' }} />
                  <p className="text-xs text-slate-500 mt-1">变量: {'{name} {status} {time} {hostname} {message}'}</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">请求头（每行一个，格式: Name: Value）</label>
                <textarea value={webhookHeaders} onChange={e => setWebhookHeaders(e.target.value)}
                  placeholder={"Content-Type: application/json\nAuthorization: Bearer xxx"}
                  className={`${inputClass} font-mono`} rows={3} style={{ minHeight: '60px' }} />
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={webhookTls} onChange={e => setWebhookTls(e.target.checked)} className="chk-box" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">验证 TLS 证书</span>
                </label>
                <button type="button" disabled={webhookTesting || !webhookUrl}
                  onClick={async () => {
                    if (!webhookUrl) return;
                    setWebhookTesting(true);
                    setWebhookTestResult('');
                    try {
                      const headers: Record<string,string> = {};
                      webhookHeaders.split('\n').forEach(line => {
                        const idx = line.indexOf(':');
                        if (idx > 0) headers[line.slice(0,idx).trim()] = line.slice(idx+1).trim();
                      });
                      const body = webhookBody
                        .replace(/\{name\}/g, 'TEST-监控项')
                        .replace(/\{status\}/g, 'up')
                        .replace(/\{time\}/g, new Date().toISOString())
                        .replace(/\{hostname\}/g, 'test.example.com')
                        .replace(/\{message\}/g, '这是一条测试消息');
                      const fetchOptions: RequestInit = {
                        method: webhookMethod,
                        headers: { ...headers },
                      };
                      if (webhookMethod === 'POST') {
                        headers['Content-Type'] = webhookContentType === 'json' ? 'application/json' : 'text/plain';
                        fetchOptions.headers = headers;
                        fetchOptions.body = webhookContentType === 'json' ? body : body;
                      }
                      // Use fetch without TLS verification (can't disable in browser, just for testing)
                      const res = await fetch(webhookUrl, fetchOptions);
                      setWebhookTestResult(`${res.status} ${res.statusText}`);
                    } catch (e: any) {
                      setWebhookTestResult(`错误: ${e.message}`);
                    } finally { setWebhookTesting(false); }
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-blue-500/30 text-blue-500 hover:bg-blue-500/10 transition-colors disabled:opacity-40">
                  {webhookTesting ? '发送中...' : '模拟测试'}
                </button>
                {webhookTestResult && (
                  <span className={`text-xs ${webhookTestResult.startsWith('2') ? 'text-emerald-500' : 'text-red-500'}`}>
                    {webhookTestResult}
                  </span>
                )}
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
