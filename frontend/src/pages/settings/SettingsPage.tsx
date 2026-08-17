import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ENV_API_BASE_URL } from '../../config';
import LoadingSpinner from '../../components/LoadingSpinner';
import { GearIcon, PieChartIcon, PersonIcon, CubeIcon, ActivityLogIcon, StackIcon } from '@radix-ui/react-icons';

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
    } catch { /* ignore */ }
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
        localStorage.setItem('custom_api_base_url', apiBaseUrl);
      } else {
        setMessage('保存失败: ' + (data.message || ''));
      }
    } catch (e: any) {
      setMessage('保存失败: ' + (e.message || ''));
    }
    finally { setSaving(false); }
  };

  const menuItems = [
    { to: '/dashboard', icon: <PieChartIcon />, label: '控制台', desc: '返回管理概览' },
    { to: '/agents', icon: <CubeIcon />, label: '探针管理', desc: '查看和管理所有监控探针' },
    { to: '/monitors', icon: <ActivityLogIcon />, label: 'API 监控', desc: 'HTTP/HTTPS 接口监控管理' },
    { to: '/agents/groups', icon: <StackIcon />, label: '分组管理', desc: '管理探针分组' },
    { to: '/status/config', icon: <GearIcon />, label: '状态页配置', desc: '自定义公开状态页的标题/Logo/CSS/通知' },
    { to: '/profile', icon: <PersonIcon />, label: '个人资料', desc: '修改密码和用户信息' },
  ];

  if (loading) return <div className="max-w-4xl mx-auto p-6"><LoadingSpinner size="sm" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-slide-up">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">系统设置</h1>
        <p className="text-sm text-slate-500">管理你的 QLTZ 监控平台</p>
      </div>

      {/* 快捷导航卡片 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {menuItems.map(item => (
          <Link key={item.to} to={item.to}
            className="glass glass-hover p-5 flex items-start gap-4 no-underline"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              {item.icon}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-0.5">{item.label}</h3>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* API 基址设置 */}
      <div className="glass rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white mb-1">后端 API 地址</h2>
        <p className="text-xs text-slate-500 mb-4">修改后前端将使用此地址连接后端 API，留空使用构建时默认值（同源反代）。</p>

        <div className="flex gap-3">
          <input
            type="text"
            value={apiBaseUrl}
            onChange={e => setApiBaseUrl(e.target.value)}
            placeholder="留空 = 同源 /api/..."
            className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-gradient text-sm px-5 py-2 disabled:opacity-50 shrink-0"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>

        {message && (
          <div className={`mt-3 text-sm p-3 rounded-lg ${
            message.includes('成功') ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-500/10 text-red-500'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;