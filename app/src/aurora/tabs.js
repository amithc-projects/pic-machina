export function initTabs(root = document) {
  root.querySelectorAll('.tabs').forEach(container => {
    const tablist = container.querySelector('[role="tablist"]');
    if (!tablist) return;
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const isVertical = tablist.getAttribute('aria-orientation') === 'vertical';

    tabs.forEach(tab => {
      tab.addEventListener('click', () => activate(tab, tabs));
      tab.addEventListener('keydown', e => {
        const idx = tabs.indexOf(e.target);
        const prev = isVertical ? 'ArrowUp' : 'ArrowLeft';
        const next = isVertical ? 'ArrowDown' : 'ArrowRight';
        if (e.key === next)      { e.preventDefault(); focus(tabs, (idx + 1) % tabs.length); }
        else if (e.key === prev) { e.preventDefault(); focus(tabs, (idx - 1 + tabs.length) % tabs.length); }
        else if (e.key === 'Home') { e.preventDefault(); focus(tabs, 0); }
        else if (e.key === 'End')  { e.preventDefault(); focus(tabs, tabs.length - 1); }
      });
    });
  });
}

function focus(tabs, idx) {
  tabs[idx].focus();
  activate(tabs[idx], tabs);
}

function activate(tab, tabs) {
  if (tab.getAttribute('aria-disabled') === 'true') return;
  tabs.forEach(t => {
    const selected = t === tab;
    t.setAttribute('aria-selected', String(selected));
    t.setAttribute('tabindex', selected ? '0' : '-1');
    const panelId = t.getAttribute('aria-controls');
    if (panelId) {
      const panel = document.getElementById(panelId);
      if (panel) selected ? panel.removeAttribute('hidden') : panel.setAttribute('hidden', '');
    }
  });
}
