/**
 * ImageChef — LIB: Recipe Library
 *
 * Home screen. Shows all recipes in a responsive grid.
 * Users can browse, preview, create, or clone recipes.
 */

import { getAllRecipes, deleteRecipe, cloneRecipe, saveRecipe, getRecipeBundle, saveRecipeBundle, clearRecipeThumbnail } from '../data/recipes.js';
import { checkRecipeAvailability } from '../engine/capabilities.js';
import { navigate } from '../main.js';
import { formatDate, uuid, now } from '../utils/misc.js';
import { initTabs } from '../aurora/tabs.js';
import { countNodes } from '../utils/nodes.js';
import { showConfirm } from '../utils/dialogs.js';

// Curated tag → category map. Tags not listed here fall into "Other".
// Keys are normalised to lowercase; matching is case-insensitive.
const TAG_CATEGORIES = (() => {
  const groups = {
    'Era':         ['1970s', '80s', '8-bit', 'vintage', 'retro', 'retrowave', 'classic', 'cga', 'crt'],
    'Style':       ['cartoon', 'noir', 'cyberpunk', 'synthwave', 'vaporwave', 'popart', 'warhol', 'impressionist',
                    'painting', 'sketch', 'comic', 'graphic novel', 'fantasy', 'horror', 'illustration', 'artistic',
                    'art', 'pixel art', 'cel shading', 'minimal', 'bold', 'moody', 'cinematic'],
    'Look':        ['aerochrome', 'analog', 'lomo', 'polaroid', 'faded', 'fade', 'glitch', 'halftone', 'dither',
                    'grain', 'blur', 'glow', 'neon', 'duotone', 'monochrome', 'black-and-white', 'black and white',
                    'tint', 'tilt-shift', 'infrared', 'overlay', 'matte', 'edges', 'sharpness'],
    'Format':      ['gif', 'webp', 'png', 'jpeg', 'video', 'film', 'animation', 'slideshow', 'slideshow video',
                    'reels', 'tiktok', 'instagram', 'social', 'thumbnail', 'thumbnails', 'icons', 'preview', 'web'],
    'Function':    ['resize', 'crop', 'sort', 'organise', 'watermark', 'stack', 'swap', 'export', 'triage',
                    'aggreagation', 'aggregation', 'composite', 'filter', 'effect', 'border', 'frames'],
    'Metadata':    ['exif', 'gps', 'geocode', 'copyright', 'date', 'location', 'privacy', 'id', 'security'],
    'Composition': ['square', 'portrait', 'landscape', 'panorama', 'picture-in-picture', 'split-layout', 'grid',
                    'circular', 'aspect ratio', 'wall'],
    'Subject':     ['faces', 'people', 'talking head', 'room', 'travel', 'gallery', 'folder', 'background'],
    'Tech':        ['ai', 'ml', 'performance', 'quality', 'corporate', 'creative', 'branding', 'template',
                    'typography', 'text', 'caption', 'logo', 'map', 'metadata', 'miniature'],
  };
  const map = {};
  for (const [cat, tags] of Object.entries(groups)) {
    for (const t of tags) map[t.toLowerCase()] = cat;
  }
  return map;
})();
const CATEGORY_ORDER = ['Era', 'Style', 'Look', 'Format', 'Function', 'Composition', 'Subject', 'Metadata', 'Tech', 'Other'];
const POPULAR_LIMIT = 8;
const COLLAPSE_THRESHOLD = 8; // Below this many tags, render the simple inline row

// Category colours for cover gradients
const COVER_GRADIENTS = {
  '#0077ff': 'linear-gradient(135deg, #0a1628 0%, #0044cc 100%)',
  '#8b5cf6': 'linear-gradient(135deg, #1a0a2e 0%, #6d28d9 100%)',
  '#22c55e': 'linear-gradient(135deg, #0a1e10 0%, #15803d 100%)',
  '#f59e0b': 'linear-gradient(135deg, #1e150a 0%, #b45309 100%)',
  '#f472b6': 'linear-gradient(135deg, #1e0a14 0%, #be185d 100%)',
  '#374151': 'linear-gradient(135deg, #111318 0%, #374151 100%)',
  '#92400e': 'linear-gradient(135deg, #1a0e06 0%, #92400e 100%)',
  '#0ea5e9': 'linear-gradient(135deg, #060e1a 0%, #0369a1 100%)',
};

