/**
 * ImageChef — main entry point
 * Sets up the hash router, wires the nav rail, and initialises global Aurora components.
 */

import { initDrawers } from './aurora/drawer.js';
import { showToast }   from './aurora/toast.js';
import { initDB }      from './data/db.js';
import { applyThemeColors } from './utils/settings.js';
import { commitFolderState } from './data/folder-state.js';
import { initI18n, changeLanguage, getLanguage, onLanguageChange, SUPPORTED_LANGUAGES, t } from './i18n/index.js';

/**
 * Translate static DOM nodes that carry data-i18n / data-i18n-title /
 * data-i18n-aria-label attributes (e.g. the nav rail in index.html).
 * Called once at boot and again on every language change.
 */
function translateStaticDom() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  });
}

// Monotonically-increasing counter — incremented on every navigate call so that
// if two navigations race (e.g. double hashchange), only the latest doSwap runs.
let _navVersion = 0;

// Screen module map — lazy loaded on demand
const SCREENS = {
  get: () => import('./screens/get.js'),
  lib: () => import('./screens/lib.js'),
  set: () => import('./screens/set.js'),
  ned: () => import('./screens/ned.js'),
  bld: () => import('./screens/bld.js'),
  bkb: () => import('./screens/bkb.js'),
  tpl: () => import('./screens/tpl.js'),
  ins: () => import('./screens/ins.js'),
  pvw: () => import('./screens/pvw.js'),
  que: () => import('./screens/que.js'),
  out: () => import('./screens/out.js'),
  cmp: () => import('./screens/cmp.js'),
  tme: () => import('./screens/tme.js'),
  fld: () => import('./screens/fld.js'),
  shc: () => import('./screens/shc.js'),
  mdl: () => import('./screens/mdl.js'),
  gsd: () => import('./screens/gsd.js'),
  pow: () => import('./screens/pow.js'),
  hlp: () => import('./screens/hlp.js'),
  aud: () => import('./screens/aud.js'),
  snd: () => import('./screens/snd.js'),
  sys: () => import('./screens/sys.js'),
  bup: () => import('./screens/bup.js'),
  gmd: () => import('./screens/gmd.js'),
  ime: () => import('./screens/ime.js'),
  lic: () => import('./screens/lic.js'),
};

const DEFAULT_SCREEN = 'gsd';

// ─── State ────────────────────────────────────────────────
let currentScreen = null;
let currentCleanup = null;

