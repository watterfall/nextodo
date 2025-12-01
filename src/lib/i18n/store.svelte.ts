import type { Language } from '$lib/types';
import zhCN from './zh-CN';
import enUS from './en-US';

// Locale definitions
const locales: Record<Language, typeof zhCN> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

// Reactive state using Svelte 5 runes
let _currentLanguage = $state<Language>('zh-CN');
let _currentLocale = $state<typeof zhCN>(zhCN);

// Initialize from settings or system
export function initI18n(language?: Language): void {
  if (language) {
    setLanguage(language);
  } else {
    // Try to detect from system
    const systemLang = detectSystemLanguage();
    setLanguage(systemLang);
  }
}

// Detect system language
function detectSystemLanguage(): Language {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language || (navigator as any).userLanguage;
    if (lang.startsWith('zh')) {
      return 'zh-CN';
    }
  }
  return 'en-US';
}

// Set language
export function setLanguage(language: Language): void {
  _currentLanguage = language;
  _currentLocale = locales[language] || locales['zh-CN'];

  // Update document language attribute
  if (typeof document !== 'undefined') {
    document.documentElement.lang = language;
  }
}

// Get current language
export function getLanguage(): Language {
  return _currentLanguage;
}

// Export current language as a getter function for reactivity
export function currentLanguage(): Language {
  return _currentLanguage;
}

// Translation function that accesses reactive locale
function translate(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = _currentLocale;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Translation value is not a string: ${key}`);
    return key;
  }

  // Replace parameters
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_: string, name: string) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`
    );
  }

  return value;
}

// Export t as alias for translate
export const t = translate;

// Get date format for current locale
export function getDateFormat(): string {
  return _currentLocale.date.format;
}

// Format date according to locale
export function formatDateLocale(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const format = _currentLocale.date.format;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day);
}

// Get relative date string
export function getRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);

  const diff = Math.floor((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff === 0) return _currentLocale.date.today;
  if (diff === 1) return _currentLocale.date.tomorrow;
  if (diff === -1) return _currentLocale.date.yesterday;

  return formatDateLocale(d);
}

// Export store for reactivity - returns an object with reactive getters
export function getI18nStore() {
  return {
    get language() { return _currentLanguage; },
    get locale() { return _currentLocale; },
    t: translate,
    formatDate: formatDateLocale,
    getRelativeDate,
  };
}

// Available languages
export const availableLanguages: { code: Language; name: string; nativeName: string }[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'en-US', name: 'English (US)', nativeName: 'English' },
];