function getCoverStyle(recipe) {
  // When a thumbnail exists it is rendered as an <img> (so GIFs animate),
  // so we only set the gradient/background here for the no-thumbnail case.
  if (recipe.thumbnail) return '';
  const grad = COVER_GRADIENTS[recipe.coverColor] || 'linear-gradient(135deg, #111318 0%, #1e293b 100%)';
  if (recipe.isSystem) {
    return `background: url(./samples/${recipe.id}.jpg) center/cover, ${grad};`;
  }
  return `background: ${grad};`;
}


function recipeCardHTML(recipe) {
  const nodeCount = countNodes(recipe.nodes);
  const updated = recipe.updatedAt ? formatDate(recipe.updatedAt) : '—';
  const isSystem = recipe.isSystem;

  return `
    <article class="lib-card" data-id="${recipe.id}" tabindex="0" role="button" aria-label="Recipe: ${recipe.name}">
      <div class="lib-card__cover" style="${getCoverStyle(recipe)}">
        ${recipe.thumbnail ? `<img src="${recipe.thumbnail}" class="lib-card__thumb-img" alt="">` : ''}
        <div class="lib-card__cover-overlay">
          <div class="lib-card__badges">
            ${isSystem
              ? '<span class="ic-badge ic-badge--blue"><span class="material-symbols-outlined" style="font-size:11px">lock</span> System</span>'
              : '<span class="ic-badge ic-badge--green"><span class="material-symbols-outlined" style="font-size:11px">person</span> Yours</span>'}
          </div>
          <div class="lib-card__quick-actions">
            <button class="btn-icon lib-action-preview" data-id="${recipe.id}" title="Preview recipe">
              <span class="material-symbols-outlined">preview</span>
            </button>
            ${isSystem
              ? `<button class="btn-icon lib-action-clone" data-id="${recipe.id}" title="Clone recipe">
                   <span class="material-symbols-outlined">content_copy</span>
                 </button>`
              : `<button class="btn-icon lib-action-edit" data-id="${recipe.id}" title="Edit recipe">
                   <span class="material-symbols-outlined">edit</span>
                 </button>
                 <button class="btn-icon lib-action-export" data-id="${recipe.id}" title="Export to JSON">
                   <span class="material-symbols-outlined">download</span>
                 </button>
                 ${recipe.thumbnail ? `<button class="btn-icon lib-action-remove-thumb" data-id="${recipe.id}" title="Remove thumbnail">
                   <span class="material-symbols-outlined" style="color:var(--ps-text-muted)">hide_image</span>
                 </button>` : ''}
                 <button class="btn-icon lib-action-delete" data-id="${recipe.id}" title="Delete recipe">
                   <span class="material-symbols-outlined" style="color:var(--ps-red)">delete</span>
                 </button>`
            }
          </div>
        </div>
      </div>
      <div class="lib-card__body">
        <h3 class="lib-card__name">${recipe.name}</h3>
        <p class="lib-card__desc">${recipe.description || ''}</p>
        <div class="lib-card__meta">
          <span class="mono text-sm text-muted">
            <span class="material-symbols-outlined" style="font-size:13px;vertical-align:-2px">account_tree</span>
            ${nodeCount} node${nodeCount !== 1 ? 's' : ''}
          </span>
          <span class="text-sm text-muted">${updated}</span>
        </div>
        <div class="lib-card__tags">
          ${(recipe.tags || []).map(t => `<span class="ic-badge">${t}</span>`).join('')}
        </div>
      </div>
      <div class="lib-card__footer">
        <button class="btn-primary lib-action-use" data-id="${recipe.id}" style="width:100%;justify-content:center;">
          <span class="material-symbols-outlined">play_arrow</span>
          Use Recipe
        </button>
      </div>
    </article>`;
}

