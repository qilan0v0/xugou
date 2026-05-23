import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type Theme = 'dark' | 'light';
export type ThemeName = 'frost' | 'ocean' | 'forest' | 'sunset' | 'midnight' | 'purcarte';

export const THEME_LIST: { name: ThemeName; color: string }[] = [
  { name: 'frost',    color: '#3b82f6' },
  { name: 'ocean',    color: '#14b8a6' },
  { name: 'forest',   color: '#10b981' },
  { name: 'sunset',   color: '#f97316' },
  { name: 'midnight', color: '#818cf8' },
  { name: 'purcarte', color: '#8b5cf6' },
];

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  themeName: ThemeName;
  setThemeName: (name: ThemeName) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  themeName: 'frost',
  setThemeName: () => {},
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('xugou-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const [themeName, setThemeName] = useState<ThemeName>(() => {
    const saved = localStorage.getItem('xugou-theme-name');
    return THEME_LIST.find(t => t.name === saved)?.name || 'frost';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('xugou-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeName);
    localStorage.setItem('xugou-theme-name', themeName);
  }, [themeName]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, themeName, setThemeName }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
