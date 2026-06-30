/**
 * Language context — holds the active UI language ('en' | 'tr' | 'de'), persisted
 * in SecureStore so the choice survives relaunches (mirrors ThemeProvider). The
 * `t()` helper looks up a key in the active language, falls back to English for
 * anything not yet translated, and interpolates `{name}` placeholders. Every
 * component reads it via `useI18n()`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';

import { LANGUAGES, translations, type Lang, type TKey } from './translations';

const STORE_KEY = 'aula.language';

type Vars = Record<string, string | number>;

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(STORE_KEY)
      .then((stored) => {
        if (alive && isLang(stored)) setLangState(stored);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    SecureStore.setItemAsync(STORE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Vars) => interpolate(translations[lang][key] ?? translations.en[key] ?? key, vars),
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}