export async function render(container) {
  container.innerHTML = `
    <div class="screen lib-screen">
      <div class="screen-header">
        <div class="screen-title">
          <span class="material-symbols-outlined">library_books</span>
          Recipe Library
        </div>
        <div class="flex items-center gap-2">
          <div style="position:relative;">
            <span class="material-symbols-outlined" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);font-size:17px;color:var(--ps-text-faint);pointer-events:none">search</span>
            <input id="lib-search" class="ic-input" placeholder="Search recipes…" style="padding-left:32px;width:220px;" autocomplete="off">
          </div>
          <button class="btn-secondary" id="btn-import-recipe">
            <span class="material-symbols-outlined">upload</span>
            Import JSON
          </button>
          <button class="btn-primary" id="btn-new-recipe">
            <span class="material-symbols-outlined">add</span>
            New Recipe
          </button>
          <button class="btn-icon" id="lib-btn-info" title="Image info for last test image">
            <span class="material-symbols-outlined">info</span>
          </button>
        </div>
      </div>

      <div class="lib-tabs-row">
        <div class="tabs" id="lib-tabs">
          <div role="tablist" aria-label="Recipe filter">
            <button role="tab" aria-selected="true"  aria-controls="lib-panel-all"    id="lib-tab-all"    tabindex="0">All</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-system" id="lib-tab-system" tabindex="-1">System</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-user"   id="lib-tab-user"   tabindex="-1">My Recipes</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-recent" id="lib-tab-recent" tabindex="-1">Recent</button>
          </div>
        </div>
        <div class="flex items-center gap-2" style="margin-left:auto">
          <select id="lib-sort" class="ic-input" style="width:auto;min-width:160px;font-size:12px;padding:5px 8px">
            <option value="updated">Recently Updated</option>
            <option value="name-asc">Name A–Z</option>
            <option value="name-desc">Name Z–A</option>
          </select>
          <span id="lib-count" class="text-sm text-muted" style="padding-right:4px;white-space:nowrap"></span>
        </div>
      </div>

      <div id="lib-tag-filter-row" class="lib-tag-filter-row" style="display:none"></div>

      <div class="lib-body overflow-y-auto flex-1">
        <div id="lib-panel-all"    role="tabpanel" aria-labelledby="lib-tab-all">
          <div id="lib-grid-all"    class="lib-grid"></div>
        </div>
        <div id="lib-panel-system" role="tabpanel" aria-labelledby="lib-tab-system" hidden>
          <div id="lib-grid-system" class="lib-grid"></div>
        </div>
        <div id="lib-panel-user"   role="tabpanel" aria-labelledby="lib-tab-user"   hidden>
          <div id="lib-grid-user"   class="lib-grid"></div>
        </div>
        <div id="lib-panel-recent" role="tabpanel" aria-labelledby="lib-tab-recent" hidden>
          <div id="lib-grid-recent" class="lib-grid"></div>
        </div>
      </div>
    </div>`;

  // ── Styles (scoped to LIB) ────────────────────────────
  injectStyles();

  // ── Metadata panel (toggled via (i) button) ───────────
  const { MetadataPanel } = await import('../components/metadata-panel.js');
  const infoPanelHost = document.createElement('div');
  infoPanelHost.style.cssText = 'position:fixed;top:0;right:0;height:100vh;z-index:200;pointer-events:none;';
  container.appendChild(infoPanelHost);
  const infoPanel = new MetadataPanel(infoPanelHost, { dirHandle: null, startHidden: true });
  infoPanelHost.style.pointerEvents = '';

  container.querySelector('#lib-btn-info')?.addEventListener('click', async () => {
    const testFile = window._icTestImage?.file;
    if (!testFile) {
      window.AuroraToast?.show({ variant: 'info', title: 'No test image selected yet', description: 'Pick a test image from the recipe editor first.' });
      return;
    }
    if (infoPanel.isVisible()) {
      infoPanel.hide();
    } else {
      await infoPanel.setFile(testFile);
      infoPanel.show();
    }
  });

  // ── Load recipes ──────────────────────────────────────
  let recipes = await getAllRecipes();
  let activeTags = new Set();
  let sortBy     = 'updated';

  function sortRecipes(list) {
    if (sortBy === 'name-asc')  return [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'name-desc') return [...list].sort((a, b) => b.name.localeCompare(a.name));
    return [...list].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  // ── Render grids ──────────────────────────────────────
  function renderGrid(containerId, items) {
    const el = container.querySelector(`#${containerId}`);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = `<div class="empty-state">
        <span class="material-symbols-outlined">inbox</span>
        <div class="empty-state-title">No recipes here yet</div>
        <div class="empty-state-desc">Click "New Recipe" to create your first one.</div>
      </div>`;
      return;
    }
    el.innerHTML = items.map(recipeCardHTML).join('');

    // Async post-render pass: inject "Needs setup" badge on cards whose
    // transforms have unmet requirements (e.g. model not downloaded).
    // Runs after initial paint so the grid is never blocked.
    (async () => {
      for (const recipe of items) {
        const { available, unmet } = await checkRecipeAvailability(recipe);
        if (available) continue;
        const card = el.querySelector(`.lib-card[data-id="${recipe.id}"]`);
        if (!card) continue;
        const badges = card.querySelector('.lib-card__badges');
        if (!badges) continue;
        const tip = unmet.map(r => r.label).join(', ');
        badges.insertAdjacentHTML('beforeend',
          `<span class="ic-badge ic-badge--amber lib-needs-setup-badge" title="Needs setup: ${tip}">` +
          `<span class="material-symbols-outlined" style="font-size:11px">warning</span> Needs setup</span>`);
      }
    })();
  }

  let tagSearchQuery = '';

  function categoryFor(tag) {
    return TAG_CATEGORIES[tag.toLowerCase()] || 'Other';
  }

  function tagPillHTML(tag) {
    const active = activeTags.has(tag) ? ' is-active' : '';
    return `<button class="lib-tag-chip${active}" data-tag="${tag}">${tag}</button>`;
  }

  function renderTagChips() {
    const allTags = [...new Set(recipes.flatMap(r => r.tags || []))].sort();
    const row = container.querySelector('#lib-tag-filter-row');
    if (!row) return;

    if (!allTags.length) {
      row.style.display = 'none';
      row.innerHTML = '';
      return;
    }
    row.style.display = '';

    // Compact mode: small tag set → keep the original simple row
    if (allTags.length <= COLLAPSE_THRESHOLD) {
      row.classList.add('lib-tag-filter-row--simple');
      row.classList.remove('is-open');
      row.innerHTML = `
        <span class="text-xs text-muted" style="flex-shrink:0">Filter by tag:</span>
        <div class="lib-tag-chips">${allTags.map(tagPillHTML).join('')}</div>
        ${activeTags.size ? '<button class="btn-ghost lib-tag-clear" style="font-size:11px;padding:2px 8px">Clear</button>' : ''}
      `;
      bindTagInteractions(row);
      return;
    }

    // Rich mode
    row.classList.remove('lib-tag-filter-row--simple');
    const open = sessionStorage.getItem('lib-tag-filter-open') === '1';
    row.classList.toggle('is-open', open);

    // Frequency for popular row
    const counts = new Map();
    recipes.forEach(r => (r.tags || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1)));
    const popular = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, POPULAR_LIMIT).map(([t]) => t);

    // Group remaining tags by category
    const byCategory = {};
    for (const t of allTags) {
      const cat = categoryFor(t);
      (byCategory[cat] = byCategory[cat] || []).push(t);
    }

    // Selected summary in collapsed bar
    const selected = [...activeTags];
    const visibleCount = 5;
    const visible = selected.slice(0, visibleCount);
    const overflow = selected.length - visible.length;
    const summaryChips = visible.map(t =>
      `<button class="lib-tag-chip is-active" data-tag="${t}" data-source="summary">${t}<span class="material-symbols-outlined" style="font-size:14px;margin-left:2px">close</span></button>`
    ).join('');
    const overflowPill = overflow > 0
      ? `<span class="lib-tag-summary__more">+${overflow} more</span>`
      : '';
    const summaryLabel = selected.length === 0
      ? '<span class="lib-tag-summary__all">All</span>'
      : '';

    // Search-filtered render of category groups
    const q = tagSearchQuery.trim().toLowerCase();
    const matches = (t) => !q || t.toLowerCase().includes(q);
    const groupsHTML = q
      ? (() => {
          // Flat ranked list when searching
          const hits = allTags.filter(matches).sort((a, b) => {
            const ap = a.toLowerCase().startsWith(q) ? 0 : 1;
            const bp = b.toLowerCase().startsWith(q) ? 0 : 1;
            return ap - bp || a.localeCompare(b);
          });
          if (!hits.length) {
            return '<div class="lib-tag-empty">No tags match "' + q + '"</div>';
          }
          return `<div class="lib-tag-group">
            <div class="lib-tag-group__head">Matches</div>
            <div class="lib-tag-chips">${hits.map(tagPillHTML).join('')}</div>
          </div>`;
        })()
      : CATEGORY_ORDER
          .filter(cat => byCategory[cat]?.length)
          .map(cat => `<div class="lib-tag-group">
            <div class="lib-tag-group__head">${cat}</div>
            <div class="lib-tag-chips">${byCategory[cat].map(tagPillHTML).join('')}</div>
          </div>`)
          .join('');

    const popularHTML = popular.length && !q ? `
      <div class="lib-tag-group lib-tag-group--popular">
        <div class="lib-tag-group__head">Popular</div>
        <div class="lib-tag-chips">${popular.map(tagPillHTML).join('')}</div>
      </div>` : '';

    const selectedStripHTML = selected.length ? `
      <div class="lib-tag-group lib-tag-group--selected">
        <div class="lib-tag-group__head">Selected</div>
        <div class="lib-tag-chips">${selected.map(tagPillHTML).join('')}</div>
      </div>` : '';

    row.innerHTML = `
      <div class="lib-tag-summary" role="button" tabindex="0" aria-expanded="${open}">
        <span class="material-symbols-outlined lib-tag-summary__caret">chevron_right</span>
        <span class="material-symbols-outlined" style="font-size:16px;color:var(--ps-text-muted)">sell</span>
        <span class="lib-tag-summary__label">Tags</span>
        <span class="lib-tag-summary__chips">${summaryLabel}${summaryChips}${overflowPill}</span>
        ${activeTags.size ? '<button class="btn-ghost lib-tag-clear" style="font-size:11px;padding:2px 8px;margin-left:auto">Clear</button>' : ''}
      </div>
      <div class="lib-tag-body">
        <div class="lib-tag-body__inner">
          <div class="lib-tag-search-wrap">
            <span class="material-symbols-outlined">search</span>
            <input type="text" class="lib-tag-search" placeholder="Search tags…" value="${q}" autocomplete="off">
          </div>
          ${selectedStripHTML}
          ${popularHTML}
          ${groupsHTML}
        </div>
      </div>
    `;
    bindTagInteractions(row);
  }

  function bindTagInteractions(row) {
    // Pill toggle
    row.querySelectorAll('.lib-tag-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const t = btn.dataset.tag;
        if (activeTags.has(t)) activeTags.delete(t); else activeTags.add(t);
        renderTagChips();
        applyFilter(container.querySelector('#lib-search')?.value || '');
        // Restore search box focus + caret if we were typing
        if (tagSearchQuery) row.querySelector('.lib-tag-search')?.focus();
      });
    });

    // Clear button (must stop propagation so summary toggle doesn't fire)
    row.querySelectorAll('.lib-tag-clear').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeTags.clear();
        renderTagChips();
        applyFilter(container.querySelector('#lib-search')?.value || '');
      });
    });

    // Summary bar toggles open/close
    const summary = row.querySelector('.lib-tag-summary');
    const toggleOpen = () => {
      const open = !row.classList.contains('is-open');
      row.classList.toggle('is-open', open);
      summary.setAttribute('aria-expanded', String(open));
      sessionStorage.setItem('lib-tag-filter-open', open ? '1' : '0');
    };
    summary?.addEventListener('click', toggleOpen);
    summary?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleOpen(); }
    });

    // Search input
    const search = row.querySelector('.lib-tag-search');
    if (search) {
      search.addEventListener('input', (e) => {
        tagSearchQuery = e.target.value;
        // Re-render only the body. Easier: full re-render then refocus.
        const caret = e.target.selectionStart;
        renderTagChips();
        const next = container.querySelector('.lib-tag-search');
        if (next) {
          next.focus();
          try { next.setSelectionRange(caret, caret); } catch {}
        }
      });
      // Stop summary toggle when interacting with the search row
      search.addEventListener('click', e => e.stopPropagation());
    }
  }

  function applyFilter(query = '') {
    const q = query.toLowerCase();
    let filtered = recipes.filter(r => {
      if (q && !r.name.toLowerCase().includes(q) && !(r.description || '').toLowerCase().includes(q) && !(r.tags || []).some(t => t.toLowerCase().includes(q))) return false;
      if (activeTags.size > 0 && ![...activeTags].some(t => (r.tags || []).includes(t))) return false;
      return true;
    });
    filtered = sortRecipes(filtered);

    renderGrid('lib-grid-all',    filtered);
    renderGrid('lib-grid-system', filtered.filter(r =>  r.isSystem));
    renderGrid('lib-grid-user',   filtered.filter(r => !r.isSystem));

    // Recent: recipes with lastUsedAt, sorted by most recent usage
    const recent = [...recipes]
      .filter(r => r.lastUsedAt)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));
    renderGrid('lib-grid-recent', recent);

    const count = container.querySelector('#lib-count');
    if (count) count.textContent = `${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`;
    bindCardActions();
  }

  applyFilter();
  renderTagChips();

  // ── Tabs ──────────────────────────────────────────────
  initTabs(container);

  // ── Sort ──────────────────────────────────────────────
  container.querySelector('#lib-sort')?.addEventListener('change', e => {
    sortBy = e.target.value;
    applyFilter(container.querySelector('#lib-search')?.value || '');
  });

  // ── Search ────────────────────────────────────────────
  container.querySelector('#lib-search')?.addEventListener('input', e => applyFilter(e.target.value));

  // ── New recipe ────────────────────────────────────────
  container.querySelector('#btn-new-recipe')?.addEventListener('click', async () => {
    const recipe = {
      id:          uuid(),
      name:        'Untitled Recipe',
      description: '',
      isSystem:    false,
      coverColor:  '#0077ff',
      tags:        [],
      nodes:       [],
      createdAt:   now(),
      updatedAt:   now(),
    };
    await saveRecipe(recipe);
    navigate(`#bld?id=${recipe.id}`);
  });

  // ── Import recipe ─────────────────────────────────────
  container.querySelector('#btn-import-recipe')?.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = async e => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        // Validation check
        if (data.type !== 'PicMachinaRecipeBundle') {
          throw new Error('This file does not appear to be a PicMachina recipe bundle.');
        }

        // Before saving, see if recipe ID already exists
        const existing = await getAllRecipes();
        const exists   = existing.find(r => r.id === data.recipe.id);
        if (exists) {
          const overwrite = await showConfirm({
            title: 'Recipe Already Exists',
            body: `A recipe named "${exists.name}" already exists. Do you want to overwrite it?`,
            confirmText: 'Overwrite',
            cancelText: 'Keep Both',
            variant: 'warning',
            icon: 'warning'
          });

          if (!overwrite) {
            // Rename to avoid collision
            data.recipe.id = uuid();
            data.recipe.name = `${data.recipe.name} (Imported)`;
          }
        }

        await saveRecipeBundle(data);
        
        // Refresh library
        recipes = await getAllRecipes();
        applyFilter(container.querySelector('#lib-search')?.value || '');
        renderTagChips();
        
        window.AuroraToast?.show({ 
          variant: 'success', 
          title: 'Recipe imported', 
          description: `Successfully loaded "${data.recipe.name}".` 
        });
      } catch (err) {
        window.AuroraToast?.show({ 
          variant: 'danger', 
          title: 'Import failed', 
          description: err.message 
        });
      }
    };
    inp.click();
  });

  // ── Card action binding ───────────────────────────────
  function bindCardActions() {
    async function useRecipe(id) {
      const recipe = recipes.find(r => r.id === id);
      if (recipe) { 
        recipe.lastUsedAt = Date.now(); 
        await saveRecipe(recipe); 
      }
      navigate(`#set?recipe=${id}`);
    }

    container.querySelectorAll('.lib-action-use').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await useRecipe(btn.dataset.id);
      });
    });

    container.querySelectorAll('.lib-action-preview').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(`#pvw?id=${btn.dataset.id}`);
      });
    });

    container.querySelectorAll('.lib-action-clone').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        const cloned = await cloneRecipe(btn.dataset.id);
        recipes = await getAllRecipes();
        applyFilter(container.querySelector('#lib-search')?.value || '');
        renderTagChips();
        window.AuroraToast?.show({ variant: 'success', title: `"${cloned.name}" cloned`, description: 'You can now edit it.' });
        navigate(`#bld?id=${cloned.id}`);
      });
    });

    container.querySelectorAll('.lib-action-edit').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(`#bld?id=${btn.dataset.id}`);
      });
    });

    container.querySelectorAll('.lib-action-delete').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        
        const confirmed = await showConfirm({
          title: 'Delete Recipe?',
          body: 'This will permanently delete this recipe from your library. This action cannot be undone.',
          confirmText: 'Delete',
          variant: 'danger',
          icon: 'delete_forever'
        });

        if (!confirmed) return;

        await deleteRecipe(btn.dataset.id);
        recipes = recipes.filter(r => r.id !== btn.dataset.id);
        applyFilter(container.querySelector('#lib-search')?.value || '');
        renderTagChips();
        window.AuroraToast?.show({ variant: 'success', title: 'Recipe deleted' });
      });
    });

    container.querySelectorAll('.lib-action-remove-thumb').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        await clearRecipeThumbnail(btn.dataset.id);
        recipes = await getAllRecipes();
        applyFilter(container.querySelector('#lib-search')?.value || '');
        window.AuroraToast?.show({ variant: 'success', title: 'Thumbnail removed' });
      });
    });

    container.querySelectorAll('.lib-action-export').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        try {
          const bundle = await getRecipeBundle(btn.dataset.id);
          const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${bundle.recipe.name.replace(/[^a-z0-9]/gi, '_')}.json`;
          a.click();
          URL.revokeObjectURL(url);
          window.AuroraToast?.show({ variant: 'success', title: 'Recipe exported', description: 'JSON file downloaded.' });
        } catch (err) {
          console.error(err);
          window.AuroraToast?.show({ variant: 'danger', title: 'Export failed' });
        }
      });
    });

    // Card click = Use Recipe
    container.querySelectorAll('.lib-card').forEach(card => {
      card.addEventListener('click', async e => {
        if (e.target.closest('button')) return;
        await useRecipe(card.dataset.id);
      });
      card.addEventListener('keydown', async e => {
        if (e.key === 'Enter' || e.key === ' ') { 
          e.preventDefault(); 
          await useRecipe(card.dataset.id); 
        }
      });
    });
  }
}

// ── Scoped styles ─────────────────────────────────────────
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .lib-screen { display: flex; flex-direction: column; height: 100%; }

    .lib-tabs-row {
      display: flex;
      align-items: center;
      padding: 0 20px;
      border-bottom: 1px solid var(--ps-border);
      background: var(--ps-bg-surface);
      flex-shrink: 0;
      gap: 8px;
    }
    .lib-tabs-row .tabs { flex: 1; border: none; background: transparent; }
    .lib-tabs-row [role="tablist"] { display: flex; gap: 0; border: none; }
    .lib-tabs-row [role="tab"] {
      background: transparent; border: none; border-bottom: 2px solid transparent;
      color: var(--ps-text-muted); padding: 12px 16px; font-size: 13px; font-weight: 500;
      cursor: pointer; font-family: var(--font-primary); transition: color 150ms ease, border-color 150ms ease;
    }
    .lib-tabs-row [role="tab"][aria-selected="true"] {
      color: var(--ps-blue); border-bottom-color: var(--ps-blue);
    }
    .lib-tabs-row [role="tab"]:hover { color: var(--ps-text); }

    /* Tag filter — collapsible section */
    .lib-tag-filter-row {
      display: flex; flex-direction: column;
      border-bottom: 1px solid var(--ps-border);
      background: var(--ps-bg-surface); flex-shrink: 0;
    }
    /* Compact mode: small tag set keeps the original inline layout */
    .lib-tag-filter-row--simple {
      flex-direction: row; align-items: center; gap: 8px; flex-wrap: wrap;
      padding: 8px 20px;
    }

    .lib-tag-summary {
      all: unset;
      display: flex; align-items: center; gap: 8px;
      padding: 8px 20px;
      cursor: pointer;
      user-select: none;
      min-height: 36px;
      flex-wrap: wrap;
    }
    .lib-tag-summary:hover { background: var(--ps-bg-raised); }
    .lib-tag-summary__caret {
      font-size: 18px !important;
      color: var(--ps-text-muted);
      transition: transform 180ms ease;
    }
    .lib-tag-filter-row.is-open .lib-tag-summary__caret { transform: rotate(90deg); }
    .lib-tag-summary__label {
      font-size: 12px; font-weight: 600; color: var(--ps-text-muted);
      text-transform: uppercase; letter-spacing: 0.04em;
    }
    .lib-tag-summary__chips {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      flex: 1; min-width: 0;
    }
    .lib-tag-summary__chips .lib-tag-chip {
      display: inline-flex; align-items: center;
    }
    .lib-tag-summary__all {
      font-size: 12px; color: var(--ps-text-faint);
    }
    .lib-tag-summary__more {
      font-size: 11px; color: var(--ps-text-muted);
      padding: 3px 8px; border-radius: 12px;
      background: var(--ps-bg-raised); border: 1px solid var(--ps-border);
    }

    .lib-tag-body {
      max-height: 0;
      overflow: hidden;
      transition: max-height 240ms ease;
    }
    .lib-tag-filter-row.is-open .lib-tag-body { max-height: 520px; overflow-y: auto; }
    .lib-tag-body__inner {
      padding: 4px 20px 14px;
      display: flex; flex-direction: column; gap: 12px;
    }

    .lib-tag-search-wrap {
      position: relative;
      max-width: 320px;
    }
    .lib-tag-search-wrap > .material-symbols-outlined {
      position: absolute; left: 9px; top: 50%; transform: translateY(-50%);
      font-size: 17px; color: var(--ps-text-faint); pointer-events: none;
    }
    .lib-tag-search {
      width: 100%; box-sizing: border-box;
      padding: 6px 10px 6px 32px;
      font-size: 12px;
      background: var(--ps-bg-raised);
      border: 1px solid var(--ps-border);
      border-radius: 6px;
      color: var(--ps-text);
      font-family: var(--font-primary);
      outline: none;
    }
    .lib-tag-search:focus { border-color: var(--ps-blue); }

    .lib-tag-group { display: flex; flex-direction: column; gap: 6px; }
    .lib-tag-group__head {
      font-size: 10px; font-weight: 600;
      color: var(--ps-text-faint);
      text-transform: uppercase; letter-spacing: 0.08em;
    }
    .lib-tag-group--selected .lib-tag-group__head { color: var(--ps-blue); }
    .lib-tag-empty {
      font-size: 12px; color: var(--ps-text-muted);
      padding: 8px 0;
    }

    .lib-tag-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .lib-tag-chip {
      padding: 3px 10px; font-size: 11px; border-radius: 12px;
      border: 1px solid var(--ps-border); background: var(--ps-bg-raised);
      color: var(--ps-text-muted); cursor: pointer; font-family: var(--font-primary);
      transition: all 100ms;
    }
    .lib-tag-chip.is-active { background: var(--ps-blue); border-color: var(--ps-blue); color: #fff; }
    .lib-tag-chip:not(.is-active):hover { border-color: var(--ps-blue); color: var(--ps-text); }

    .lib-body { flex: 1; overflow-y: auto; padding: 20px; }

    .lib-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }

    .lib-card {
      background: var(--ps-bg-surface);
      border: 1px solid var(--ps-border);
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
      display: flex;
      flex-direction: column;
      outline: none;
    }
    .lib-card:hover {
      transform: translateY(-3px);
      border-color: var(--ps-blue);
      box-shadow: 0 8px 24px rgba(0,119,255,0.12);
    }
    .lib-card:focus-visible {
      box-shadow: var(--ps-blue-glow);
    }

    .lib-card__cover {
      height: 140px;
      position: relative;
      overflow: hidden;
    }
    .lib-card__thumb-img {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      object-position: center;
      display: block;
    }
    .lib-card__cover-overlay {
      position: absolute; inset: 0;
      padding: 10px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, transparent 60%);
      opacity: 0;
      transition: opacity 150ms ease;
    }
    .lib-card:hover .lib-card__cover-overlay { opacity: 1; }

    .lib-card__badges { display: flex; gap: 5px; }
    .lib-card__quick-actions { display: flex; gap: 4px; }
    .lib-card__quick-actions .btn-icon {
      background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
      width: 28px; height: 28px; border-radius: 6px;
      color: var(--ps-text);
    }
    .lib-card__quick-actions .btn-icon:hover { background: var(--ps-blue); }

    .lib-card__body { padding: 12px 14px 8px; flex: 1; }
    .lib-card__name { font-size: 14px; font-weight: 600; color: var(--ps-text); margin-bottom: 4px; }
    .lib-card__desc {
      font-size: 12px; color: var(--ps-text-muted); line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
      margin-bottom: 8px; min-height: 36px;
    }
    .lib-card__meta {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 8px;
    }
    .lib-card__tags { display: flex; flex-wrap: wrap; gap: 4px; min-height: 22px; }
    .lib-card__footer { padding: 10px 14px; border-top: 1px solid var(--ps-border); }
    .lib-card__footer .btn-primary { font-size: 12px; padding: 7px 12px; }
  `;
  document.head.appendChild(style);
}
