/**
 * ZumiLabs Studio — i18n harness (vanilla i18next core)
 *
 * Uses i18next core directly (no React adapter — this app is vanilla JS and
 * renders screens via template-literal innerHTML).
 *
 * Key conventions (mirrored from the ux-file-manager / zumilabs-file-browser
 * web component so translations stay consistent across the embedded browser):
 *   - Namespaced keys: `screen.key`, `common.*`
 *   - Plurals via `_one` / `_other` suffixes + `{{count}}`
 *   - Interpolation via `{{var}}`
 *
 * The active language is persisted under the SHARED localStorage key
 * `zl-fm-lang` so the host app and the embedded <zumilabs-file-browser>
 * element stay in lockstep (the file browser reads the same key and we also
 * push it down via the element's `lang` attribute).
 */

import i18next from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import de from './locales/de.json';

export const LANG_STORAGE_KEY = 'zl-fm-lang';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',  nativeLabel: 'English'  },
  { code: 'de', label: 'German',   nativeLabel: 'Deutsch'  },
];

const FALLBACK_LANG = 'en';

// Listeners notified on every language change so screens can re-render.
const _listeners = new Set();

let _initialized = false;

/**
 * Initialise i18next. Must be awaited in main.js before the first render so
 * that `t()` returns translated strings on the very first paint.
 */
export async function initI18n() {
  if (_initialized) return i18next;

  await i18next
    .use(LanguageDetector)
    .init({
      fallbackLng: FALLBACK_LANG,
      supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
      nonExplicitSupportedLngs: true, // 'de-DE' -> 'de'
      resources: {
        en: { translation: en },
        de: { translation: de },
      },
      interpolation: { escapeValue: false }, // we render trusted template strings
      detection: {
        // Read/write the shared key; fall back to <html lang> / navigator.
        order: ['localStorage', 'htmlTag', 'navigator'],
        lookupLocalStorage: LANG_STORAGE_KEY,
        caches: ['localStorage'],
      },
    });

  document.documentElement.setAttribute('lang', i18next.language || FALLBACK_LANG);
  _initialized = true;
  return i18next;
}

/** Translate a key. Thin wrapper so screens import from one place. */
export function t(key, opts) {
  return i18next.t(key, opts);
}

/** Current active language code (e.g. 'en', 'de'). */
export function getLanguage() {
  return i18next.language || FALLBACK_LANG;
}

/**
 * Change the active language, persist it, push it onto every mounted
 * <zumilabs-file-browser> element, and notify listeners (screens re-render).
 */
export async function changeLanguage(lang) {
  await i18next.changeLanguage(lang);
  try { localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* private mode */ }
  document.documentElement.setAttribute('lang', lang);

  // Keep any embedded file-browser instances in sync.
  document.querySelectorAll('zumilabs-file-browser').forEach(el => {
    el.setAttribute('lang', lang);
  });

  _listeners.forEach(fn => { try { fn(lang); } catch { /* listener error is non-fatal */ } });
}

/**
 * Subscribe to language changes. Returns an unsubscribe function.
 * Typical use: a screen registers a re-render callback on mount and the
 * returned unsubscribe is called from its cleanup.
 */
export function onLanguageChange(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export { i18next };
