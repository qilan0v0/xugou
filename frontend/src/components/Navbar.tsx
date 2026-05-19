import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import LanguageSelector from './LanguageSelector';
import {
  DashboardIcon, ActivityLogIcon, CubeIcon, PieChartIcon,
  ExitIcon, PersonIcon, ChevronDownIcon,
  SunIcon, MoonIcon,
} from '@radix-ui/react-icons';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isScrolled, setIsScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const navLinks = isAuthenticated ? [
    { to: '/dashboard', icon: <DashboardIcon />, label: t('navbar.dashboard') },
    { to: '/monitors', icon: <ActivityLogIcon />, label: t('navbar.apiMonitors') },
    { to: '/agents', icon: <CubeIcon />, label: t('navbar.agentMonitors') },
    { to: '/status/config', icon: <PieChartIcon />, label: '首页配置' },
      ] : [];

  return (
    <nav className={`sticky top-0 z-50 w-full transition-all duration-300 ${
      isScrolled
        ? 'bg-white/[0.85] dark:bg-[#0f0f1a]/[0.85] backdrop-blur-xl shadow-[0_2px_16px_rgba(0,0,0,0.08)] border-b border-white/[0.06]'
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-[1400px] mx-auto px-4">
        <div className={`flex items-center justify-between transition-all duration-300 ${
          isScrolled ? 'h-[54px]' : 'h-[60px]'
        }`}>
          {/* Logo — reads custom config */}
          {(() => {
            let cfg: any = {};
            try { cfg = JSON.parse(localStorage.getItem('xugou_page_config') || '{}'); } catch {}
            return (
              <Link to="/" className="flex items-center gap-2 group no-underline">
                {cfg.logoUrl ? (
                  <img src={cfg.logoUrl} alt="" className="w-8 h-8 rounded-lg object-cover group-hover:scale-105 group-hover:rotate-[-5deg] transition-all duration-300" />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center
                    group-hover:scale-105 group-hover:rotate-[-5deg] transition-all duration-300">
                    <PieChartIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{cfg.title || 'XUGOU'}</span>
              </Link>
            );
          })()}


          {/* Nav Links */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(link => (
                <Link key={link.to} to={link.to}
                  className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(link.to)
                      ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                  <span className="w-3.5 h-3.5">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          )}

          {/* Right side */}
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <button onClick={toggleTheme}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
              title={theme === 'dark' ? t('navbar.lightMode') || 'Light mode' : t('navbar.darkMode') || 'Dark mode'}
            >
              {theme === 'dark' ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
            </button>

            {isAuthenticated ? (
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="hidden sm:block text-sm">{user?.username}</span>
                  <ChevronDownIcon className={`w-3 h-3 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 z-20 glass py-1 animate-fade-in">
                      <div className="px-3 py-2 border-b border-white/[0.06]">
                        <p className="text-xs text-slate-500">{t('navbar.loggedInAs')}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.username}</p>
                      </div>
                      {user?.role === 'admin' && (
                        <button onClick={() => { navigate('/users'); setMenuOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white/5 transition-colors"
                        >
                          <PersonIcon className="w-3.5 h-3.5" />
                          {t('navbar.userManagement')}
                        </button>
                      )}
                      <button onClick={() => { navigate('/profile'); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-white/5 transition-colors"
                      >
                        <PersonIcon className="w-3.5 h-3.5" />
                        {t('navbar.profile')}
                      </button>
                      <div className="border-t border-white/[0.06] my-1" />
                      <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-500/5 transition-colors"
                      >
                        <ExitIcon className="w-3.5 h-3.5" />
                        {t('navbar.logout')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button onClick={() => navigate('/login')}
                className="btn-gradient text-sm px-4 py-2"
              >
                {t('navbar.login')}
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
