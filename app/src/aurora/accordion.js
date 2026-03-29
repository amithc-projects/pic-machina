export function initAccordions(root = document) {
  const accordions = root.querySelectorAll('.accordion');
  accordions.forEach(acc => {
    const mode = acc.dataset.mode || 'multiple';
    const triggers = acc.querySelectorAll('.accordion-trigger');
    triggers.forEach(trigger => {
      if (trigger.getAttribute('aria-disabled') === 'true') return;
      trigger.addEventListener('click', () => {
        const isOpen = trigger.getAttribute('aria-expanded') === 'true';
        const panelId = trigger.getAttribute('aria-controls');
        const panel = document.getElementById(panelId);
        if (mode === 'single' && !isOpen) {
          triggers.forEach(t => {
            t.setAttribute('aria-expanded', 'false');
            const id = t.getAttribute('aria-controls');
            if (id) document.getElementById(id)?.classList.remove('is-open');
          });
        }
        trigger.setAttribute('aria-expanded', String(!isOpen));
        panel?.classList.toggle('is-open', !isOpen);
      });
    });
  });
}
