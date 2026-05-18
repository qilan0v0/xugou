import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CopyIcon, CheckIcon, InfoCircledIcon, PlusIcon } from '@radix-ui/react-icons';
import api from '../../api/index';
import { useTranslation } from 'react-i18next';

const CreateAgent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverUrl, setServerUrl] = useState(window.location.origin);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedArch, setSelectedArch] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [trafficVal, setTrafficVal] = useState('');
  const [trafficUnit, setTrafficUnit] = useState('TB');
  const [expiryTime, setExpiryTime] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const handleCreate = async () => {
    if (!agentName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data: any = { name: agentName.trim() };
      if (category) data.category = category;
      if (tags) data.tags = tags;
      if (trafficVal) {
        const multipliers: Record<string, number> = { GB: 1073741824, TB: 1099511627776 };
        data.traffic_limit = Math.round(parseFloat(trafficVal) * (multipliers[trafficUnit] || 1073741824));
      }
      if (expiryTime) data.expiry_time = new Date(expiryTime).toISOString();
      data.public = isPublic;
      const res = await api.post('/api/agents', data);
      if (res.data.success && res.data.agent) {
        setToken(res.data.agent.token);
        setCreated(true);
      } else {
        setError(res.data.message || '创建失败');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || '创建失败');
    } finally { setLoading(false); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getDownloadUrl = () => {
    if (!selectedPlatform || !selectedArch) return '';
    const ext = selectedPlatform === 'windows' ? '.exe' : '';
    return `https://github.com/qilan0v0/xugou/releases/latest/download/xugou-agent-${selectedPlatform}-${selectedArch}${ext}`;
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const codeClass = "block p-3 rounded-lg bg-slate-900 dark:bg-black/40 text-emerald-400 text-xs font-mono whitespace-pre-wrap break-all leading-relaxed border border-white/[0.06]";

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.form.title.create')}</h1>
      </div>

      <div className="glass p-6 flex flex-col gap-6">
        {/* Agent Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('agent.form.name')}</label>
          <div className="flex gap-2">
            <input value={agentName} onChange={e => setAgentName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="flex-1 px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
              placeholder={t('agent.form.namePlaceholder')} />
            <button onClick={handleCreate}
              disabled={loading || !agentName.trim() || created}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg btn-gradient text-sm font-medium disabled:opacity-50 flex-shrink-0">
              <PlusIcon />{loading ? t('common.creating') : created ? t('agent.form.created') : t('agents.create')}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>

        {/* Extra fields - hidden after creation */}
        {!created && <>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">分类</label>
          <input value={category} onChange={e => setCategory(e.target.value)} placeholder="如: 生产环境" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">标签</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="多个用逗号分隔，如: web,nginx" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">总流量上限</label>
          <div className="flex gap-2">
            <input type="number" step="0.1" min="0" value={trafficVal} onChange={e => setTrafficVal(e.target.value)} placeholder="1" className={`${inputClass} flex-1`} />
            <select value={trafficUnit} onChange={e => setTrafficUnit(e.target.value)} className="px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 transition-all w-20 flex-shrink-0">
              {(['GB','TB'] as const).map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">到期时间</label>
          <input type="date" value={expiryTime} onChange={e => setExpiryTime(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
            <span className="text-xs font-medium text-slate-500">公开显示</span>
            <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isPublic ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
              {isPublic && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
            </span>
            <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} className="sr-only" />
          </label>
        </div>
        </>}

        {created && (
          <>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm">
              <InfoCircledIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{t('agent.add.note')}</span>
            </div>

            {/* Server URL */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('agent.add.serverAddress')}</label>
              <input value={serverUrl} onChange={e => setServerUrl(e.target.value)} className={inputClass} placeholder={t('agent.add.serverAddressPlaceholder')} />
              <p className="text-xs text-slate-500 mt-1">{t('agent.add.serverAddressHelp')}</p>
            </div>

            {/* Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('agent.add.registrationToken')}</label>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-mono text-slate-700 dark:text-slate-300 break-all border border-white/[0.06]">{token}</code>
                <button onClick={() => handleCopy(token)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors flex-shrink-0">
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('agent.add.tokenHelp')}</p>
            </div>

            <hr className="border-white/[0.06]" />

            {/* Install Guide */}
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('agent.add.installGuide')}</h3>
              <p className="text-sm text-slate-500 mb-4">{t('agent.add.installSteps')}</p>

              <div className="bg-slate-50 dark:bg-white/[0.02] rounded-xl p-5 border border-white/[0.06] flex flex-col gap-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('agent.add.step1')}</h4>
                  <p className="text-xs text-slate-500 mb-2">1. 选择操作系统:</p>
                  <div className="flex gap-2 mb-4">
                    {['linux', 'darwin', 'windows'].map(p => (
                      <button key={p} onClick={() => { setSelectedPlatform(p); setSelectedArch(null); }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedPlatform === p ? 'btn-gradient' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                        {p === 'darwin' ? 'macOS' : p.charAt(0).toUpperCase() + p.slice(1)}
                      </button>
                    ))}
                  </div>
                  {selectedPlatform && (
                    <>
                      <p className="text-xs text-slate-500 mb-2">2. 选择系统架构:</p>
                      <div className="flex gap-2 mb-4">
                        {['amd64', 'arm64'].map(a => (
                          <button key={a} onClick={() => setSelectedArch(a)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${selectedArch === a ? 'btn-gradient' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'}`}>
                            {a === 'arm64' ? 'ARM64' : 'AMD64 (x86_64)'}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  {selectedPlatform && selectedArch && (
                    <div className="p-4 rounded-lg border border-white/[0.08] bg-white/5">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">3. 下载:</p>
                      {selectedPlatform !== 'windows' && (
                        <>
                          <code className={codeClass}>{`curl -sSL ${getDownloadUrl()} -o xugou-agent && chmod +x xugou-agent`}</code>
                          <button onClick={() => handleCopy(`curl -sSL ${getDownloadUrl()} -o xugou-agent && chmod +x xugou-agent`)}
                            className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                            {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}{copied ? t('common.copied') : t('common.copy')}
                          </button>
                        </>
                      )}
                      <a href={getDownloadUrl()} download className="inline-block mt-2 btn-gradient px-5 py-2.5 text-sm">直接下载</a>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-3">{t('agent.add.step1Help')}</p>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t('agent.add.step2')}</h4>
                  <code className={codeClass}>{`./xugou-agent start --server ${serverUrl} --uuid ${token} --interval 60`}</code>
                  <button onClick={() => handleCopy(`./xugou-agent start --server ${serverUrl} --uuid ${token} --interval 60`)}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                    {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}{t('agents.copyCommand')}
                  </button>
                  <p className="text-xs text-slate-500 mt-2">{t('agent.add.step2Help')}</p>
                </div>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t border-white/[0.06]">
          <button onClick={() => navigate('/agents')} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            {t('agent.add.returnToList')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateAgent;
