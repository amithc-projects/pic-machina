/**
 * ImageChef — HLP: Master Documentation & Help Hub
 *
 * Searchable repository for node documentation powered by Markdown.
 * Provides tag filtering, text searching, and native Before/After split viewers.
 */

import { navigate } from '../main.js';
import { helpCatalog, getHelpRecord } from '../data/help.js';
import { registry } from '../engine/registry.js';

export async function render(container, hash) {
  const params = new URLSearchParams((hash.split('?')[1] || ''));
  const id     = params.get('id');

  if (id) {
    await renderDetail(container, id);
  } else {
    renderIndex(container);
  }
}

// ─── INDEX SCREEN ──────────────────────────────────────────────────
function renderIndex(container) {
  // Extract unique tags globally
  const allTags = new Set(['general']);
  helpCatalog.forEach(c => c.tags.forEach(t => allTags.add(t)));

  container.innerHTML = `
    <div class="screen hlp-screen" style="display:flex;flex-direction:column;height:100%;background:var(--ps-surface)">
      <div class="screen-header" style="flex-shrink:0;">
        <div class="flex items-center gap-2">
           <span class="material-symbols-outlined" style="color:var(--ps-blue)">school</span>
           <div class="screen-title">Documentation</div>
        </div>
      </div>
      
      <div style="padding:24px;max-width:900px;margin:0 auto;width:100%;">
        
        <div style="margin-bottom: 32px;">
          <p class="text-sm text-muted" style="margin:0 0 16px 0; line-height:1.5;">Watch this quick breakdown to master the interface, build powerful chained macro recipes, and unleash localized AI across hundreds of your images in seconds.</p>
          <div style="background:#000; border-radius:8px; overflow:hidden; border:1px solid var(--ps-border); aspect-ratio:16/9; display:flex; align-items:center; justify-content:center; position:relative;">
            <video src="/assets/tutorial.mp4" controls preload="none" style="width:100%; height:100%; outline:none;" poster="/assets/tutorial-poster.jpg"></video>
            <!-- Absolute centered placeholder fallback in case video fails to load or isn't built yet -->
            <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; color:rgba(255,255,255,0.4);" class="video-placeholder">
              <span class="material-symbols-outlined" style="font-size:48px; margin-bottom:12px;">movie</span>
              <span style="font-size:14px; font-weight:500;">Tutorial Video Pending...</span>
            </div>
          </div>
        </div>

        <div style="display:flex;gap:12px;margin-bottom:24px;">
           <input type="text" id="hlp-search" class="ic-input" placeholder="Search documentation..." style="flex:1;padding:12px 16px;font-size:15px">
           <select id="hlp-tag-filter" class="ic-input" style="width:160px;cursor:pointer">
             <option value="">All Tags</option>
             ${Array.from(allTags).map(t => `<option value="${t}">${t}</option>`).join('')}
           </select>
        </div>

        <div id="hlp-results" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:16px;"></div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#hlp-search');
  const tagFilter   = container.querySelector('#hlp-tag-filter');
  const resultsDiv  = container.querySelector('#hlp-results');

  const videoEl = container.querySelector('video');
  const placeholderEl = container.querySelector('.video-placeholder');
  if (videoEl && placeholderEl) {
    videoEl.addEventListener('play', () => { placeholderEl.style.display = 'none'; });
  }

  const updateResults = () => {
    const term = searchInput.value.toLowerCase();
    const tag  = tagFilter.value;

    const filtered = helpCatalog.filter(c => {
      if (tag && !c.tags.includes(tag)) return false;
      if (term) {
        // Search both Title and raw Content natively!
        return c.title.toLowerCase().includes(term) || c.rawContent.toLowerCase().includes(term);
      }
      return true;
    });

    resultsDiv.innerHTML = filtered.length === 0 
      ? `<div class="empty-state" style="grid-column:1/-1;padding:48px 0;">No articles match your search.</div>`
      : filtered.map(c => `
        <div class="hlp-card" data-id="${c.id}" style="background:var(--ps-bg-app);border:1px solid var(--ps-border);border-radius:8px;padding:16px;cursor:pointer;transition:border-color 0.15s, transform 0.15s;">
           <div style="font-weight:600;margin-bottom:8px;font-size:15px;display:flex;align-items:center;gap:6px;">
             ${registry.get(c.id)?.icon ? `<span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-muted)">${registry.get(c.id).icon}</span>` : ''}
             ${c.title}
           </div>
           <div style="display:flex;gap:4px;flex-wrap:wrap">
             ${c.tags.map(t => `<span style="font-size:10px;background:var(--ps-surface);padding:2px 6px;border-radius:4px;color:var(--ps-text-muted);border:1px solid var(--ps-border)">${t}</span>`).join('')}
           </div>
        </div>
      `).join('');
  };

  resultsDiv.addEventListener('click', e => {
    const card = e.target.closest('.hlp-card');
    if (card) navigate('#hlp?id=' + card.dataset.id);
  });

  searchInput.addEventListener('input', updateResults);
  tagFilter.addEventListener('change', updateResults);
  updateResults();
}

// ─── DETAIL SCREEN ─────────────────────────────────────────────────
let markedLib = null;

export async function renderDetail(container, id) {
  const record = getHelpRecord(id) || { title: `Documentation not found (${id})`, body: 'This node does not have a connected markdown page yet.', tags: [] };
  const def = registry.get(id);

  // Lazy-load marked parser
  if (!markedLib) {
    try {
      markedLib = await import('marked');
    } catch(err) {
      console.warn('Marked not installed, falling back to plaintext render.');
    }
  }

  const htmlBody = markedLib ? markedLib.parse(record.body) : `<pre style="white-space:pre-wrap;font-family:inherit;">${record.body}</pre>`;

  // Auto-generate the parameters schema natively
  let paramsHtml = '';
  if (def && def.params && def.params.length > 0) {
    paramsHtml = `
      <h3 style="margin-top:32px;border-bottom:1px solid var(--ps-border);padding-bottom:8px;">Parameters</h3>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:13px">
        <thead>
          <tr style="text-align:left;border-bottom:2px solid var(--ps-border)">
            <th style="padding:8px 12px;font-weight:600">Name</th>
            <th style="padding:8px 12px;font-weight:600">Type</th>
            <th style="padding:8px 12px;font-weight:600">Description</th>
            <th style="padding:8px 12px;font-weight:600">Default</th>
          </tr>
        </thead>
        <tbody>
          ${def.params.map(p => `
            <tr style="border-bottom:1px solid var(--ps-border)">
              <td style="padding:12px;font-family:var(--font-mono);font-size:12px;color:var(--ps-blue)">${p.name}</td>
              <td style="padding:12px;color:var(--ps-text-muted)">${p.type}</td>
              <td style="padding:12px">${p.label || ''}</td>
              <td style="padding:12px;font-family:var(--font-mono);font-size:12px;color:var(--ps-text-muted)">${p.defaultValue !== undefined ? String(p.defaultValue) : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // Inject styles for the Before/After standard viewer (mimicked from image-workspace.js)
  const viewerStyles = `
    <style>
      .hlp-viewer { position:relative; width:100%; height:400px; background:repeating-conic-gradient(var(--ps-bg-surface) 0% 25%, var(--ps-bg-app) 0% 50%) 0 0/24px 24px; border-radius:12px; overflow:hidden; border:1px solid var(--ps-border); margin-bottom:32px; }
      
      .hlp-layout-toggles { display:flex; position:absolute; top:12px; right:12px; z-index:20; background:rgba(0,0,0,0.6); padding:4px; border-radius:6px; backdrop-filter:blur(4px); }
      .hlp-layout-btn { background:transparent; border:none; color:rgba(255,255,255,0.6); width:28px; height:28px; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; }
      .hlp-layout-btn:hover { color:#fff; }
      .hlp-layout-btn.is-active { background:rgba(255,255,255,0.2); color:#fff; }

      .hlp-cmp-label { position:absolute;top:10px;padding:4px 8px;background:rgba(0,0,0,0.6);color:#fff;border-radius:4px;font-size:11px;font-weight:500;z-index:5;pointer-events:none;backdrop-filter:blur(4px); }
      
      /* Slider */
      .hlp-cmp-wrap { position:absolute;inset:0;width:100%;height:100%;display:flex; }
      .hlp-cmp-img { position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:block;pointer-events:none; }
      .hlp-cmp-handle { position:absolute;top:0;bottom:0;width:20px;margin-left:-10px;cursor:col-resize;display:flex;align-items:center;justify-content:center;z-index:10; }
      
      /* Side by Side */
      .hlp-side-view { display:flex;width:100%;height:100%; }
      .hlp-side { flex:1;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden; }
      
      .hlp-markdown { line-height:1.6; font-size:15px; color:var(--ps-text); }
      .hlp-markdown h1, .hlp-markdown h2, .hlp-markdown h3 { margin-top:1.5em; margin-bottom:0.5em; font-weight:600; }
      .hlp-markdown p { margin-bottom:1em; }
      .hlp-markdown code { font-family:var(--font-mono); background:var(--ps-surface); padding:2px 6px; border-radius:4px; font-size:0.9em; }
      .hlp-markdown pre { background:var(--ps-bg-app); padding:16px; border-radius:8px; overflow-x:auto; border:1px solid var(--ps-border); margin-bottom:1em; }
    </style>
  `;

  container.innerHTML = `
    ${viewerStyles}
    <div class="screen hlp-screen" style="display:flex;flex-direction:column;height:100%;background:var(--ps-bg-app);overflow-y:auto;">
      <div class="screen-header" style="flex-shrink:0;">
        <div class="flex items-center gap-2">
           <button class="btn-icon" id="hlp-back">
             <span class="material-symbols-outlined">arrow_back</span>
           </button>
           <span class="material-symbols-outlined" style="color:var(--ps-text-muted)">${def?.icon || 'help'}</span>
           <div class="screen-title">${record.title}</div>
           ${record.tags.map(t => `<span style="margin-left:8px;font-size:11px;background:var(--ps-surface);padding:2px 8px;border-radius:12px;color:var(--ps-text-muted);border:1px solid var(--ps-border)">${t}</span>`).join('')}
        </div>
      </div>
      
      <div style="padding:32px 24px;max-width:800px;margin:0 auto;width:100%;">
        
        <!-- Viewer Section -->
        <div class="hlp-viewer" id="hlp-viewer-mount" style="display:none;">
           <div class="hlp-layout-toggles">
             <button class="hlp-layout-btn is-active" data-layout="slider" title="Slider Mode"><span class="material-symbols-outlined" style="font-size:16px">swap_horiz</span></button>
             <button class="hlp-layout-btn" data-layout="side" title="Side-by-side Mode"><span class="material-symbols-outlined" style="font-size:16px">vertical_split</span></button>
           </div>
           <div id="hlp-layout-canvas" style="position:absolute;inset:0;"></div>
        </div>

        <div class="hlp-markdown">
           ${htmlBody}
        </div>
        
        ${paramsHtml}
      </div>
    </div>
  `;

  container.querySelector('#hlp-back').addEventListener('click', () => { window.history.back(); });

  // ── Viewer Image Probing Logic ──
  const beforeImg = new Image();
  const afterImg = new Image();
  let hasBefore = false;
  let hasAfter = false;
  let layoutMode = 'slider';

  const mountContainer = container.querySelector('#hlp-viewer-mount');
  const canvasContainer = container.querySelector('#hlp-layout-canvas');
  
  const renderLayout = () => {
    if (!hasBefore && !hasAfter) return; // Images didn't load
    mountContainer.style.display = 'block';

    if (layoutMode === 'slider') {
      canvasContainer.innerHTML = `
        <div class="hlp-cmp-wrap" id="hlp-wrap">
          ${hasBefore ? `<img class="hlp-cmp-img" id="hlp-before" src="/help/${id}.before.png" style="clip-path:inset(0 50% 0 0)">` : ''}
          ${hasAfter  ? `<img class="hlp-cmp-img" id="hlp-after" src="/help/${id}.after.png" style="clip-path:inset(0 0 0 50%)">` : ''}
          <div class="hlp-cmp-handle" id="hlp-handle" style="left:50%">
             <div style="position:absolute;top:0;bottom:0;left:9px;width:2px;background:#fff;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>
             <div style="position:relative;width:28px;height:28px;background:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.3);color:#333;z-index:2"><span class="material-symbols-outlined" style="font-size:18px">swap_horiz</span></div>
          </div>
          <span class="hlp-cmp-label" style="left:10px;">Before</span>
          <span class="hlp-cmp-label" style="right:10px;background:var(--ps-blue)">After</span>
        </div>
      `;

      const wrap = canvasContainer.querySelector('#hlp-wrap');
      const handle = canvasContainer.querySelector('#hlp-handle');
      const iBefore = canvasContainer.querySelector('#hlp-before');
      const iAfter = canvasContainer.querySelector('#hlp-after');
      let dragging = false;

      const setPos = cx => {
        const rect = wrap.getBoundingClientRect();
        const pos = Math.max(0.01, Math.min(0.99, (cx - rect.left) / rect.width));
        const pct = (pos * 100).toFixed(1);
        handle.style.left = `${pct}%`;
        if (iBefore) iBefore.style.clipPath = `inset(0 ${(100 - pos * 100).toFixed(1)}% 0 0)`;
        if (iAfter)  iAfter.style.clipPath = `inset(0 0 0 ${pct}%)`;
      };

      handle.addEventListener('mousedown', e => { dragging = true; e.preventDefault(); });
      window.addEventListener('mousemove', e => { if (dragging) setPos(e.clientX); });
      window.addEventListener('mouseup', () => { dragging = false; });
    } 
    else if (layoutMode === 'side') {
      canvasContainer.innerHTML = `
        <div class="hlp-side-view">
          <div class="hlp-side">
            <span class="hlp-cmp-label" style="left:10px;">Before</span>
            ${hasBefore ? `<img src="/help/${id}.before.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">` : ''}
          </div>
          <div style="width:2px;background:var(--ps-border);z-index:2;"></div>
          <div class="hlp-side">
            <span class="hlp-cmp-label" style="left:10px;background:var(--ps-blue)">After</span>
            ${hasAfter ? `<img src="/help/${id}.after.png" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;">` : ''}
          </div>
        </div>
      `;
    }
  };

  // Toggle Bindings
  const toggles = container.querySelectorAll('.hlp-layout-btn');
  toggles.forEach(btn => btn.addEventListener('click', () => {
    toggles.forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    layoutMode = btn.dataset.layout;
    renderLayout();
  }));

  // Probe Files asynchronously
  beforeImg.onload = () => { hasBefore = true; renderLayout(); };
  afterImg.onload = () => { hasAfter = true; renderLayout(); };
  beforeImg.src = `/help/${id}.before.png`;
  afterImg.src = `/help/${id}.after.png`;
}
