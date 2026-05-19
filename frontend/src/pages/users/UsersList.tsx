import { useState, useEffect } from 'react';
import { TrashIcon } from '@radix-ui/react-icons';
import { getAllUsers, deleteUser } from '../../api/users';
import LoadingSpinner from '../../components/LoadingSpinner';
import { User } from '../../api/auth';
import { useTranslation } from 'react-i18next';

const UsersList = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const { t } = useTranslation();

  useEffect(() => { loadUsers(); }, []);
  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await getAllUsers();
      if (res.success && res.users) setUsers(res.users);
      else setError(res.message || t('common.error.fetch'));
    } catch { setError(t('common.error.fetch')); }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await deleteUser(deleteId);
      if (res.success) { setUsers(users.filter(u => u.id !== deleteId)); setDeleteId(null); }
      else setError(res.message || t('common.error.delete'));
    } catch { setError(t('common.error.delete')); setDeleteId(null); }
  };

  if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><LoadingSpinner /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-slide-up">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{t('users.title')}</h1>
      {error && <div className="glass border-l-4 border-red-500 p-4 mb-4"><span className="text-red-500">{error}</span></div>}

      <div className="glass overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">ID</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{t('users.username')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{t('users.email')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{t('users.role')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{t('users.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                <td className="px-4 py-3 text-sm text-slate-500">{u.id}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-white">{u.username}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{u.email || '-'}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>{u.role}</span></td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <button onClick={() => setDeleteId(u.id)} className="p-1.5 rounded-md text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"><TrashIcon /></button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deleteId !== null && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setDeleteId(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 glass p-6 w-full max-w-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{t('common.deleteConfirmation')}</h3>
            <p className="text-sm text-slate-500 mb-5">{t('common.deleteConfirmMessage')}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">{t('common.cancel')}</button>
              <button onClick={handleDelete} className="px-4 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors">{t('common.delete')}</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default UsersList;
