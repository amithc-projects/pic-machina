export function initDrawers() {
  let activeDrawer = null;

  let backdrop = document.getElementById('drawer-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'drawer-backdrop';
    backdrop.className = 'drawer-backdrop';
    document.body.appendChild(backdrop);
  }

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-drawer-target]');
    if (trigger) { e.preventDefault(); openDrawer(trigger.getAttribute('data-drawer-target')); return; }
    const closeBtn = e.target.closest('.drawer-close');
    if (closeBtn || e.target === backdrop) { e.preventDefault(); closeActive(); }
  });

  function openDrawer(id) {
    if (activeDrawer) closeActive(true);
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.classList.remove('is-closing');
    backdrop.classList.remove('is-closing');
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    activeDrawer = id;
    requestAnimationFrame(() => {
      const focusable = panel.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      focusable?.focus();
    });
    panel.addEventListener('keydown', trapFocus);
    document.addEventListener('keydown', handleEscape);
  }

  window.closeDrawer = closeActive;
  function closeActive(immediate = false) {
    if (!activeDrawer) return;
    const panel = document.getElementById(activeDrawer);
    if (!panel) return;
    panel.classList.add('is-closing');
    backdrop.classList.add('is-closing');
    setTimeout(() => {
      panel.classList.remove('is-open', 'is-closing');
      backdrop.classList.remove('is-open', 'is-closing');
      document.body.style.overflow = '';
    }, immediate ? 0 : 300);
    panel.removeEventListener('keydown', trapFocus);
    document.removeEventListener('keydown', handleEscape);
    activeDrawer = null;
  }

  function handleEscape(e) { if (e.key === 'Escape') closeActive(); }

  function trapFocus(e) {
    if (e.key !== 'Tab') return;
    const panel = document.getElementById(activeDrawer);
    if (!panel) return;
    const focusables = [...panel.querySelectorAll('button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
}
