import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CopyIcon, CheckIcon, PlusIcon } from '@radix-ui/react-icons';
import { generateToken } from '../../api/agents';
import api from '../../api/index';
import { useTranslation } from 'react-i18next';

const CreateAgent = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [agentId, setAgentId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await generateToken();
        if (response.success && response.token) setToken(response.token);
      } catch (e) { /* ignore */ }
    };
    fetchToken();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/api/agents', { name: name.trim(), token });
      if (res.data.success) {
        setAgentId(res.data.agent.id);
      } else {
        setError(res.data.message || '创建失败');
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || e.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.form.title.create')}</h1>
      </div>

      <div className="glass p-6 flex flex-col gap-5">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('agent.form.name')}</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            className="w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all"
            placeholder={t('agent.form.namePlaceholder')}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="btn-gradient flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          <PlusIcon />{loading ? t('common.creating') : t('agents.create')}
        </button>

        {agentId && (
          <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-2">{t('agent.form.createSuccess')}</p>
            <div className="flex gap-2 mb-2">
              <code className="flex-1 px-3 py-2 rounded-lg bg-slate-900 dark:bg-black/40 text-emerald-400 text-xs font-mono break-all">{token}</code>
              <button onClick={() => handleCopy(token)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20 transition-colors flex-shrink-0">
                {copied ? <CheckIcon /> : <CopyIcon />}
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
            <p className="text-xs text-slate-500">{t('agent.add.tokenHelp')}</p>
            <div className="mt-3 p-3 rounded-lg bg-slate-900/50 dark:bg-black/30 text-xs font-mono text-slate-300 break-all">
              ./xugou-agent start --server https://xugou-backend-production.ql-c13.workers.dev --token {token} --interval 60
            </div>
          </div>
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
