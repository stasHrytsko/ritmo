import { THEME_PREFERENCES, useThemePreference, type ThemePreference } from '../theme';
import { Segmented } from './ui';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная'
};

export function ThemePicker() {
  const [preference, choose] = useThemePreference();

  return (
    <div className="field theme-field">
      <span id="theme-label">Тема</span>
      <Segmented
        options={THEME_PREFERENCES.map((option) => ({ value: option, label: THEME_LABELS[option] }))}
        value={preference}
        labelledBy="theme-label"
        onChange={choose}
      />
    </div>
  );
}
