import { useState, useEffect, useRef } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getAllMonitors, Monitor } from '../../api/monitors';
import { getAllAgents, Agent } from '../../api/agents';
import { ENV_API_BASE_URL } from '../../config';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../api/index';
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
  const [webhookBodyDown, setWebhookBodyDown] = useState('{"chat_id":"YOUR_CHAT_ID","text":"⚠️ *{name}* 故障\\n\\n状态: {status}\\n时间: {time}\\n主机: {hostname} ({ip})\\n系统: {os}\\nCPU: {cpu} | 内存: {memory} | 磁盘: {disk}\\n运行时长: {uptime}\\n地区: {country}\\n\\n总流量: {traffic_total}","parse_mode":"Markdown"}');
  const [webhookBodyUp, setWebhookBodyUp] = useState('{"chat_id":"YOUR_CHAT_ID","text":"✅ *{name}* 已恢复\\n\\n状态: {status}\\n时间: {time}\\n主机: {hostname} ({ip})\\n系统: {os}\\nCPU: {cpu} | 内存: {memory} | 磁盘: {disk}\\n运行时长: {uptime}\\n地区: {country}\\n\\n总流量: {traffic_total}","parse_mode":"Markdown"}');
  const [webhookHeaders, setWebhookHeaders] = useState('');
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookTestResult, setWebhookTestResult] = useState('');
  const [varsExpanded, setVarsExpanded] = useState(false);
  const [testAgentId, setTestAgentId] = useState<number | null>(null);
  const [agentsBrief, setAgentsBrief] = useState<{id:number;name:string;hostname:string;os:string;ip_address:string;cpu_usage:number;country:string;boot_time:string;memory_total:number;memory_used:number;disk_total:number;disk_used:number;version:string}[]>([]);
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
    // Restore admin CSS from localStorage (fast first paint)
    try {
      const c = JSON.parse(localStorage.getItem('xugou_page_config') || '{}');
      if (c.adminCss) setAdminCss(c.adminCss);
    } catch {}

    // Load webhook config and admin CSS from backend
    api.get('/api/status/webhook').then(res => {
      if (res.data?.success && res.data.config) {
        const c = res.data.config;
        if (c.webhook_url) setWebhookUrl(c.webhook_url);
        if (c.webhook_method) setWebhookMethod(c.webhook_method);
        if (c.webhook_content_type) setWebhookContentType(c.webhook_content_type);
        if (c.webhook_body_down) setWebhookBodyDown(c.webhook_body_down);
        if (c.webhook_body_up) setWebhookBodyUp(c.webhook_body_up);
        if (c.webhook_headers) setWebhookHeaders(c.webhook_headers);
        if (c.webhook_tls_verify != null) setWebhookTls(!!c.webhook_tls_verify);
        if (c.notify_down != null) setNotifyDown(!!c.notify_down);
        if (c.notify_up != null) setNotifyUp(!!c.notify_up);
      }
    }).catch(() => {});
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
        // Save webhook config to backend
        api.post('/api/status/webhook', {
          webhookUrl, webhookMethod, webhookContentType,
          webhookBodyDown, webhookBodyUp, webhookHeaders,
          webhookTlsVerify: webhookTls, notifyDown, notifyUp,
        }).catch(() => {});
        // Cache to localStorage for fast next load
        localStorage.setItem('xugou_page_config', JSON.stringify({
          title: config.title, logoUrl: config.logoUrl, adminCss,
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
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      故障通知模板 {webhookContentType === 'json' ? '(JSON)' : '(文本)'}
                    </label>
                    <textarea value={webhookBodyDown} onChange={e => setWebhookBodyDown(e.target.value)}
                      placeholder={webhookContentType === 'json' ? '{"name":"{name}","status":"故障"}' : '{name} 出现故障'}
                      className={`${inputClass} font-mono`} rows={3} style={{ minHeight: '60px' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1.5">
                      恢复通知模板 {webhookContentType === 'json' ? '(JSON)' : '(文本)'}
                    </label>
                    <textarea value={webhookBodyUp} onChange={e => setWebhookBodyUp(e.target.value)}
                      placeholder={webhookContentType === 'json' ? '{"name":"{name}","status":"已恢复"}' : '{name} 已恢复正常'}
                      className={`${inputClass} font-mono`} rows={3} style={{ minHeight: '60px' }} />
                  </div>
                  <div>
                    <button type="button" onClick={() => setVarsExpanded(!varsExpanded)}
                      className="text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                      <span>{varsExpanded ? '▼' : '▶'}</span> 可用变量说明
                    </button>
                    {varsExpanded && (
                      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] bg-slate-50 dark:bg-white/[0.03] rounded-lg p-3 border border-white/[0.06]">
                        {[
                          ['{name}', '名称（客户端/监控项）'],
                          ['{status}', '状态: 在线/离线 或 故障/已恢复'],
                          ['{previous_status}', '之前状态 (仅API监控)'],
                          ['{time}', '当前时间'],
                          ['{hostname}', '主机名'],
                          ['{ip}', 'IP 地址'],
                          ['{os}', '操作系统'],
                          ['{version}', '系统版本'],
                          ['{cpu}', 'CPU 使用率 (%)'],
                          ['{cpu_cores}', 'CPU 核心数'],
                          ['{cpu_model}', 'CPU 型号'],
                          ['{cpu_arch}', 'CPU 架构'],
                          ['{memory}', '内存使用率 (%)'],
                          ['{memory_total}', '内存总量'],
                          ['{disk}', '磁盘使用率 (%)'],
                          ['{disk_total}', '磁盘总量'],
                          ['{uptime}', '运行时长'],
                          ['{load}', '系统负载 (1m/5m/15m)'],
                          ['{country}', '所在地区'],
                          ['{agent_version}', 'Agent 版本号'],
                          ['{boot_time}', '系统启动时间'],
                          ['{connected_at}', '首次连接时间'],
                          ['{network_rx_total}', '总下载流量'],
                          ['{network_tx_total}', '总上传流量'],
                          ['{traffic_total}', '总流量（下载+上传）'],
                          ['{message}', '故障/恢复 描述'],
                          ['{url}', '监控URL (仅API监控)'],
                          ['{method}', '请求方法 (仅API监控)'],
                          ['{response_time}', '响应时间ms (仅API监控)'],
                          ['{expected_status}', '期望状态码 (仅API监控)'],
                        ].map(([v, d]) => (
                          <div key={v} className="flex items-baseline gap-1.5">
                            <code className="text-blue-600 dark:text-blue-400 font-mono whitespace-nowrap">{v}</code>
                            <span className="text-slate-500">{d}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">请求头（每行一个，格式: Name: Value）</label>
                <textarea value={webhookHeaders} onChange={e => setWebhookHeaders(e.target.value)}
                  placeholder={"Content-Type: application/json\nAuthorization: Bearer xxx"}
                  className={`${inputClass} font-mono`} rows={3} style={{ minHeight: '60px' }} />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={webhookTls} onChange={e => setWebhookTls(e.target.checked)} className="chk-box" />
                    <span className="text-sm text-slate-700 dark:text-slate-300">验证 TLS 证书</span>
                  </label>

                  <select value={testAgentId ?? ''} onChange={e => { const v = e.target.value; setTestAgentId(v ? Number(v) : null); }}
                    onFocus={() => {
                      if (agentsBrief.length === 0) {
                        getAllAgents().then(res => {
                          if (res.agents) setAgentsBrief(res.agents);
                        });
                      }
                    }}
                    className={`${inputClass} w-48`}>
                    <option value="">选客户端测试(可选)</option>
                    {agentsBrief.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>

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
                        // Build variable values
                        const agent = testAgentId ? agentsBrief.find(a => a.id === testAgentId) : null;
                        const now = new Date().toISOString();
                        const upMs = agent?.boot_time ? Math.max(0, Date.now() - new Date(agent.boot_time).getTime()) : 0;
                        const vars: Record<string,string> = {
                          name: agent?.name || 'TEST-监控项', status: '测试',
                          previous_status: 'up', time: now,
                          hostname: agent?.hostname || 'test.example.com',
                          ip: agent?.ip_address || '127.0.0.1',
                          os: agent?.os || 'Linux', version: agent?.version || '22.04',
                          cpu: agent ? `${Math.round(agent.cpu_usage || 0)}%` : '25%',
                          cpu_cores: '4', cpu_model: 'Intel Test', cpu_arch: 'x86_64',
                          memory: agent?.memory_total ? `${Math.round(((agent.memory_used||0)/(agent.memory_total||1))*100)}%` : '50%',
                          memory_total: agent?.memory_total ? `${(agent.memory_total/1073741824).toFixed(1)} GiB` : '8.0 GiB',
                          disk: agent?.disk_total ? `${Math.round(((agent.disk_used||0)/(agent.disk_total||1))*100)}%` : '30%',
                          disk_total: agent?.disk_total ? `${(agent.disk_total/1073741824).toFixed(1)} GiB` : '256.0 GiB',
                          uptime: upMs ? `${Math.floor(upMs/86400000)}d ${Math.floor((upMs%86400000)/3600000)}h` : '1d 2h',
                          load: '0.50 / 0.30 / 0.20',
                          country: agent?.country || 'CN',
                          agent_version: '1.0.0',
                          boot_time: agent?.boot_time || now,
                          connected_at: now,
                          network_rx_total: '1.23 GiB', network_tx_total: '0.56 GiB',
                          traffic_total: '1.79 GiB',
                          message: '这是一条测试消息',
                          url: 'https://example.com', method: 'GET',
                          response_time: '120', expected_status: '200',
                        };
                        let body = webhookBodyDown;  // use down template for testing
                        for (const [k, v] of Object.entries(vars)) {
                          body = body.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
                        }
                        const res = await fetch(`${ENV_API_BASE_URL}/api/status/webhook-test`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
                          body: JSON.stringify({ url: webhookUrl, method: webhookMethod, headers, body, content_type: webhookContentType, tls_verify: webhookTls }),
                        });
                        const json = await res.json();
                        if (json.success) {
                          setWebhookTestResult(`${json.status} ${json.statusText}`);
                        } else {
                          setWebhookTestResult(`错误: ${json.message}`);
                        }
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