// ─── Router ───────────────────────────────────────────────
async function navigate(hash) {
  // Normalize missing hash
  if (!hash) hash = `#${DEFAULT_SCREEN}`;

  // If we are programmatically navigating to a new hash, update the URL
  // and let the window 'hashchange' event trigger the actual render pass.
  if (location.hash !== hash) {
    location.hash = hash;
    return;
  }

  // Snapshot folder state NOW — synchronously, before any awaits and before
  // the old screen's sidekick can unmount and corrupt _subPath.
  commitFolderState();

  // Stamp this navigation so we can detect if a newer one starts while we
  // are awaiting async work (settings load, cleanup, module load).
  const myNavVersion = ++_navVersion;

  const screenId = (hash.replace('#', '') || DEFAULT_SCREEN).split('/')[0].split('?')[0];
  
  // Guard premium screens
  const { getSettings } = await import('./utils/settings.js');
  const s = getSettings();
  const isPro = s.license === 'Pro' || s.license === 'Enterprise';

  // Update navigation badges visibility based on license
  document.querySelectorAll('.nav-premium-badge').forEach(el => {
    el.style.display = isPro ? 'none' : 'inline-block';
  });

  if (screenId === 'pow' || screenId === 'bup') {
    if (!isPro) {
      window.AuroraToast?.show({ variant: 'error', title: t('nav.proRequired'), description: t('nav.proRequiredDesc') });
      if (currentScreen) location.hash = `#${currentScreen}`;
      else location.hash = `#${DEFAULT_SCREEN}`;
      return;
    }
  }

  const loader = SCREENS[screenId] || SCREENS[DEFAULT_SCREEN];

  // Update nav active state
  document.querySelectorAll('.app-nav__item').forEach(el => {
    el.classList.toggle('is-active', el.dataset.screen === screenId);
  });

  // Run previous screen cleanup if any
  if (currentCleanup) {
    await Promise.resolve(currentCleanup());
    currentCleanup = null;
  }

  const container = document.getElementById('screen-container');

  // Pre-load the module before starting the transition so network latency doesn't
  // stall the animation (subsequent visits use the cached module — effectively instant)
  let mod;
  try {
    mod = await loader();
  } catch (err) {
    console.error(`[router] Failed to load screen "${screenId}"`, err);
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">${t('nav.screenFailedToLoad')}</div>
        <div class="empty-state-desc">${err.message}</div>
      </div>`;
    return;
  }

  const doSwap = async () => {
    // If a newer navigation started while we were awaiting async work above,
    // this doSwap is stale — abort so only the latest navigation renders.
    if (_navVersion !== myNavVersion) return;
    container.innerHTML = '';
    if (typeof mod.render === 'function') {
      const wrapper = document.createElement('div');
      wrapper.style.height = '100%';
      container.appendChild(wrapper);
      currentCleanup = await mod.render(wrapper, hash) ?? null;
      currentScreen = screenId;
    }
  };

  if ('startViewTransition' in document) {
    // Modern path: smooth compositor cross-fade between old and new screen
    document.startViewTransition(doSwap);
  } else {
    // Fallback: run swap then apply the CSS-only enter animation
    await doSwap();
    container.firstElementChild?.classList.add('screen-enter');
  }
}

// ─── Hash change listener ─────────────────────────────────
window.addEventListener('hashchange', () => navigate(location.hash));

// ─── Theme toggle ─────────────────────────────────────────
document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
  const html = document.documentElement;
  const isDark = html.dataset.mode === 'dark';
  html.dataset.mode = isDark ? 'light' : 'dark';
  localStorage.setItem('ic-theme', html.dataset.mode);
});

// Restore saved theme
const savedTheme = localStorage.getItem('ic-theme');
if (savedTheme) document.documentElement.dataset.mode = savedTheme;

// ─── Boot ─────────────────────────────────────────────────
/**
 * Build a language picker into the nav footer and wire it to changeLanguage.
 * Re-rendering of the current screen on language change is handled by the
 * onLanguageChange subscription below.
 */
function initLanguagePicker() {
  const footer = document.querySelector('.app-nav__footer');
  if (!footer || footer.querySelector('#lang-picker')) return;

  const sel = document.createElement('select');
  sel.id = 'lang-picker';
  sel.className = 'app-nav__lang';
  sel.title = t('common.language');
  sel.setAttribute('aria-label', t('common.language'));
  sel.innerHTML = SUPPORTED_LANGUAGES
    .map(l => `<option value="${l.code}">${l.nativeLabel}</option>`)
    .join('');
  sel.value = getLanguage().split('-')[0];
  sel.addEventListener('change', () => changeLanguage(sel.value));
  footer.appendChild(sel);
}

async function boot() {
  applyThemeColors();
  await initI18n();
  translateStaticDom();

  // Re-render the current screen (and refresh the picker) on language change.
  onLanguageChange(() => {
    const picker = document.getElementById('lang-picker');
    if (picker) picker.value = getLanguage().split('-')[0];
    translateStaticDom();
    navigate(location.hash || `#${DEFAULT_SCREEN}`);
  });

  initLanguagePicker();

  try {
    await initDB();
  } catch (err) {
    console.error('[boot] DB init failed', err);
    showToast({ variant: 'error', title: t('nav.databaseError'), description: err.message });
  }

  initDrawers();

  // Nav links now route natively to screens in index.html.

  // Navigate to initial screen
  const initialHash = location.hash || `#${DEFAULT_SCREEN}`;
  navigate(initialHash);
}

boot();

// ─── Global helpers exposed for screen modules ────────────
export { navigate, showToast };
