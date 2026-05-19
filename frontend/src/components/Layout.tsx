import { ReactNode, useEffect } from 'react';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';
import { ENV_API_BASE_URL } from '../config';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

  // Dynamically set browser title + favicon from status page config
  useEffect(() => {
    fetch(`${ENV_API_BASE_URL}/api/status/data`).then(r => r.json()).then(res => {
      if (res.success && res.data) {
        document.title = res.data.title || '系统状态';
        if (res.data.logoUrl) {
          let link = document.querySelector('link[rel="icon"][data-custom]') as HTMLLinkElement;
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            link.setAttribute('data-custom', '1');
            document.head.appendChild(link);
          }
          link.href = res.data.logoUrl;
        }
        localStorage.setItem('xugou_page_config', JSON.stringify({ title: res.data.title, logoUrl: res.data.logoUrl }));
      }
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 w-full animate-fade-in">
        {children}
      </main>
      <footer className="w-full py-4 mt-auto border-t border-white/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4">
          <div className="flex flex-col items-center gap-2 py-3">
            <span className="text-xs text-slate-500">
              {t('footer.copyright', { year: currentYear })}
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
