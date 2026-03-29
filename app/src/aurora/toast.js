const ICONS = { success: 'check_circle', warning: 'warning', error: 'error', info: 'info', loading: 'refresh' };
const DURATIONS = { success: 4000, warning: 5000, error: 6000, info: 4000 };
const MAX_TOASTS = 3;
let counter = 0;
const timers = {}, toasts = {};

function getPortal(position = 'bottom-right') {
  let p = document.getElementById('toast-portal');
  if (!p) {
    p = document.createElement('div');
    p.id = 'toast-portal';
    p.setAttribute('role', 'region');
    p.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(p);
  }
  p.className = `toast-container toast-container--${position}`;
  return p;
}

function getAnnouncer() {
  let a = document.getElementById('toast-announce');
  if (!a) {
    a = document.createElement('div');
    a.id = 'toast-announce';
    a.setAttribute('aria-live', 'polite');
    a.setAttribute('aria-atomic', 'true');
    Object.assign(a.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' });
    document.body.appendChild(a);
  }
  return a;
}

export function dismissToast(tid, immediate = false) {
  const el = toasts[tid];
  if (!el) return;
  if (timers[tid]) { clearTimeout(timers[tid]); delete timers[tid]; }
  if (immediate) { el.remove(); delete toasts[tid]; return; }
  el.classList.add('is-leaving');
  el.addEventListener('animationend', () => { el.remove(); delete toasts[tid]; }, { once: true });
}

export function dismissAllToasts() { Object.keys(toasts).forEach(id => dismissToast(id)); }

export function showToast({ variant = 'info', title = '', description = '', isAlert = false, position = 'bottom-right', action = null, actionLabel = 'Action', duration } = {}) {
  const portal = getPortal(position);
  const tid = `toast-${++counter}`;

  const existing = [...portal.querySelectorAll('.toast:not(.is-leaving)')];
  if (existing.length >= MAX_TOASTS) dismissToast(existing[0].dataset.id, true);

  const isAutoDismiss = duration !== 0 && variant !== 'loading';
  const dur = duration ?? (DURATIONS[variant] || 4000);

  const el = document.createElement('div');
  el.className = `toast toast--${variant} js-managed`;
  el.dataset.id = tid;
  el.setAttribute('role', isAlert || variant === 'error' ? 'alert' : 'status');
  el.setAttribute('aria-atomic', 'true');

  const iconHtml = variant === 'loading'
    ? `<svg class="toast__spinner" viewBox="0 0 24 24"><circle class="spinner-track" cx="12" cy="12" r="9"/><circle class="spinner-arc" cx="12" cy="12" r="9"/></svg>`
    : `<span class="toast__icon material-symbols-outlined">${ICONS[variant] || ICONS.info}</span>`;

  el.innerHTML = `
    ${iconHtml}
    <div class="toast__body">
      <div class="toast__title">${title}</div>
      ${description ? `<div class="toast__message">${description}</div>` : ''}
    </div>
    <button class="toast__close" aria-label="Dismiss notification">
      <span class="material-symbols-outlined" style="font-size:16px">close</span>
    </button>
    ${isAutoDismiss ? `<div class="toast__progress"><div class="toast__progress-bar" style="animation-duration:${dur}ms"></div></div>` : ''}
  `;

  if (action && actionLabel) {
    const btn = document.createElement('button');
    btn.className = 'toast__action';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => { action(tid); dismissToast(tid); });
    el.querySelector('.toast__body').appendChild(btn);
  }

  el.querySelector('.toast__close').addEventListener('click', () => dismissToast(tid));

  el.addEventListener('mouseenter', () => {
    if (timers[tid]) { clearTimeout(timers[tid]); el.querySelector('.toast__progress-bar')?.style.setProperty('animation-play-state', 'paused'); }
  });
  el.addEventListener('mouseleave', () => {
    if (isAutoDismiss) {
      el.querySelector('.toast__progress-bar')?.style.setProperty('animation-play-state', 'running');
      timers[tid] = setTimeout(() => dismissToast(tid), dur * 0.3);
    }
  });

  portal.appendChild(el);
  toasts[tid] = el;
  getAnnouncer().textContent = `${title}${description ? '. ' + description : ''}`;
  if (isAutoDismiss) timers[tid] = setTimeout(() => dismissToast(tid), dur);
  return tid;
}

if (typeof window !== 'undefined') {
  window.AuroraToast = { show: showToast, dismiss: dismissToast, dismissAll: dismissAllToasts };
}
