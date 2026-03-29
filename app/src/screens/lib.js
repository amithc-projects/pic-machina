/**
 * ImageChef — LIB: Recipe Library
 *
 * Home screen. Shows all recipes in a responsive grid.
 * Users can browse, preview, create, or clone recipes.
 */

import { getAllRecipes, deleteRecipe, cloneRecipe, saveRecipe } from '../data/recipes.js';
import { navigate } from '../main.js';
import { formatDate, uuid, now } from '../utils/misc.js';
import { initTabs } from '../aurora/tabs.js';
import { countNodes } from '../utils/nodes.js';

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
  if (recipe.coverColor && COVER_GRADIENTS[recipe.coverColor]) {
    return `background: ${COVER_GRADIENTS[recipe.coverColor]};`;
  }
  return 'background: linear-gradient(135deg, #111318 0%, #1e293b 100%);';
}


function recipeCardHTML(recipe) {
  const nodeCount = countNodes(recipe.nodes);
  const updated = recipe.updatedAt ? formatDate(recipe.updatedAt) : '—';
  const isSystem = recipe.isSystem;

  return `
    <article class="lib-card" data-id="${recipe.id}" tabindex="0" role="button" aria-label="Recipe: ${recipe.name}">
      <div class="lib-card__cover" style="${getCoverStyle(recipe)}">
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
                 <button class="btn-icon lib-action-delete" data-id="${recipe.id}" title="Delete recipe">
                   <span class="material-symbols-outlined">delete</span>
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
          <button class="btn-primary" id="btn-new-recipe">
            <span class="material-symbols-outlined">add</span>
            New Recipe
          </button>
        </div>
      </div>

      <div class="lib-tabs-row">
        <div class="tabs" id="lib-tabs">
          <div role="tablist" aria-label="Recipe filter">
            <button role="tab" aria-selected="true"  aria-controls="lib-panel-all"    id="lib-tab-all"    tabindex="0">All</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-system" id="lib-tab-system" tabindex="-1">System</button>
            <button role="tab" aria-selected="false" aria-controls="lib-panel-user"   id="lib-tab-user"   tabindex="-1">My Recipes</button>
          </div>
        </div>
        <span id="lib-count" class="text-sm text-muted" style="margin-left:auto;padding-right:4px;"></span>
      </div>

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
      </div>
    </div>`;

  // ── Styles (scoped to LIB) ────────────────────────────
  injectStyles();

  // ── Load recipes ──────────────────────────────────────
  let recipes = await getAllRecipes();
  recipes.sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1; // system first
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

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
  }

  function applyFilter(query = '') {
    const q = query.toLowerCase();
    const filtered = q ? recipes.filter(r => r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || (r.tags || []).some(t => t.toLowerCase().includes(q))) : recipes;
    renderGrid('lib-grid-all',    filtered);
    renderGrid('lib-grid-system', filtered.filter(r =>  r.isSystem));
    renderGrid('lib-grid-user',   filtered.filter(r => !r.isSystem));
    const count = container.querySelector('#lib-count');
    if (count) count.textContent = `${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`;
    bindCardActions();
  }

  applyFilter();

  // ── Tabs ──────────────────────────────────────────────
  initTabs(container);

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

  // ── Card action binding ───────────────────────────────
  function bindCardActions() {
    container.querySelectorAll('.lib-action-use').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        navigate(`#set?recipe=${btn.dataset.id}`);
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
        recipes.sort((a, b) => a.isSystem !== b.isSystem ? (a.isSystem ? -1 : 1) : (b.updatedAt - a.updatedAt));
        applyFilter(container.querySelector('#lib-search')?.value || '');
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
        if (!confirm('Delete this recipe? This cannot be undone.')) return;
        await deleteRecipe(btn.dataset.id);
        recipes = recipes.filter(r => r.id !== btn.dataset.id);
        applyFilter(container.querySelector('#lib-search')?.value || '');
        window.AuroraToast?.show({ variant: 'success', title: 'Recipe deleted' });
      });
    });

    // Card click = preview
    container.querySelectorAll('.lib-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        navigate(`#pvw?id=${card.dataset.id}`);
      });
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate(`#pvw?id=${card.dataset.id}`); }
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
