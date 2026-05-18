import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { createMonitor } from '../../api/monitors';
import StatusCodeSelect from '../../components/StatusCodeSelect';
import { useTranslation } from 'react-i18next';

const CreateMonitor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '', method: 'GET', interval: 1, timeout: 30, expectedStatus: 200, body: '' });
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [isPublic, setIsPublic] = useState(true);
  const { t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['interval', 'timeout', 'expectedStatus'].includes(name) ? parseInt(value) || 0 : value }));
  };

  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    if (index === headers.length - 1 && (newHeaders[index].key || newHeaders[index].value)) newHeaders.push({ key: '', value: '' });
    setHeaders(newHeaders);
  };

  const removeHeader = (index: number) => {
    if (headers.length > 1) { const h = [...headers]; h.splice(index, 1); setHeaders(h); }
  };

  const headersToJson = () => {
    const result: Record<string, string> = {};
    headers.forEach(({ key, value }) => { if (key.trim()) result[key.trim()] = value; });
    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await createMonitor({ name: formData.name, url: formData.url, method: formData.method, interval: formData.interval * 60, timeout: formData.timeout, expectedStatus: formData.expectedStatus, headers: headersToJson(), body: formData.body, public: isPublic });
      if (response.success) navigate('/monitors');
      else alert(`${t('monitor.form.createFailed')}: ${response.message || t('monitor.form.unknownError')}`);
    } catch (error) {
      alert(t('monitor.form.createFailed'));
    } finally { setLoading(false); }
  };

  const showBodyField = ['POST', 'PUT', 'PATCH'].includes(formData.method);

  const inputClass = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-slide-up">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/monitors')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500"><ArrowLeftIcon /></button>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('monitor.form.title.create')}</h1>
      </div>

      <div className="glass p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div>
            <label className={labelClass}>{t('monitor.form.name')} *</label>
            <input name="name" value={formData.name} onChange={handleChange} placeholder={t('monitor.form.namePlaceholder')} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>URL *</label>
            <input name="url" value={formData.url} onChange={handleChange} placeholder={t('monitor.form.urlPlaceholder')} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>{t('monitor.form.method')} *</label>
            <select name="method" value={formData.method} onChange={handleChange} className={inputClass}>
              {['GET', 'POST', 'PUT', 'DELETE', 'HEAD'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>{t('monitor.form.interval')} *</label>
              <input name="interval" type="number" value={formData.interval} onChange={handleChange} min="1" required className={inputClass} />
              <p className="text-xs text-slate-500 mt-1">{t('monitor.form.intervalMin')}</p>
            </div>
            <div>
              <label className={labelClass}>{t('monitor.form.timeout')} *</label>
              <input name="timeout" type="number" value={formData.timeout} onChange={handleChange} min="1" required className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('monitor.form.expectedStatus')} *</label>
            <StatusCodeSelect value={formData.expectedStatus} onChange={(v) => setFormData(prev => ({ ...prev, expectedStatus: v }))} required />
          </div>
          <div>
            <label className={labelClass}>{t('monitor.form.headers')}</label>
            <div className="border border-white/[0.08] rounded-lg p-3">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-semibold text-slate-500 pb-2">{t('monitor.form.headerName')}</th>
                    <th className="text-left text-xs font-semibold text-slate-500 pb-2">{t('monitor.form.headerValue')}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {headers.map((h, i) => (
                    <tr key={i}>
                      <td className="pr-2 pb-2"><input placeholder={t('monitor.form.headerNamePlaceholder')} value={h.key} onChange={e => handleHeaderChange(i, 'key', e.target.value)} className={inputClass} /></td>
                      <td className="pr-2 pb-2"><input placeholder={t('monitor.form.headerValuePlaceholder')} value={h.value} onChange={e => handleHeaderChange(i, 'value', e.target.value)} className={inputClass} /></td>
                      <td className="pb-2"><button type="button" onClick={() => removeHeader(i)} className="p-2 rounded-md text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"><TrashIcon /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={() => setHeaders([...headers, { key: '', value: '' }])} className="mt-2 flex items-center gap-1 text-xs text-blue-500 hover:text-blue-400 transition-colors"><PlusIcon />{t('monitor.form.addHeader')}</button>
            </div>
          </div>
          {showBodyField && (
            <div>
              <label className={labelClass}>{t('monitor.form.body')}</label>
              <textarea name="body" value={formData.body} onChange={handleChange} placeholder={t('monitor.form.bodyPlaceholder')} className={inputClass} rows={5} style={{ minHeight: '100px' }} />
            </div>
          )}
          <div>
            <label className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
              <span className="text-xs font-medium text-slate-500">公开显示</span>
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${isPublic ? 'bg-blue-500 border-blue-500' : 'border-slate-400'}`}>
                {isPublic && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>}
              </span>
              <input type="checkbox" checked={isPublic} onChange={() => setIsPublic(!isPublic)} className="sr-only" />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-white/[0.06]">
            <button type="button" onClick={() => navigate('/monitors')} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">{t('monitor.form.cancel')}</button>
            <button type="submit" disabled={loading} className="btn-gradient px-5 py-2 text-sm flex items-center gap-1.5 disabled:opacity-60">
              {loading ? t('monitor.form.creating') : t('monitor.form.create')}{!loading && <PlusIcon />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateMonitor;
