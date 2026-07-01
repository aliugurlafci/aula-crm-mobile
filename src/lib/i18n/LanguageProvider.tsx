/**
 * Language — the active UI language ('en' | 'tr' | 'de') now lives in the Redux
 * `settings` slice (persisted + best-effort mirrored to the server), so the
 * choice is app-wide and survives relaunches. `t()` looks a key up in the active
 * language, falls back to English, and interpolates `{name}` placeholders.
 * `useI18n()` keeps its original shape; `LanguageProvider` is a pass-through.
 */
import { useCallback, useMemo } from 'react';

import { useAppDispatch, useAppSelector } from '@/lib/store';
import { setLanguage, syncPreferencesToServer } from '@/lib/store/settingsSlice';
import { translations, type Lang, type TKey } from './translations';

type Vars = Record<string, string | number>;

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TKey, vars?: Vars) => string;
};

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useI18n(): I18nValue {
  const dispatch = useAppDispatch();
  const lang = useAppSelector((s) => s.settings.language);

  const setLang = useCallback(
    (next: Lang) => {
      dispatch(setLanguage(next));
      void dispatch(syncPreferencesToServer());
    },
    [dispatch],
  );

  const t = useCallback(
    (key: TKey, vars?: Vars) => interpolate(translations[lang][key] ?? translations.en[key] ?? key, vars),
    [lang],
  );

  return useMemo<I18nValue>(() => ({ lang, setLang, t }), [lang, setLang, t]);
}
