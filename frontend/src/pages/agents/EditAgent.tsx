import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeftIcon } from '@radix-ui/react-icons';
import { getAgent, updateAgent } from '../../api/agents';
import ToastNotify from '../../components/ToastNotify';
import LoadingSpinner from '../../components/LoadingSpinner';
import TagInput from '../../components/TagInput';
import GroupSelect from '../../components/GroupSelect';
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
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [startTime, setStartTime] = useState('');
  const [durationVal, setDurationVal] = useState('1');
  const [durationUnit, setDurationUnit] = useState('month');
  const [remark, setRemark] = useState('');
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success'|'error'>('success');
  const { t } = useTranslation();

  useEffect(() => {
    if (!id) return;
    getAgent(parseInt(id)).then(res => {
      if (res.success && res.agent) {
        setName(res.agent.name || '');
        setCategory(res.agent.category || '');
        setTags(res.agent.tags ? res.agent.tags.split(',').filter(Boolean) : []);
        setIsPublic(res.agent.public !== 0);
        const tl = res.agent.traffic_limit;
        if (tl && tl > 0) {
          if (tl >= 1099511627776) { setTrafficVal(String(Math.round(tl / 1099511627776 * 10) / 10)); setTrafficUnit('TB'); }
          else { setTrafficVal(String(Math.round(tl / 1073741824 * 10) / 10)); setTrafficUnit('GB'); }
        }
        setStartTime(res.agent.start_time ? new Date(res.agent.start_time).toISOString().slice(0, 16) : '');
        setDurationVal(res.agent.duration_value ? String(res.agent.duration_value) : '1');
        setDurationUnit(res.agent.duration_unit || 'month');
        setRemark(res.agent.remark || '');
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
      if (startTime) {
        data.start_time = new Date(startTime).toISOString();
        data.duration_value = parseInt(durationVal) || 1;
        data.duration_unit = durationUnit;
      } else {
        data.start_time = null;
        data.duration_value = null;
        data.duration_unit = null;
        data.expiry_time = null;
      }
      if (category) data.category = category; else data.category = null;
      if (tags.length > 0) data.tags = tags.join(','); else data.tags = null;
      data.public = isPublic;
      data.remark = remark;
      const res = await updateAgent(parseInt(id), data);
      if (res.success) { setToastMsg(t('agent.updateSuccess')); setToastType('success'); setToastOpen(true); setTimeout(() => navigate('/agents'), 1500); }
      else { setToastMsg(res.message || t('agent.updateFailed')); setToastType('error'); setToastOpen(true); }
    } catch { setToastMsg(t('agent.updateFailed')); setToastType('error'); setToastOpen(true); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const selectClass = "px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";

  if (fetching) return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/agents')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white dark:bg-slate-900 transition-colors text-slate-500"><ArrowLeftIcon /></button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('agent.edit')}</h1>
      </div>
      <div className="glass p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('agent.name')} *</label>
            <input value={name} onChange={e => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">分组</label>
            <GroupSelect value={category} onChange={setCategory} placeholder="选择或输入分组" className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">标签</label>
            <TagInput value={tags} onChange={setTags} placeholder="输入标签，回车添加" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">备注</label>
            <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="管理员备注，仅后台可见" rows={3} className={inputClass} />
          </div>
          <div>
            <label className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white dark:bg-slate-900 transition-colors cursor-pointer">
              <span className="text-xs font-medium text-slate-500">公开显示</span>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isPublic ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
                {isPublic && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
              </span>
              <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} className="sr-only" />
            </label>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">{t('agent.trafficLimit')}</label>
            <div className="flex gap-2">
              <input type="number" step="0.1" min="0" value={trafficVal} onChange={e => setTrafficVal(e.target.value)} placeholder="1" className={`${inputClass} flex-1`} />
              <select value={trafficUnit} onChange={e => setTrafficUnit(e.target.value)} className={`${selectClass} w-20 flex-shrink-0`}>
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">开始时间</label>
            <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">使用时长</label>
            <div className="flex gap-2">
              <input type="number" min="1" step="1" value={durationVal} onChange={e => setDurationVal(e.target.value)} placeholder="1" className={`${inputClass} flex-1`} />
              <select value={durationUnit} onChange={e => setDurationUnit(e.target.value)} className={`${selectClass} w-24 flex-shrink-0`}>
                {(['day','month','year'] as const).map(u => <option key={u} value={u}>{u === 'day' ? '天' : u === 'month' ? '月' : '年'}</option>)}
              </select>
            </div>
            {startTime && durationVal && (
              <p className="text-[11px] text-slate-400 mt-1">
                到期时间: {(() => {
                  const d = new Date(startTime);
                  const v = parseInt(durationVal) || 1;
                  switch (durationUnit) {
                    case 'day': d.setDate(d.getDate() + v); break;
                    case 'month': d.setMonth(d.getMonth() + v); break;
                    case 'year': d.setFullYear(d.getFullYear() + v); break;
                  }
                  return d.toLocaleString('zh-CN');
                })()}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button type="button" onClick={() => navigate('/agents')} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white dark:bg-slate-900 transition-colors">{t('common.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-gradient px-5 py-2 text-sm disabled:opacity-60">{loading ? t('common.saving') : t('common.save')}</button>
          </div>
        </form>
      </div>
      <ToastNotify open={toastOpen} onOpenChange={setToastOpen} type={toastType} title={toastType === 'success' ? t('common.success') : t('common.error')} msg={toastMsg} />
    </div>
  );
};

export default EditAgent;
