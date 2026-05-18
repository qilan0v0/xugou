import { ReactNode } from 'react';
import Navbar from './Navbar';
import { useTranslation } from 'react-i18next';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const currentYear = new Date().getFullYear();
  const { t } = useTranslation();

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
