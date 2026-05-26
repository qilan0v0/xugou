import { Link } from 'react-router-dom';
import { ActivityLogIcon, LightningBoltIcon, MixerHorizontalIcon, DesktopIcon } from '@radix-ui/react-icons';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const features = [
  { icon: <ActivityLogIcon className="w-6 h-6" />, titleKey: 'monitoring', descKey: 'monitoring.desc', gradient: 'from-blue-500 to-cyan-400', bg: 'bg-blue-500/10' },
  { icon: <DesktopIcon className="w-6 h-6" />, titleKey: 'dashboard', descKey: 'dashboard.desc', gradient: 'from-emerald-500 to-teal-400', bg: 'bg-emerald-500/10' },
  { icon: <LightningBoltIcon className="w-6 h-6" />, titleKey: 'alerts', descKey: 'alerts.desc', gradient: 'from-amber-500 to-orange-400', bg: 'bg-amber-500/10' },
  { icon: <MixerHorizontalIcon className="w-6 h-6" />, titleKey: 'statusPage', descKey: 'statusPage.desc', gradient: 'from-purple-500 to-pink-400', bg: 'bg-purple-500/10' },
];

const Home = () => {
  const { isAuthenticated } = useAuth();
  const { t } = useTranslation();

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute inset-0 bg-grid pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-radial from-blue-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-20 right-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-4xl mx-auto px-4 py-24 flex flex-col items-center gap-6 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            {t('home.title')}
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl">
            {t('home.subtitle')}
          </p>

          <a href="https://github.com/zaunist/qltz" target="_blank" rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
          </a>

          <div className="flex gap-4 mt-4">
            {isAuthenticated ? (
              <Link to="/agents" className="btn-gradient px-8 py-3 text-base inline-flex items-center gap-2 animate-glow">
                {t('home.getStarted')}
              </Link>
            ) : (
              <>
                <Link to="/login" className="btn-gradient px-8 py-3 text-base inline-flex items-center gap-2 animate-glow">
                  {t('home.getStarted')}
                </Link>
                <a href="https://github.com/zaunist/qltz" target="_blank" rel="noopener noreferrer"
                  className="px-8 py-3 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-white/5 transition-all">
                  {t('home.learnMore')}
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-5xl mx-auto px-4 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3">
            {t('home.features.title')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400">{t('home.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <div key={i} className="glass glass-hover p-6 flex flex-col items-center text-center gap-3 group cursor-default">
              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.gradient} ${f.bg} flex items-center justify-center
                group-hover:scale-110 group-hover:rotate-[-4deg] transition-all duration-300`}>
                <span className={f.gradient.replace('from-', 'text-').split(' ')[0]}>{f.icon}</span>
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white">{t(`home.features.${f.titleKey}`)}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{t(`home.features.${f.descKey}`)}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
