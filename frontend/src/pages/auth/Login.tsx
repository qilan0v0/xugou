import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  useEffect(() => {
    if (location.state?.message) setMessage(location.state.message);
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const result = await login({ username, password });
      if (result.success) {
        navigate('/agents');
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || t('login.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 flex items-center justify-center min-h-[calc(100vh-130px)]">
      <div className="w-full glass p-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500" />
        <h2 className="text-2xl font-bold text-center mb-6 text-slate-900 dark:text-white">{t('login.title')}</h2>

        {message && <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-sm px-4 py-2 rounded-lg mb-4 text-center">{message}</div>}
        {error && <div className="bg-red-500/10 text-red-500 text-sm px-4 py-2 rounded-lg mb-4 text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input placeholder={t('login.username')} value={username} onChange={e => setUsername(e.target.value)}
            required className="input-modern" />
          <input placeholder={t('login.password')} type="password" value={password} onChange={e => setPassword(e.target.value)}
            required className="input-modern" />
          <button type="submit" disabled={isLoading}
            className="btn-gradient py-2.5 text-sm mt-1 disabled:opacity-60">
            {isLoading ? t('common.loading') : t('login.button')}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-5">
          {t('register.loginLink')} <Link to="/register" className="text-blue-500 hover:text-blue-400 font-semibold">{t('register.title')}</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
