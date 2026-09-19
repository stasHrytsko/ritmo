import { useCallback, useEffect, useState } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

/** Shared with the inline script in index.html that applies the theme early. */
export const THEME_STORAGE_KEY = 'ritmo:theme';

const isPreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

/**
 * A display preference for this device, so it lives in browser storage rather
 * than in the app database: restoring a backup from a phone should not repaint
 * a laptop. Every access is guarded — storage throws in some private modes.
 */
export function readThemePreference(): ThemePreference {
  try {
    const stored: unknown = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function writeThemePreference(preference: ThemePreference) {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // A theme that lasts only this session still beats failing to change it.
  }
}

/** 'system' leaves the attribute off, so the CSS media query decides. */
export function applyThemePreference(preference: ThemePreference) {
  const root = document.documentElement;
  if (preference === 'system') delete root.dataset.theme;
  else root.dataset.theme = preference;
}

export function resolveTheme(preference: ThemePreference): 'light' | 'dark' {
  if (preference !== 'system') return preference;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

const THEME_COLORS = { light: '#f3efe6', dark: '#14130f' };

/**
 * The browser picks a theme-color meta by its media attribute, which ignores an
 * in-app override, so the effective colour is set directly.
 */
function applyThemeColor(theme: 'light' | 'dark') {
  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => { meta.content = THEME_COLORS[theme]; });
}

export function useThemePreference() {
  const [preference, setPreference] = useState<ThemePreference>(readThemePreference);

  useEffect(() => {
    applyThemePreference(preference);
    applyThemeColor(resolveTheme(preference));

    if (preference !== 'system') return;

    // While following the system, keep the status bar colour in step with it.
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => applyThemeColor(query.matches ? 'dark' : 'light');
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [preference]);

  const choose = useCallback((next: ThemePreference) => {
    writeThemePreference(next);
    setPreference(next);
  }, []);

  return [preference, choose] as const;
}
