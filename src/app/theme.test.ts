import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyThemePreference,
  readThemePreference,
  resolveTheme
} from './theme';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) { return this.map.get(key) ?? null; }
  setItem(key: string, value: string) { this.map.set(key, value); }
  removeItem(key: string) { this.map.delete(key); }
}

const throwingStorage = {
  getItem() { throw new DOMException('denied'); },
  setItem() { throw new DOMException('denied'); },
  removeItem() { throw new DOMException('denied'); }
};

const root = { dataset: {} as Record<string, string | undefined> };

const setWindow = (storage: unknown, prefersDark = false) => {
  vi.stubGlobal('window', {
    localStorage: storage,
    matchMedia: (query: string) => ({ matches: prefersDark && query.includes('dark') })
  });
  vi.stubGlobal('document', { documentElement: root });
};

beforeEach(() => {
  root.dataset = {};
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readThemePreference', () => {
  it('defaults to following the system', () => {
    setWindow(new MemoryStorage());
    expect(readThemePreference()).toBe('system');
  });

  it('reads a stored choice back', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, 'dark');
    setWindow(storage);
    expect(readThemePreference()).toBe('dark');
  });

  it('ignores a value it does not recognise', () => {
    const storage = new MemoryStorage();
    storage.setItem(THEME_STORAGE_KEY, 'neon');
    setWindow(storage);
    expect(readThemePreference()).toBe('system');
  });

  it('falls back to the system when storage is blocked', () => {
    setWindow(throwingStorage);
    expect(readThemePreference()).toBe('system');
  });
});

describe('applyThemePreference', () => {
  it('marks an explicit choice on the root element', () => {
    setWindow(new MemoryStorage());
    applyThemePreference('dark');
    expect(root.dataset.theme).toBe('dark');
    applyThemePreference('light');
    expect(root.dataset.theme).toBe('light');
  });

  it('leaves no attribute when following the system', () => {
    setWindow(new MemoryStorage());
    applyThemePreference('dark');
    applyThemePreference('system');
    expect(root.dataset.theme).toBeUndefined();
  });
});

describe('resolveTheme', () => {
  it('returns an explicit choice unchanged', () => {
    setWindow(new MemoryStorage(), true);
    expect(resolveTheme('light')).toBe('light');
    expect(resolveTheme('dark')).toBe('dark');
  });

  it('asks the system when following it', () => {
    setWindow(new MemoryStorage(), true);
    expect(resolveTheme('system')).toBe('dark');
    setWindow(new MemoryStorage(), false);
    expect(resolveTheme('system')).toBe('light');
  });
});
