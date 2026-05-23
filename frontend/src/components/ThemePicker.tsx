import { useTheme, THEME_LIST, ThemeName } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function ThemePicker() {
  const { themeName, setThemeName } = useTheme();
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-1.5" title={t('theme.' + themeName) || themeName}>
      {THEME_LIST.map(({ name, color }) => (
        <button
          key={name}
          onClick={() => setThemeName(name as ThemeName)}
          className={`w-5 h-5 rounded-full transition-all duration-200 flex items-center justify-center ${
            themeName === name
              ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110'
              : 'hover:scale-110 opacity-60 hover:opacity-100'
          }`}
          style={{ backgroundColor: color, ['--tw-ring-color' as any]: color }}
          title={t('theme.' + name) || name}
        >
          {themeName === name && (
            <span className="w-1.5 h-1.5 rounded-full bg-white" />
          )}
        </button>
      ))}
    </div>
  );
}
