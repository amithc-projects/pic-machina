/**
 * ImageChef — main entry point
 * Sets up the hash router, wires the nav rail, and initialises global Aurora components.
 */

import { initDrawers } from './aurora/drawer.js';
import { showToast }   from './aurora/toast.js';
import { initDB }      from './data/db.js';
import { applyThemeColors } from './utils/settings.js';

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
  fld: () => import('./screens/fld.js'),
  shc: () => import('./screens/shc.js'),
  mdl: () => import('./screens/mdl.js'),
  gsd: () => import('./screens/gsd.js'),
};

const DEFAULT_SCREEN = 'gsd';

// ─── State ────────────────────────────────────────────────
let currentScreen = null;
let currentCleanup = null;

// ─── Router ───────────────────────────────────────────────
async function navigate(hash) {
  const screenId = (hash.replace('#', '') || DEFAULT_SCREEN).split('/')[0].split('?')[0];
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
  container.innerHTML = '<div class="screen-loading"><div class="spinner spinner--lg"></div></div>';

  try {
    const mod = await loader();
    if (typeof mod.render === 'function') {
      container.innerHTML = '';
      const wrapper = document.createElement('div');
      wrapper.className = 'screen-enter';
      wrapper.style.height = '100%';
      container.appendChild(wrapper);
      currentCleanup = await mod.render(wrapper, hash) ?? null;
      currentScreen = screenId;
    }
  } catch (err) {
    console.error(`[router] Failed to load screen "${screenId}"`, err);
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">error_outline</span>
        <div class="empty-state-title">Screen failed to load</div>
        <div class="empty-state-desc">${err.message}</div>
      </div>`;
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
async function boot() {
  applyThemeColors();
  try {
    await initDB();
  } catch (err) {
    console.error('[boot] DB init failed', err);
    showToast({ variant: 'error', title: 'Database error', description: err.message });
  }

  initDrawers();

  // Setup Backup UI Module
  document.getElementById('nav-db-backup')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { showBackupModal } = await import('./utils/backup.js');
    showBackupModal();
  });

  // Setup Help UI Module
  document.getElementById('nav-help')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { showHelpModal } = await import('./utils/help.js');
    showHelpModal();
  });

  // Setup Settings UI Module
  document.getElementById('nav-settings')?.addEventListener('click', async (e) => {
    e.preventDefault();
    const { showSettingsModal } = await import('./utils/settings-dialog.js');
    showSettingsModal();
  });

  // Navigate to initial screen
  const initialHash = location.hash || `#${DEFAULT_SCREEN}`;
  navigate(initialHash);
}

boot();

// ─── Global helpers exposed for screen modules ────────────
export { navigate, showToast };
