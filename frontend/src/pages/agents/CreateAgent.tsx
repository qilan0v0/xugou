import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, CopyIcon, CheckIcon, PlusIcon } from '@radix-ui/react-icons';
import { generateToken } from '../../api/agents';
import api from '../../api/index';
import AgentCard from '../../components/AgentCard';
import { useTranslation } from 'react-i18next';

const CreateAgent = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [created, setCreated] = useState<{ id: number; name: string } | null>(null);
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
        setCreated({ id: res.data.agent.id, name: name.trim() });
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

  if (created) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8 animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.form.title.create')}</h1>
        </div>

        <AgentCard agent={{
          id: created.id, name: created.name, status: 'inactive',
          created_at: '', updated_at: '', cpu_usage: 0, memory_total: 0, memory_used: 0,
          disk_total: 0, disk_used: 0, network_rx: 0, network_tx: 0,
        }} />

        <div className="glass p-4 mt-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">{t('agent.form.registerHint')}</p>
          <div className="flex gap-2 mb-3">
            <code className="flex-1 px-3 py-2 rounded-lg bg-slate-100 dark:bg-white/5 text-xs font-mono text-slate-700 dark:text-slate-300 break-all border border-white/[0.06]">{token}</code>
            <button onClick={() => handleCopy(token)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-medium hover:bg-blue-500/20 transition-colors flex-shrink-0">
              {copied ? <CheckIcon /> : <CopyIcon />}
              {copied ? t('common.copied') : t('common.copy')}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t('agent.form.waitConnect')}</p>
        </div>

        <div className="flex justify-end mt-4">
          <button onClick={() => navigate('/agents')} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">
            {t('agent.add.returnToList')}
          </button>
        </div>
      </div>
    );
  }

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
