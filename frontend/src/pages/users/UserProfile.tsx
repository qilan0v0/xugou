import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { updateUser, changePassword } from '../../api/users';
import { useTranslation } from 'react-i18next';

const UserProfile = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) { setUsername(user.username || ''); setEmail(user.email || ''); }
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg(''); setLoading(true);
    try {
      const res = await updateUser(user?.id || 0, { username, email } as any);
      if (res.success) setMsg(t('profile.updateSuccess'));
      else setErr(res.message || t('profile.updateFailed'));
    } catch { setErr(t('profile.updateFailed')); }
    finally { setLoading(false); }
  };

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setMsg('');
    if (newPassword !== confirmPassword) { setErr(t('register.error.passwordMismatch')); return; }
    setLoading(true);
    try {
      const res = await changePassword(user?.id || 0, { currentPassword, newPassword } as any);
      if (res.success) { setMsg(t('profile.passwordChanged')); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }
      else setErr(res.message || t('profile.changeFailed'));
    } catch { setErr(t('profile.changeFailed')); }
    finally { setLoading(false); }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-white/[0.08] bg-white/5 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 transition-all";
  const labelClass = "block text-xs font-medium text-slate-500 mb-1.5";

  return (
    <div className="max-w-xl mx-auto px-4 py-8 animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('profile.title')}</h1>

      {msg && <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-2.5 rounded-lg mb-4">{msg}</div>}
      {err && <div className="bg-red-500/10 text-red-500 text-sm px-4 py-2.5 rounded-lg mb-4">{err}</div>}

      <div className="glass p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('profile.editInfo')}</h2>
        <form onSubmit={handleUpdate} className="flex flex-col gap-4">
          <div><label className={labelClass}>{t('profile.username')}</label><input value={username} onChange={e => setUsername(e.target.value)} className={inputClass} /></div>
          <div><label className={labelClass}>{t('profile.email')}</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} /></div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-gradient px-5 py-2 text-sm disabled:opacity-60">{t('profile.save')}</button>
          </div>
        </form>
      </div>

      <div className="glass p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('profile.changePassword')}</h2>
        <form onSubmit={handlePassword} className="flex flex-col gap-4">
          <div><label className={labelClass}>{t('profile.currentPassword')}</label><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required className={inputClass} /></div>
          <div><label className={labelClass}>{t('profile.newPassword')}</label><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className={inputClass} /></div>
          <div><label className={labelClass}>{t('profile.confirmPassword')}</label><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className={inputClass} /></div>
          <div className="flex justify-end">
            <button type="submit" disabled={loading} className="btn-gradient px-5 py-2 text-sm disabled:opacity-60">{t('profile.change')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserProfile;
