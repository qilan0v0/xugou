import { ReactNode, useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import LanguageSelector from './LanguageSelector';
import {
  LayoutDashboard, Server, Activity, FolderGit2, Settings2, UserCog,
  Sun, Moon, LogOut, User, Menu, X, ChevronDown, ExternalLink, PanelLeftClose, PanelLeftOpen,
} from 'lucide-react';

interface AdminLayoutProps {
  children: ReactNode;
}

const SIDEBAR_KEY = 'qltz_sidebar_collapsed';

const navSections = [
  {
    label: '监控',
    items: [
      { to: '/dashboard', icon: <LayoutDashboard size={18} />, label: '概览' },
      { to: '/monitors', icon: <Activity size={18} />, label: 'API 监控' },
      { to: '/agents', icon: <Server size={18} />, label: '探针' },
    ],
  },
  {
    label: '管理',
    items: [
      { to: '/agents/groups', icon: <FolderGit2 size={18} />, label: '分组管理' },
      { to: '/status/config', icon: <Settings2 size={18} />, label: '状态页配置' },
      { to: '/settings', icon: <UserCog size={18} />, label: '系统设置' },
    ],
  },
];

const activeItem = (to: string, pathname: string) => {
  if (to === '/monitors' && pathname.startsWith('/monitors')) return true;
  if (to === '/agents' && pathname.startsWith('/agents') && !pathname.startsWith('/agents/groups')) return true;
  if (to === '/agents/groups' && pathname.startsWith('/agents/groups')) return true;
  return pathname === to;
};

const breadcrumbOf = (pathname: string) => {
  if (pathname.startsWith('/dashboard')) return '概览';
  if (pathname.startsWith('/monitors')) return pathname.includes('/create') ? '新建 API 监控' : pathname.includes('/edit') ? '编辑 API 监控' : /\/(\d+)$/.test(pathname) ? '监控详情' : 'API 监控';
  if (pathname.startsWith('/agents/groups')) return '分组管理';
  if (pathname.startsWith('/agents')) return pathname.includes('/create') ? '新建探针' : pathname.includes('/edit') ? '编辑探针' : /\/(\d+)$/.test(pathname) ? '探针详情' : '探针管理';
  if (pathname.startsWith('/status/config')) return '状态页配置';
  if (pathname.startsWith('/settings')) return '系统设置';
  if (pathname.startsWith('/profile')) return '个人资料';
  if (pathname.startsWith('/terminal')) return '终端';
  return '管理后台';
};

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [logoTitle, setLogoTitle] = useState('QLTZ');

  useEffect(() => {
    try {
      const c = JSON.parse(localStorage.getItem('qltz_page_config') || '{}');
      if (c.title) setLogoTitle(c.title);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  // Close mobile drawer + user menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarBody = (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 h-16 px-5 border-b border-slate-200/60 dark:border-white/[0.06] shrink-0 ${collapsed ? 'justify-center px-0' : ''}`}>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-[0_4px_12px_rgba(59,130,246,0.35)] shrink-0">
          <Activity size={17} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[15px] font-bold text-slate-900 dark:text-white leading-tight truncate">{logoTitle}</p>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 tracking-wide uppercase">Admin Console</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6 scrollbar-hidden">
        {navSections.map(section => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-600">{section.label}</p>
            )}
            <div className="space-y-1">
              {section.items.map(item => {
                const isActive = activeItem(item.to, location.pathname);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={`relative flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                      collapsed ? 'justify-center px-0 h-11' : 'px-3 h-11'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600/12 to-indigo-600/8 text-blue-700 dark:text-blue-400 font-semibold shadow-[inset_0_0_0_1px_rgba(59,130,246,0.2)]'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.05]'
                    }`}
                  >
                    {/* Active indicator */}
                    {isActive && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-gradient-to-b from-blue-500 to-cyan-500" />
                    )}
                    <span className={`shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'} transition-colors`}>
                      {item.icon}
                    </span>
                    {!collapsed && <span className="text-[13px] truncate">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User area */}
      <div className="border-t border-slate-200/60 dark:border-white/[0.06] p-3 shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-xl mb-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-slate-900 dark:text-white truncate">{user?.username}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{user?.role || '管理员'}</p>
            </div>
          )}
        </div>
        <div className={`flex gap-1 ${collapsed ? 'flex-col' : ''}`}>
          <button
            onClick={() => navigate('/profile')}
            className={`flex items-center gap-3 rounded-lg text-[13px] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-white/[0.05] transition-colors ${
              collapsed ? 'justify-center h-10 w-11 mx-auto' : 'px-3 h-10 flex-1'
            }`}
            title="个人资料"
          >
            <User size={16} />
            {!collapsed && '个人资料'}
          </button>
          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 rounded-lg text-[13px] text-red-500 hover:bg-red-500/10 transition-colors ${
              collapsed ? 'justify-center h-10 w-11 mx-auto' : 'px-3 h-10 flex-1'
            }`}
            title="退出登录"
          >
            <LogOut size={16} />
            {!collapsed && '退出登录'}
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-[#0b0f19]">
      {/* Desktop sidebar */}
      <aside className={`
        hidden lg:flex flex-col shrink-0 h-full border-r border-slate-200/60 dark:border-white/[0.06]
        bg-white/70 dark:bg-[#0e1420]/90 backdrop-blur-xl transition-[width] duration-300 ease-in-out
        ${collapsed ? 'w-[68px]' : 'w-[240px]'}
      `}>
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] flex flex-col bg-white dark:bg-[#0e1420] border-r border-slate-200 dark:border-white/10 shadow-2xl animate-slide-up">
            <button onClick={() => setMobileOpen(false)} className="absolute top-4 right-3 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
              <X size={18} />
            </button>
            {sidebarBody}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top header */}
        <header className="h-16 shrink-0 flex items-center gap-3 px-4 lg:px-6 border-b border-slate-200/60 dark:border-white/[0.06] bg-white/70 dark:bg-[#0e1420]/70 backdrop-blur-xl z-30">
          {/* Mobile hamburger */}
          <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
            <Menu size={20} />
          </button>

          {/* Collapse toggle (desktop) */}
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex p-2 -ml-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            title={collapsed ? '展开侧栏' : '收起侧栏'}
          >
            {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
          </button>

          {/* Breadcrumb / page title */}
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] lg:text-base font-semibold text-slate-900 dark:text-white truncate">{breadcrumbOf(location.pathname)}</h1>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <a
              href="/status"
              className="hidden sm:flex items-center gap-1.5 px-3 h-9 rounded-lg text-[12px] font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
            >
              <ExternalLink size={14} />
              公开状态页
            </a>

            <LanguageSelector />

            <button
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
              title={theme === 'dark' ? '切换亮色模式' : '切换暗色模式'}
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            <div className="hidden sm:block w-px h-6 bg-slate-200/80 dark:bg-white/10 ml-1" />

            {/* User menu */}
            <div className="relative ml-1">
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex items-center gap-2 pl-1 pr-1.5 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white text-xs font-bold">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-2 w-60 z-20 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#131a2a] shadow-xl shadow-slate-900/10 dark:shadow-black/40 py-1.5 animate-fade-in">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-white/[0.06]">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.username}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || user?.role || '管理员'}</p>
                    </div>
                    <button
                      onClick={() => { navigate('/profile'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <User size={15} /> 个人资料
                    </button>
                    <button
                      onClick={() => { navigate('/status/config'); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <Settings2 size={15} /> 状态页配置
                    </button>
                    <div className="border-t border-slate-100 dark:border-white/[0.06] my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      <LogOut size={15} /> 退出登录
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 lg:p-6 animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}