import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CopyIcon, CheckIcon, InfoCircledIcon } from '@radix-ui/react-icons';
import { generateToken } from '../../api/agents';
import { useTranslation } from 'react-i18next';

const CreateAgent = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [serverUrl, setServerUrl] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [selectedArch, setSelectedArch] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    setServerUrl(window.location.origin);
    const fetchToken = async () => {
      setLoading(true);
      try {
        const response = await generateToken();
        if (response.success && response.token) setToken(response.token);
      } catch (error) { console.error('Failed to get token:', error); }
      finally { setLoading(false); }
    };
    fetchToken();
  }, []);

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
    <div className="max-w-3xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.form.title.create')}</h1>
      </div>

      <div className="glass p-6 flex flex-col gap-6">
        {/* Info */}
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
          {loading ? (
            <span className="text-sm text-slate-500">{t('agent.add.generatingToken')}</span>
          ) : (
            <>
              <div className="flex gap-2">
                <code className="flex-1 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-mono text-slate-700 dark:text-slate-300 break-all border border-white/[0.06]">{token}</code>
                <button onClick={() => handleCopy(token)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm font-medium hover:bg-blue-500/20 transition-colors flex-shrink-0">
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('agent.add.tokenHelp')}</p>
            </>
          )}
        </div>

        <hr className="border-white/[0.06]" />

        {/* Install Guide */}
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{t('agent.add.installGuide')}</h3>
          <p className="text-sm text-slate-500 mb-4">{t('agent.add.installSteps')}</p>

          <div className="bg-slate-50 dark:bg-white/[0.02] rounded-xl p-5 border border-white/[0.06] flex flex-col gap-5">
            {/* Step 1: Download */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">{t('agent.add.step1')}</h4>

              <p className="text-xs text-slate-500 mb-2">1. 选择操作系统:</p>
              <div className="flex gap-2 mb-4">
                {['linux', 'darwin', 'windows'].map(p => (
                  <button key={p} onClick={() => { setSelectedPlatform(p); setSelectedArch(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedPlatform === p ? 'btn-gradient' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                    }`}>
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
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedArch === a ? 'btn-gradient' : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                        }`}>
                        {selectedPlatform === 'darwin' ? (a === 'amd64' ? 'AMD64 (Intel)' : 'ARM64 (Apple Silicon)') : (a === 'amd64' ? 'AMD64 (x86_64)' : 'ARM64')}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {selectedPlatform && selectedArch && (
                <div className="p-4 rounded-lg border border-white/[0.08] bg-white/5">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">3. {selectedPlatform === 'windows' ? '下载安装文件:' : '下载并安装:'}</p>
                  {selectedPlatform !== 'windows' && (
                    <>
                      <code className={codeClass}>{`curl -sSL ${getDownloadUrl()} -o xugou-agent && chmod +x xugou-agent`}</code>
                      <button onClick={() => handleCopy(`curl -sSL ${getDownloadUrl()} -o xugou-agent && chmod +x xugou-agent`)}
                        className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                        {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}{copied ? t('common.copied') : t('common.copy')}
                      </button>
                      <p className="text-xs text-slate-500 mt-2 mb-3">或者直接下载:</p>
                    </>
                  )}
                  <a href={getDownloadUrl()} download className="inline-block btn-gradient px-5 py-2.5 text-sm">
                    下载 {selectedPlatform === 'darwin' ? 'macOS' : selectedPlatform.charAt(0).toUpperCase() + selectedPlatform.slice(1)} {selectedArch} {selectedPlatform === 'windows' ? '版本' : '二进制文件'}
                  </a>
                </div>
              )}
              <p className="text-xs text-slate-500 mt-3">{t('agent.add.step1Help')}</p>
            </div>

            {/* Step 2: Run */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t('agent.add.step2')}</h4>
              <code className={codeClass}>{`./xugou-agent start --server ${serverUrl} --token ${token} --interval 60`}</code>
              <button onClick={() => handleCopy(`./xugou-agent start --server ${serverUrl} --token ${token} --interval 60`)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}{t('agents.copyCommand')}
              </button>
              <p className="text-xs text-slate-500 mt-2">{t('agent.add.step2Help')}</p>
            </div>

            {/* Optional: systemd */}
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{t('agent.add.optionalSetup')}</h4>
              <p className="text-xs text-slate-500 mb-2">{t('agent.add.optionalSetupHelp')}</p>
              <code className={codeClass}>{`sudo mv xugou-agent /usr/local/bin/
sudo tee /etc/systemd/system/xugou-agent.service > /dev/null << EOF
[Unit]
Description=Xugou Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/xugou-agent start --server ${serverUrl} --token ${token} --interval 60
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable xugou-agent.service
sudo systemctl start xugou-agent.service`}</code>
              <button onClick={() => handleCopy(`sudo mv xugou-agent /usr/local/bin/
sudo tee /etc/systemd/system/xugou-agent.service > /dev/null << EOF
[Unit]
Description=Xugou Agent
After=network.target

[Service]
ExecStart=/usr/local/bin/xugou-agent start --server ${serverUrl} --token ${token} --interval 60
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable xugou-agent.service
sudo systemctl start xugou-agent.service`)}
                className="mt-2 text-xs text-blue-500 hover:text-blue-400 transition-colors flex items-center gap-1">
                {copied ? <CheckIcon className="w-3 h-3" /> : <CopyIcon className="w-3 h-3" />}{t('agents.copyCommand')}
              </button>
            </div>
          </div>
        </div>

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
