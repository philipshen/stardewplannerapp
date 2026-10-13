/** UI language: 12 languages like the web planner. Item names stay in English. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { en, Key } from './en';
import { TRANSLATIONS } from './translations';

export type { Key };

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'de', label: 'Deutsch' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'hu', label: 'Magyar' },
  { id: 'it', label: 'Italiano' },
  { id: 'ja', label: '日本語' },
  { id: 'ko', label: '한국어' },
  { id: 'pt', label: 'Português' },
  { id: 'ru', label: 'Русский' },
  { id: 'tr', label: 'Türkçe' },
  { id: 'zh', label: '中文' },
] as const;
export type Lang = (typeof LANGUAGES)[number]['id'];

const KEY = 'sdp:lang:v1';
const isLang = (s: string): s is Lang => LANGUAGES.some((l) => l.id === s);

function deviceLang(): Lang {
  try {
    const code = Intl.DateTimeFormat().resolvedOptions().locale.slice(0, 2).toLowerCase();
    return isLang(code) ? code : 'en';
  } catch {
    return 'en';
  }
}

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  let s: string = TRANSLATIONS[lang]?.[key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

type LangState = { lang: Lang; setLang: (l: Lang) => void; load: () => Promise<void> };

export const useLang = create<LangState>((set) => ({
  lang: deviceLang(),
  setLang(lang) {
    set({ lang });
    AsyncStorage.setItem(KEY, lang).catch(() => {});
  },
  async load() {
    try {
      const saved = await AsyncStorage.getItem(KEY);
      if (saved && isLang(saved)) set({ lang: saved });
    } catch { /* keep the device language */ }
  },
}));

export type T = (key: Key, vars?: Record<string, string | number>) => string;

/** Hook: returns a translate function and re-renders when the language changes. */
export function useT(): T {
  const lang = useLang((s) => s.lang);
  return (key, vars) => translate(lang, key, vars);
}

/** For code outside React (toasts, alerts). */
export const t: T = (key, vars) => translate(useLang.getState().lang, key, vars);

const REASONS: [RegExp, Key][] = [
  [/^Outside the map$/, 'reason.outside'],
  [/^Wall decor/, 'reason.wall'],
  [/^Must be placed in water$/, 'reason.water'],
  [/^Buildings go on the farm$/, 'reason.indoors'],
  [/^Crops need/, 'reason.tillable'],
  [/^Can't build/, 'reason.terrain'],
  [/^A crop is planted/, 'reason.crop'],
  [/^Remove the flooring/, 'reason.flooring'],
];

/** The planner model reports placement problems in English; this maps them to the UI language. */
export function translateReason(reason: string): string {
  for (const [re, key] of REASONS) if (re.test(reason)) return t(key);
  const m = /^(.*) is in the way$/.exec(reason);
  return m ? t('reason.blocked', { name: m[1] }) : reason;
}
