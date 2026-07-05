import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ENV_API_BASE_URL } from '../../config';
import LoadingSpinner from '../../components/LoadingSpinner';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [apiBaseUrl, setApiBaseUrl] = useState('');

  useEffect(() => {
    if (!token) { navigate('/login'); return; }
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${ENV_API_BASE_URL}/api/settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setApiBaseUrl(data.settings.api_base_url || ENV_API_BASE_URL || '');
      }
    } catch { setMessage('获取设置失败'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(`${ENV_API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ settings: { api_base_url: apiBaseUrl } }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage('保存成功。API 地址变更后请手动刷新页面。');
        // 保存到 localStorage 以便前端立即使用
        localStorage.setItem('custom_api_base_url', apiBaseUrl);
      } else {
        setMessage('保存失败: ' + (data.message || ''));
      }
    } catch (e: any) {
      setMessage('保存失败: ' + (e.message || ''));
    }
    finally { setSaving(false); }
  };

  if (loading) return <div className="max-w-2xl mx-auto p-6"><LoadingSpinner size="sm" /></div>;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">系统设置</h1>

      <div className="glass rounded-xl p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            后端 API 地址
          </label>
          <input
            type="text"
            value={apiBaseUrl}
            onChange={e => setApiBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
          <p className="mt-1 text-xs text-slate-400">
            修改后保存，前端将使用此地址连接后端 API。留空使用构建时默认地址。
          </p>
        </div>

        {message && (
          <div className={`text-sm p-3 rounded-lg ${message.includes('成功') ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'}`}>
            {message}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-gradient text-sm px-6 py-2 disabled:opacity-50"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
};

export default SettingsPage;
