import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon, Cross2Icon } from '@radix-ui/react-icons';
import * as Toast from '@radix-ui/react-toast';
import { getAgent, updateAgent } from '../../api/agents';
import { useTranslation } from 'react-i18next';

const EditAgent = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [name, setName] = useState('');
  const [trafficVal, setTrafficVal] = useState('');
  const [trafficUnit, setTrafficUnit] = useState('TB');
  const units = ['GB', 'TB'] as const;
  const [expiryTime, setExpiryTime] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const { t } = useTranslation();

  useEffect(() => {
    if (!id) return;
    getAgent(parseInt(id)).then(res => {
      if (res.success && res.agent) {
        setName(res.agent.name || '');
        const tl = res.agent.traffic_limit;
        if (tl && tl > 0) {
          if (tl >= 1099511627776) { setTrafficVal(String(Math.round(tl / 1099511627776 * 10) / 10)); setTrafficUnit('TB'); }
          else { setTrafficVal(String(Math.round(tl / 1073741824 * 10) / 10)); setTrafficUnit('GB'); }
        }
        setExpiryTime(res.agent.expiry_time ? res.agent.expiry_time.slice(0, 10) : '');
      }
      setFetching(false);
    }).catch(() => setFetching(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setLoading(true);
    try {
      const data: any = { name };
      if (trafficVal) {
        const v = parseFloat(trafficVal) || 0;
        const multipliers: Record<string, number> = { MB: 1048576, GB: 1073741824, TB: 1099511627776, PB: 1125899906842624 };
        data.traffic_limit = Math.round(v * (multipliers[trafficUnit] || 1073741824));
      } else data.traffic_limit = null;
      if (expiryTime) data.expiry_time = new Date(expiryTime).toISOString();
      else data.expiry_time = null;
      const res = await updateAgent(parseInt(id), data);
      if (res.success) { setToastMsg(t('agent.updateSuccess')); setToastType('success'); setToastOpen(true); setTimeout(() => navigate('/agents'), 1500); }
      else { setToastMsg(res.message || t('agent.updateFailed')); setToastType('error'); setToastOpen(true); }
    } catch { setToastMsg(t('agent.updateFailed')); setToastType('error'); setToastOpen(true); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const selectClass = "px-2 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";

  if (fetching) return <div className="flex justify-center items-center min-h-[50vh]"><span className="text-slate-500">{t('common.loading')}</span></div>;

  return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.edit')}</h1>
      </div>
      <div className="glass p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('agent.name')} *</label>
            <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('agent.trafficLimit')}</label>
            <div className="flex gap-2">
              <input type="number" step="0.1" min="0" value={trafficVal} onChange={e => setTrafficVal(e.target.value)} placeholder="1" className={`${inputClass} flex-1`} />
              <select value={trafficUnit} onChange={e => setTrafficUnit(e.target.value)} className={`${selectClass} w-12 flex-shrink-0`}>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('agent.expiryTime')}</label>
            <input type="date" value={expiryTime} onChange={e => setExpiryTime(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button type="button" onClick={() => navigate('/agents')} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-gradient px-5 py-2 text-sm disabled:opacity-60">{loading ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      </div>
      <Toast.Provider>
        <Toast.Root open={toastOpen} onOpenChange={setToastOpen} duration={3000}
          className={`fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium animate-slide-up ${toastType === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <Toast.Title className="font-semibold">{toastType === 'success' ? t('common.success') : t('common.error')}</Toast.Title>
          <Toast.Description className="text-white/80 text-xs mt-0.5">{toastMsg}</Toast.Description>
          <Toast.Close className="absolute top-2 right-2 text-white/70 hover:text-white"><Cross2Icon /></Toast.Close>
        </Toast.Root>
        <Toast.Viewport />
      </Toast.Provider>
    </div>
  );
};

export default EditAgent;
