/**
 * PicMachina — GSD: Get Started
 *
 * Landing / introduction screen. Ports the Claude-designed prototype at
 * `getting-started-page-designed-by-claude.html` to a vanilla-JS screen
 * module with no framework dependencies.
 *
 * Sections (vertical stack, max-width 1200):
 *   1. Hero — two variants ("Live Pipeline" / "Guided Tour"), toggled by a
 *      segmented control at the top-right.
 *   2. Pipeline Diagram — 7 node categories with live recipe counts.
 *   3. Personas — Individuals / Photographers / Creators / Enterprise.
 *   4. Smart Automation — "Just Ask Claude" card with a typewriter prompt.
 *   5. Keyboard Shortcuts strip.
 *
 * All CTAs navigate to real in-app hashes via `main.js`'s `navigate()` shim
 * (falling back to `location.hash`). Recipe / model / category counts are
 * read from the live data layer so the page never goes stale.
 */

import { getAllRecipes } from '../data/recipes.js';
import { listDownloadedModels } from '../data/models.js';

// ─── Utils ────────────────────────────────────────────────────
function go(hash) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  location.hash = hash;
}

const NODE_CATEGORIES = [
  'AI & Composition',
  'Color & Tone',
  'Flow Control',
  'Geometric & Framing',
  'Metadata',
  'Overlays & Typography',
  'Video Effects',
];

async function getCounts() {
  const [recipes, models] = await Promise.all([
    getAllRecipes().catch(() => []),
    listDownloadedModels().catch(() => []),
  ]);
  return {
    recipeCount: recipes.length,
    modelCount: models.length,
    categoryCount: NODE_CATEGORIES.length,
  };
}

// ─── Main render ──────────────────────────────────────────────
export async function render(container) {
  injectStyles();

  const counts = await getCounts();

  container.innerHTML = `
    <div class="gsd-screen">
      <header class="gsd-header">
        <div class="gsd-header__title">
          <span class="material-symbols-outlined" style="color:#60a5fa">rocket_launch</span>
          <h1>Get Started</h1>
        </div>
        <div class="gsd-header__right">
          <div class="gsd-pill gsd-pill--status">
            <span class="gsd-dot gsd-dot--green"></span>
            <span class="mono">engine ready · ${counts.modelCount} model${counts.modelCount === 1 ? '' : 's'} loaded</span>
          </div>
          <div class="gsd-hero-switch" role="tablist" aria-label="Hero variant">
            <button class="gsd-hero-switch__btn is-active" data-variant="pipeline" role="tab" aria-selected="true">Live Pipeline</button>
            <button class="gsd-hero-switch__btn" data-variant="tour" role="tab" aria-selected="false">Guided Tour</button>
          </div>
        </div>
      </header>

      <div class="gsd-body">
        <section id="gsd-hero"></section>
        <section id="gsd-pipeline"></section>
        <section id="gsd-personas"></section>
        <section id="gsd-automation"></section>
        <section id="gsd-shortcuts"></section>
      </div>
    </div>
  `;

  // Mount sections
  renderHero(container.querySelector('#gsd-hero'), 'pipeline', counts);
  renderPipelineDiagram(container.querySelector('#gsd-pipeline'), counts);
  renderPersonas(container.querySelector('#gsd-personas'));
  renderAutomation(container.querySelector('#gsd-automation'));
  renderShortcuts(container.querySelector('#gsd-shortcuts'));

  // Hero variant toggle
  const heroEl = container.querySelector('#gsd-hero');
  container.querySelectorAll('.gsd-hero-switch__btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.gsd-hero-switch__btn').forEach((b) => {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      stopHeroTimers();
      renderHero(heroEl, btn.dataset.variant, counts);
    });
  });

  // Return a cleanup function so main.js can stop the intervals when the
  // user navigates away.
  return () => stopHeroTimers();
}

// ─── Global timer registry (killed on navigation away) ────────
const _timers = [];
function track(id) { _timers.push(id); return id; }
function stopHeroTimers() {
  while (_timers.length) clearInterval(_timers.pop());
}

// ═══════════════════════════════════════════════════════════════
// HERO A — Live Pipeline
// ═══════════════════════════════════════════════════════════════
function renderLivePipelineHero(host, counts) {
  host.innerHTML = `
    <div class="gsd-hero gsd-hero--pipeline">
      <div class="gsd-hero__bg"></div>
      <div class="gsd-hero__grid-bg"></div>
      <div class="gsd-hero__inner">
        <div class="gsd-hero__copy">
          <div class="gsd-pill gsd-pill--accent">
            <span class="gsd-dot gsd-dot--blue pulse-dot"></span>
            <span class="mono">Local · Private · Fast</span>
          </div>
          <h1 class="gsd-hero__headline">
            Imagine the outcome.
            <span class="serif"> Automate</span> the rest.
          </h1>
          <p class="gsd-hero__lede">
            A visual node engine that turns messy folders of media into
            perfectly-processed deliverables. Runs entirely on your machine.
          </p>
          <div class="gsd-hero__ctas">
            <button class="gsd-btn gsd-btn--primary" data-action="new-recipe">
              <span class="material-symbols-outlined">add</span>
              Create New Recipe
            </button>
            <button class="gsd-btn gsd-btn--secondary" data-action="browse-recipes">
              <span class="material-symbols-outlined">library_books</span>
              Browse ${counts.recipeCount} Recipes
            </button>
            <button class="gsd-btn gsd-btn--ghost mono" data-action="launcher">
              ⌘ K <span style="opacity:.7">— open launcher</span>
            </button>
          </div>
          <div class="gsd-stats">
            <div><div class="gsd-stats__k mono">${counts.recipeCount}</div><div class="gsd-stats__v">recipes ready</div></div>
            <div><div class="gsd-stats__k mono">${counts.categoryCount}</div><div class="gsd-stats__v">node categories</div></div>
            <div><div class="gsd-stats__k mono">100%</div><div class="gsd-stats__v">on-device</div></div>
          </div>
        </div>
        <div class="gsd-pipeline-card">
          <div class="gsd-pipeline-card__chrome">
            <span class="gsd-traffic gsd-traffic--red"></span>
            <span class="gsd-traffic gsd-traffic--amber"></span>
            <span class="gsd-traffic gsd-traffic--green"></span>
            <span class="mono gsd-pipeline-card__filename">cinematic_portrait.recipe</span>
            <span class="gsd-pipeline-card__running">
              <span class="gsd-dot gsd-dot--green pulse-dot"></span> running
            </span>
          </div>
          <svg class="gsd-pipeline-svg" viewBox="0 0 560 240">
            <defs>
              <linearGradient id="gsdEdgeGrad" x1="0" x2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity=".1"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity=".8"/>
              </linearGradient>
            </defs>
            <g id="gsd-edges"></g>
            <g id="gsd-nodes"></g>
          </svg>
          <div class="mono gsd-pipeline-card__log">
            <span style="color:var(--gsd-green)">●</span>
            <span>processed <b>portrait_04.jpg</b> → /exports/final/</span>
            <span style="flex:1"></span>
            <span>1.3s</span>
            <span style="color:var(--gsd-dim)">·</span>
            <span>1 / 1</span>
          </div>
          <div class="gsd-pipeline-card__chip float-slow">
            <span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span>
            Live demo
          </div>
        </div>
      </div>
    </div>
  `;

  // Animated node/edge state
  const nodes = [
    { label: 'Input',    sub: 'portrait_04.jpg', x: 40,  y: 90,  color: 'var(--gsd-teal)',   source: true,  icon: 'image' },
    { label: 'Analyse',  sub: 'detect faces',    x: 230, y: 40,  color: 'var(--gsd-cyan)',   icon: 'face' },
    { label: 'Amend',    sub: 'cinematic LUT',   x: 230, y: 140, color: 'var(--gsd-orange)', icon: 'tune' },
    { label: 'Annotate', sub: 'add caption',     x: 420, y: 40,  color: 'var(--gsd-amber)',  icon: 'text_fields' },
    { label: 'Output',   sub: '/exports/final/', x: 420, y: 140, color: 'var(--gsd-green)',  icon: 'download' },
  ];
  const edges = [
    { from: 0, to: 1, phase: 0 },
    { from: 0, to: 2, phase: 0 },
    { from: 1, to: 3, phase: 1 },
    { from: 2, to: 3, phase: 2 },
    { from: 2, to: 4, phase: 2 },
    { from: 3, to: 4, phase: 3 },
  ];

  const edgePath = (a, b) => {
    const x1 = a.x + 140, y1 = a.y + 30, x2 = b.x, y2 = b.y + 30;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  const edgesG = host.querySelector('#gsd-edges');
  const nodesG = host.querySelector('#gsd-nodes');

  edges.forEach((e, i) => {
    const a = nodes[e.from], b = nodes[e.to];
    edgesG.insertAdjacentHTML('beforeend', `
      <g data-edge="${i}">
        <path d="${edgePath(a, b)}" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1.5"/>
        <path class="gsd-edge-active march" d="${edgePath(a, b)}" fill="none" stroke="url(#gsdEdgeGrad)" stroke-width="2" style="display:none"/>
      </g>
    `);
  });

  nodes.forEach((n, i) => {
    nodesG.insertAdjacentHTML('beforeend', `
      <g data-node="${i}" transform="translate(${n.x},${n.y})">
        <rect class="gsd-node-rect" width="140" height="60" rx="10"
          fill="rgba(20,28,46,0.6)" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
        <circle cx="14" cy="20" r="9" fill="${n.color}" opacity=".18"/>
        <circle cx="14" cy="20" r="5" fill="${n.color}"/>
        <text x="30" y="24" fill="#e7ecf5" font-size="12" font-weight="600" font-family="Inter, system-ui">${n.label}</text>
        <text x="14" y="46" fill="#98a3b8" font-size="10" font-family="JetBrains Mono, monospace">${n.sub}</text>
        ${n.source ? '' : `<circle cx="0" cy="30" r="3" fill="#0a0f1c" stroke="${n.color}" stroke-width="1.5"/>`}
        <circle cx="140" cy="30" r="3" fill="#0a0f1c" stroke="${n.color}" stroke-width="1.5"/>
      </g>
    `);
  });

  // Phase animation loop — recycles every ~4s (4 phases × 1s each).
  let tick = 0;
  const update = () => {
    tick = (tick + 1) % 80;
    const phase = Math.floor(tick / 20);
    host.querySelectorAll('[data-edge]').forEach((g, i) => {
      const e = edges[i];
      const active = phase >= e.phase;
      const fx = g.querySelector('.gsd-edge-active');
      if (fx) fx.style.display = active ? '' : 'none';
    });
    host.querySelectorAll('[data-node]').forEach((g, i) => {
      const active = i === 0 || (i === 1 && phase >= 1) || (i === 2 && phase >= 1) || (i === 3 && phase >= 2) || (i === 4 && phase >= 3);
      const rect = g.querySelector('.gsd-node-rect');
      if (!rect) return;
      rect.setAttribute('fill', active ? 'rgba(20,28,46,1)' : 'rgba(20,28,46,0.6)');
      rect.setAttribute('stroke', active ? nodes[i].color : 'rgba(255,255,255,0.08)');
      rect.setAttribute('stroke-width', active ? '1.5' : '1');
    });
  };
  update();
  track(setInterval(update, 50));

  // CTA handlers
  host.querySelector('[data-action="new-recipe"]').addEventListener('click', () => go('#lib'));
  host.querySelector('[data-action="browse-recipes"]').addEventListener('click', () => go('#lib'));
  host.querySelector('[data-action="launcher"]').addEventListener('click', () => go('#lib'));
}

// ═══════════════════════════════════════════════════════════════
// HERO B — Guided Tour (5-step rail + preview panes)
// ═══════════════════════════════════════════════════════════════
function renderGuidedTourHero(host) {
  const steps = [
    { n: 1, label: 'Drop files',  sub: 'Any folder, any format.', icon: 'upload',         color: 'var(--gsd-teal)'   },
    { n: 2, label: 'Pick a recipe', sub: 'Or build your own.',    icon: 'library_books',  color: 'var(--gsd-cyan)'   },
    { n: 3, label: 'Tweak',       sub: 'Parameters are live.',    icon: 'tune',           color: 'var(--gsd-amber)'  },
    { n: 4, label: 'Preview',     sub: 'Before / after.',         icon: 'image',          color: 'var(--gsd-orange)' },
    { n: 5, label: 'Run',         sub: 'Bulk or batch.',          icon: 'play_arrow',     color: 'var(--gsd-green)'  },
  ];

  host.innerHTML = `
    <div class="gsd-hero gsd-hero--tour">
      <div class="gsd-hero__bg gsd-hero__bg--green"></div>
      <div class="gsd-hero__grid-bg"></div>
      <div class="gsd-hero__inner gsd-hero__inner--tour">
        <div class="gsd-tour__headers">
          <div>
            <div class="gsd-pill gsd-pill--green">
              <span class="gsd-dot gsd-dot--green pulse-dot"></span>
              <span class="mono">Five-step first run</span>
            </div>
            <h1 class="gsd-hero__headline gsd-hero__headline--tour">
              From <span class="serif">zero</span> to a finished<br>batch in under a minute.
            </h1>
          </div>
          <div class="gsd-tour__copy">
            <p>
              Follow the rail below or skip straight to a recipe. Everything
              runs locally — your files never leave this machine.
            </p>
            <div class="gsd-tour__ctas">
              <button class="gsd-btn gsd-btn--primary" data-action="start-tour">
                <span class="material-symbols-outlined">play_arrow</span>
                Start the tour
              </button>
              <button class="gsd-btn gsd-btn--secondary" data-action="skip-tour">
                <span class="material-symbols-outlined">close</span>
                Skip
              </button>
            </div>
          </div>
        </div>

        <div class="gsd-tour__rail">
          ${steps.map((s, i) => `
            <button class="gsd-tour__step ${i === 0 ? 'is-current' : ''}" data-step="${i}" style="--step-color:${s.color}">
              <div class="gsd-tour__step-head">
                <div class="gsd-tour__step-n mono">${s.n}</div>
                <div class="mono gsd-tour__step-label-small">Step ${s.n}</div>
              </div>
              <div>
                <div class="gsd-tour__step-title">${s.label}</div>
                <div class="gsd-tour__step-sub">${s.sub}</div>
              </div>
              <div class="gsd-tour__progress"><div></div></div>
            </button>
          `).join('')}
        </div>

        <div class="gsd-tour__pane" id="gsd-tour-pane"></div>
      </div>
    </div>
  `;

  let current = 0;
  const paneEl = host.querySelector('#gsd-tour-pane');
  const stepBtns = host.querySelectorAll('.gsd-tour__step');

  const setStep = (i) => {
    current = i;
    stepBtns.forEach((b, j) => b.classList.toggle('is-current', i === j));
    paneEl.innerHTML = tourPane(i);
  };

  stepBtns.forEach((btn) => {
    btn.addEventListener('click', () => setStep(Number(btn.dataset.step)));
  });

  // Auto-advance
  setStep(0);
  track(setInterval(() => setStep((current + 1) % steps.length), 2800));

  // CTAs
  host.querySelector('[data-action="start-tour"]').addEventListener('click', () => go('#lib'));
  host.querySelector('[data-action="skip-tour"]').addEventListener('click', () => go('#lib'));
}

function tourPane(i) {
  switch (i) {
    case 0: return paneDrop();
    case 1: return paneRecipe();
    case 2: return paneTweak();
    case 3: return paneBeforeAfter();
    case 4: return paneRun();
  }
  return '';
}

function paneDrop() {
  const items = [
    { n: 'shoot_paris_2026/',   c: '124 items', icon: 'folder', col: 'var(--gsd-amber)'  },
    { n: 'client_delivery.zip', c: '56 MB',     icon: 'folder', col: 'var(--gsd-violet)' },
    { n: 'roll_042.cr3',        c: '1 file',    icon: 'image',  col: 'var(--gsd-cyan)'   },
  ];
  return `
    <div class="gsd-pane gsd-pane--drop">
      <div class="gsd-dropzone">
        <div class="gsd-dropzone__icon">
          <span class="material-symbols-outlined">upload</span>
        </div>
        <div class="gsd-dropzone__title">Drop files or a folder here</div>
        <div class="mono gsd-dropzone__formats">.jpg · .png · .mp4 · .webp · .heic · and more</div>
      </div>
      <div>
        <div class="gsd-pane__sub">Recently dropped</div>
        ${items.map((f) => `
          <div class="gsd-pane__row">
            <span class="material-symbols-outlined" style="color:${f.col}">${f.icon}</span>
            <div style="flex:1; min-width:0">
              <div class="mono gsd-pane__row-title">${f.n}</div>
              <div class="gsd-pane__row-sub">${f.c}</div>
            </div>
            <span class="material-symbols-outlined" style="color:var(--gsd-mute); font-size:18px">chevron_right</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function paneRecipe() {
  const recipes = [
    { n: 'Cinematic Portrait',    tags: ['portrait', 'LUT'],    col: 'var(--gsd-orange)' },
    { n: 'Background Swap',       tags: ['bg', 'ai'],           col: 'var(--gsd-cyan)'   },
    { n: 'Pop Art Warhol',        tags: ['color', 'art'],       col: 'var(--gsd-pink)'   },
    { n: 'Classic Analog Film',   tags: ['grain', 'vintage'],   col: 'var(--gsd-amber)'  },
    { n: 'Mask Cut In',           tags: ['geocode', 'text'],    col: 'var(--gsd-violet)' },
    { n: 'Remove BG HQ',          tags: ['cutout'],             col: 'var(--gsd-teal)'   },
  ];
  return `
    <div class="gsd-pane gsd-pane--recipe">
      <div class="gsd-recipe-search">
        <div class="gsd-recipe-search__input">
          <span class="material-symbols-outlined">library_books</span>
          <span>cine<span class="caret">|</span></span>
        </div>
        <span class="mono gsd-recipe-search__count">6 / 83 matches</span>
      </div>
      <div class="gsd-recipe-grid">
        ${recipes.map((r, i) => `
          <div class="gsd-recipe-card ${i === 0 ? 'is-selected' : ''}" style="--card-color:${r.col}">
            <div class="gsd-recipe-card__thumb" style="background:linear-gradient(135deg, ${r.col}22, ${r.col}08)"></div>
            <div class="gsd-recipe-card__name">${r.n}</div>
            <div class="gsd-recipe-card__tags">
              ${r.tags.map((t) => `<span class="mono">${t}</span>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function paneTweak() {
  const params = [
    { k: 'grain',    v: 0.42, col: 'var(--gsd-amber)'  },
    { k: 'warmth',   v: 0.68, col: 'var(--gsd-orange)' },
    { k: 'contrast', v: 0.55, col: 'var(--gsd-cyan)'   },
    { k: 'vignette', v: 0.31, col: 'var(--gsd-violet)' },
  ];
  return `
    <div class="gsd-pane gsd-pane--tweak">
      <div>
        <div class="mono gsd-pane__sub">Node · Cinematic LUT</div>
        ${params.map((p) => `
          <div class="gsd-tweak-row">
            <div class="gsd-tweak-row__head">
              <span class="mono">${p.k}</span>
              <span class="mono" style="color:${p.col}">${p.v.toFixed(2)}</span>
            </div>
            <div class="gsd-tweak-row__track">
              <div style="width:${p.v * 100}%; background:${p.col}"></div>
              <div class="gsd-tweak-row__knob" style="left:${p.v * 100}%; background:${p.col}; box-shadow:0 0 0 3px ${p.col}33"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="gsd-tweak-preview">
        <span class="mono gsd-tweak-preview__chip">preview · live</span>
        <span class="material-symbols-outlined">image</span>
      </div>
    </div>
  `;
}

function paneBeforeAfter() {
  return `
    <div class="gsd-pane gsd-pane--ba">
      ${['before', 'after'].map((label, i) => `
        <div class="gsd-ba-frame ${i === 1 ? 'is-after' : ''}">
          <span class="mono gsd-ba-frame__label">${label}</span>
          <span class="material-symbols-outlined">image</span>
        </div>
      `).join('')}
    </div>
  `;
}

function paneRun() {
  const tiles = Array.from({ length: 40 }).map((_, i) => {
    const done = i < 25, run = i === 25;
    const bg = done ? 'var(--gsd-teal)' : run ? 'var(--gsd-amber)' : 'rgba(255,255,255,0.05)';
    return `<div class="gsd-run-tile" style="background:${bg}; opacity:${done ? 0.85 : 1}"></div>`;
  }).join('');
  return `
    <div class="gsd-pane gsd-pane--run">
      <div class="gsd-run-head">
        <div>
          <div class="gsd-run-head__title">cinematic_portrait · batch run</div>
          <div class="mono gsd-run-head__sub">124 items · 7 nodes · est. 48s</div>
        </div>
        <div class="gsd-pill gsd-pill--green">
          <span class="gsd-dot gsd-dot--green pulse-dot"></span>
          <span class="mono">running</span>
        </div>
      </div>
      <div class="gsd-run-bar"><div></div></div>
      <div class="gsd-run-grid">${tiles}</div>
      <div class="gsd-run-legend">
        <span><span class="mono" style="color:var(--gsd-teal)">●</span> done 25</span>
        <span><span class="mono" style="color:var(--gsd-amber)">●</span> processing 1</span>
        <span><span class="mono" style="color:var(--gsd-mute)">●</span> queued 98</span>
      </div>
    </div>
  `;
}

function renderHero(host, variant, counts) {
  if (variant === 'tour') renderGuidedTourHero(host);
  else renderLivePipelineHero(host, counts);
}

// ═══════════════════════════════════════════════════════════════
// PIPELINE DIAGRAM — 7 node categories
// ═══════════════════════════════════════════════════════════════
async function renderPipelineDiagram(host, counts) {
  // Count recipes per category. This dynamic pass runs on every render so
  // the page stays in sync as users add/remove recipes.
  let perCategory = {};
  try {
    const [{ registry }, { getAllRecipes }] = await Promise.all([
      import('../engine/registry.js'),
      import('../data/recipes.js'),
    ]);
    const byId = new Map();
    for (const def of registry.listAll?.() || registry.list?.() || []) {
      byId.set(def.id, def.category || 'Uncategorised');
    }
    const recipes = await getAllRecipes();
    const walk = (nodes) => {
      if (!nodes) return;
      for (const n of nodes) {
        const cat = byId.get(n.transformId || n.type);
        if (cat) perCategory[cat] = (perCategory[cat] || 0) + 1;
        if (n.branches) n.branches.forEach((b) => walk(b.nodes));
        if (n.thenNodes) walk(n.thenNodes);
        if (n.elseNodes) walk(n.elseNodes);
      }
    };
    recipes.forEach((r) => walk(r.nodes));
  } catch {
    // Non-fatal — falls back to static "—" labels below.
  }

  const rows = [
    { label: 'Process',   sub: 'Extract · parse · metadata',     icon: 'code',        color: 'var(--gsd-teal)',   cat: 'Metadata' },
    { label: 'Analyse',   sub: 'Local AI · detect · understand', icon: 'search',      color: 'var(--gsd-cyan)',   cat: 'AI & Composition' },
    { label: 'Amend',     sub: 'LUTs · color · structure',       icon: 'tune',        color: 'var(--gsd-orange)', cat: 'Color & Tone' },
    { label: 'Annotate',  sub: 'Captions · watermarks · titles', icon: 'text_fields', color: 'var(--gsd-amber)',  cat: 'Overlays & Typography' },
    { label: 'Aggregate', sub: 'Compose · grid · collage',       icon: 'grid_view',   color: 'var(--gsd-violet)', cat: 'Flow Control' },
    { label: 'Create',    sub: 'Generate new media from data',   icon: 'auto_awesome',color: 'var(--gsd-pink)',   cat: 'Geometric & Framing' },
    { label: 'Organise',  sub: 'Route into intelligent folders', icon: 'account_tree',color: 'var(--gsd-blue)',   cat: 'Video Effects' },
  ];

  host.innerHTML = `
    <div class="gsd-card gsd-pipeline-diagram">
      <div class="gsd-pipeline-diagram__bg"></div>
      <div class="gsd-pipeline-diagram__inner">
        <div class="gsd-section-title">
          <h2>What can PicMachina do?</h2>
          <span class="mono">${counts.categoryCount} node categories · ${counts.recipeCount} recipes</span>
        </div>
        <div class="gsd-pipeline-diagram__grid">
          <div class="gsd-pipeline-diagram__io">
            <div class="mono gsd-pipeline-diagram__io-tag">Input</div>
            <div class="gsd-pipeline-diagram__io-title">Any media</div>
            <div class="gsd-pipeline-diagram__io-sub">Folders, zips, cameras, cloud drives.</div>
            <div class="gsd-pipeline-diagram__formats">
              ${['jpg', 'png', 'mp4', 'heic', 'raw', 'gif', 'webp'].map((x) => `<span class="mono">.${x}</span>`).join('')}
            </div>
          </div>
          <div class="gsd-pipeline-diagram__core">
            <div class="gsd-pipeline-diagram__connector gsd-pipeline-diagram__connector--left"></div>
            <div class="gsd-pipeline-diagram__connector gsd-pipeline-diagram__connector--right"></div>
            ${rows.map((r, i) => `
              <div class="gsd-pipeline-row" style="--row-color:${r.color}">
                <div class="gsd-pipeline-row__icon">
                  <span class="material-symbols-outlined">${r.icon}</span>
                </div>
                <div class="gsd-pipeline-row__body">
                  <div class="gsd-pipeline-row__title">
                    ${r.label}
                    <span class="mono gsd-pipeline-row__idx">${String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div class="gsd-pipeline-row__sub">${r.sub}</div>
                </div>
                <div class="mono gsd-pipeline-row__count">
                  ${perCategory[r.cat] != null ? perCategory[r.cat] : '—'} nodes
                </div>
                <div class="gsd-pipeline-row__tick"></div>
              </div>
            `).join('')}
          </div>
          <div class="gsd-pipeline-diagram__io">
            <div class="mono gsd-pipeline-diagram__io-tag">Output</div>
            <div class="gsd-pipeline-diagram__io-title">Deliverables</div>
            <div class="gsd-pipeline-diagram__io-sub">Organised, named, and ready to ship.</div>
            <div class="gsd-pipeline-diagram__out-paths">
              ${['/exports/final/', '/contact_sheets/', '/social_instagram/', '/client_drop.zip'].map((p) => `
                <div class="mono"><span style="color:var(--gsd-green)">→</span> ${p}</div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// PERSONAS
// ═══════════════════════════════════════════════════════════════
function renderPersonas(host) {
  const personas = [
    {
      k: 'individuals', label: 'Individuals', icon: 'person', color: 'var(--gsd-teal)',
      desc: 'Auto-categorise messy photo dumps, compile vacation memories into simple timelapses, and efficiently format images for sharing or archiving without heavy editing software.',
      stat: '4 starter recipes', samples: ['Holiday collage', 'Backup & rename', 'Face-group'],
    },
    {
      k: 'photographers', label: 'Photographers', icon: 'photo_camera', color: 'var(--gsd-orange)',
      desc: 'Batch process exports, apply uniform watermarks, auto-generate client contact sheets, extract EXIF for cataloguing, and standardise color profiles across large shoots.',
      stat: '18 pro recipes', samples: ['Contact sheet', 'Watermark · uniform', 'EXIF → CSV'],
    },
    {
      k: 'creators', label: 'Content Creators', icon: 'videocam', color: 'var(--gsd-pink)',
      desc: 'Adapt multi-format media for Instagram, TikTok, and YouTube. Automatically overlay branding, pull highlights, and convert snippets into engaging GIFs.',
      stat: '22 social recipes', samples: ['TikTok 9:16', 'Highlights reel', 'Thumbnail kit'],
    },
    {
      k: 'enterprise', label: 'Enterprise Users', icon: 'apartment', color: 'var(--gsd-blue)',
      desc: 'Build robust product photography pipelines, clear backgrounds via local AI, standardise margins across thousands of SKUs, and strip sensitive metadata for compliance.',
      stat: '9 enterprise recipes', samples: ['SKU pipeline', 'BG clear · AI', 'Metadata sanitise'],
    },
  ];

  host.innerHTML = `
    <div class="gsd-personas">
      <div class="gsd-section-title">
        <h2>Who uses PicMachina?</h2>
        <span class="mono">Pick a persona · see starter recipes</span>
      </div>
      <div class="gsd-personas__grid">
        <div class="gsd-personas__rail">
          ${personas.map((p, i) => `
            <button class="gsd-persona-tab ${i === 0 ? 'is-active' : ''}" data-persona="${i}" style="--persona-color:${p.color}">
              <div class="gsd-persona-tab__icon">
                <span class="material-symbols-outlined">${p.icon}</span>
              </div>
              <div class="gsd-persona-tab__body">
                <div class="gsd-persona-tab__label">${p.label}</div>
                <div class="gsd-persona-tab__stat">${p.stat}</div>
              </div>
            </button>
          `).join('')}
        </div>
        <div class="gsd-persona-detail" id="gsd-persona-detail"></div>
      </div>
    </div>
  `;

  const renderDetail = (idx) => {
    const p = personas[idx];
    const detailEl = host.querySelector('#gsd-persona-detail');
    detailEl.style.setProperty('--persona-color', p.color);
    detailEl.innerHTML = `
      <div class="gsd-persona-detail__glow"></div>
      <div class="gsd-persona-detail__head">
        <div class="gsd-persona-tab__icon gsd-persona-tab__icon--lg">
          <span class="material-symbols-outlined">${p.icon}</span>
        </div>
        <div>
          <div class="gsd-persona-detail__title">${p.label}</div>
          <div class="mono gsd-persona-detail__stat">${p.stat}</div>
        </div>
      </div>
      <p class="gsd-persona-detail__desc">${p.desc}</p>
      <div class="mono gsd-persona-detail__samples-tag">Starter recipes</div>
      <div class="gsd-persona-detail__samples">
        ${p.samples.map((s) => `
          <button class="gsd-persona-chip" data-action="use-sample">
            <span class="gsd-dot" style="background:${p.color}"></span>
            <span>${s}</span>
            <span class="material-symbols-outlined" style="font-size:14px">chevron_right</span>
          </button>
        `).join('')}
        <button class="gsd-persona-chip gsd-persona-chip--primary" data-action="persona-preset">
          <span class="material-symbols-outlined">add</span>
          Start from ${p.label.toLowerCase()} preset
        </button>
      </div>
    `;
    detailEl.querySelectorAll('[data-action]').forEach((b) => {
      b.addEventListener('click', () => go('#lib'));
    });
  };

  host.querySelectorAll('.gsd-persona-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('.gsd-persona-tab').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderDetail(Number(btn.dataset.persona));
    });
  });

  renderDetail(0);
}

// ═══════════════════════════════════════════════════════════════
// SMART AUTOMATION — "Just Ask Claude"
// ═══════════════════════════════════════════════════════════════
function renderAutomation(host) {
  const prompts = [
    'deblur photos older than 2020 and re-save as webp',
    'build a contact sheet per folder with watermark',
    'extract faces, group, and rename by person',
  ];

  host.innerHTML = `
    <div class="gsd-automation">
      <div class="gsd-automation__bg"></div>
      <div class="gsd-automation__inner">
        <div>
          <div class="gsd-pill gsd-pill--violet">
            <span class="material-symbols-outlined" style="font-size:14px">auto_awesome</span>
            <span class="mono">Just Ask Claude</span>
          </div>
          <h3 class="gsd-automation__headline">Smart automation, made simple.</h3>
          <p class="gsd-automation__lede">
            Describe what you want in plain English. Claude builds the
            recipe — every node, every parameter — and you just hit Run.
            No technical skills required.
          </p>
        </div>
        <div class="gsd-automation__terminal">
          <div class="mono gsd-pane__sub" style="margin-bottom:10px">Prompt</div>
          <div class="mono gsd-automation__prompt" id="gsd-auto-prompt"><span class="caret" style="color:var(--gsd-blue-2)">▎</span></div>
          <div class="gsd-automation__foot">
            <div class="gsd-automation__dots" id="gsd-auto-dots">
              ${prompts.map((_, i) => `<div class="gsd-automation__dot${i === 0 ? ' is-active' : ''}"></div>`).join('')}
            </div>
            <button class="gsd-btn gsd-btn--primary gsd-btn--sm" data-action="generate">
              <span class="material-symbols-outlined">auto_fix_high</span>
              Generate
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const promptEl = host.querySelector('#gsd-auto-prompt');
  const dotsEl   = host.querySelector('#gsd-auto-dots');

  // Typewriter animation across the three sample prompts.
  let pi = 0;
  const typePrompt = () => {
    const target = prompts[pi];
    let i = 0;
    promptEl.innerHTML = `<span class="caret" style="color:var(--gsd-blue-2)">▎</span>`;
    const typer = track(setInterval(() => {
      i++;
      const shown = target.slice(0, i);
      promptEl.innerHTML = `${shown}<span class="caret" style="color:var(--gsd-blue-2)">▎</span>`;
      if (i >= target.length) {
        clearInterval(typer);
        // Remove from registry (already fired) — simplest: ignore.
        track(setTimeout(() => {
          pi = (pi + 1) % prompts.length;
          dotsEl.querySelectorAll('.gsd-automation__dot').forEach((d, j) =>
            d.classList.toggle('is-active', j === pi)
          );
          typePrompt();
        }, 1800));
      }
    }, 28));
  };
  typePrompt();

  host.querySelector('[data-action="generate"]').addEventListener('click', () => go('#lib'));
}

// ═══════════════════════════════════════════════════════════════
// SHORTCUTS
// ═══════════════════════════════════════════════════════════════
function renderShortcuts(host) {
  const items = [
    { keys: ['⌘', 'K'],      label: 'Open launcher'     },
    { keys: ['⌘', 'N'],      label: 'New recipe'        },
    { keys: ['⌘', '⇧', 'O'], label: 'Open folder'       },
    { keys: ['⌘', 'R'],      label: 'Run last recipe'   },
    { keys: ['⌘', '/'],      label: 'Ask Claude'        },
  ];
  host.innerHTML = `
    <div class="gsd-shortcuts">
      <div class="mono gsd-shortcuts__tag">Shortcuts</div>
      ${items.map((x) => `
        <div class="gsd-shortcuts__item">
          <div class="gsd-shortcuts__keys">
            ${x.keys.map((ch) => `<kbd class="mono">${ch}</kbd>`).join('')}
          </div>
          <span class="gsd-shortcuts__label">${x.label}</span>
        </div>
      `).join('')}
      <div style="flex:1"></div>
      <div class="mono gsd-shortcuts__meta">100% local · on-device processing</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// STYLES (scoped)
// ═══════════════════════════════════════════════════════════════
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    .gsd-screen {
      --gsd-bg:       #0a0f1c;
      --gsd-panel:    #141c2e;
      --gsd-line:     rgba(255,255,255,0.07);
      --gsd-line-2:   rgba(255,255,255,0.12);
      --gsd-text:     #e7ecf5;
      --gsd-dim:      #98a3b8;
      --gsd-mute:     #6a7590;
      --gsd-blue:     #3b82f6;
      --gsd-blue-2:   #60a5fa;
      --gsd-teal:     #2dd4bf;
      --gsd-orange:   #fb923c;
      --gsd-pink:     #f472b6;
      --gsd-amber:    #fbbf24;
      --gsd-violet:   #a78bfa;
      --gsd-cyan:     #22d3ee;
      --gsd-green:    #34d399;
      --gsd-red:      #f87171;

      background: var(--gsd-bg);
      color: var(--gsd-text);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      min-height: 100%;
      -webkit-font-smoothing: antialiased;
    }
    .gsd-screen .mono  { font-family: 'JetBrains Mono', ui-monospace, monospace; }
    .gsd-screen .serif { font-family: 'Instrument Serif', Georgia, serif; font-weight: 400; font-style: italic; color: #cbd5e1; }
    .gsd-screen button { font-family: inherit; cursor: pointer; border: 0; background: none; color: inherit; }
    .gsd-screen h1, .gsd-screen h2, .gsd-screen h3 { margin: 0; }

    /* ── Header ── */
    .gsd-header {
      display: flex; align-items: center; gap: 10px;
      padding: 18px 32px;
      border-bottom: 1px solid var(--gsd-line);
      background: rgba(10,15,28,0.6);
      backdrop-filter: blur(8px);
      position: sticky; top: 0; z-index: 20;
    }
    .gsd-header__title { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
    .gsd-header__title h1 { font-size: 18px; font-weight: 600; letter-spacing: .2px; }
    .gsd-header__right { display: flex; align-items: center; gap: 12px; }

    .gsd-hero-switch {
      display: inline-flex; border: 1px solid var(--gsd-line-2); border-radius: 8px;
      padding: 3px; background: rgba(255,255,255,0.03);
    }
    .gsd-hero-switch__btn {
      padding: 6px 12px; font-size: 12px; font-weight: 500; color: var(--gsd-dim);
      border-radius: 5px;
    }
    .gsd-hero-switch__btn.is-active {
      background: rgba(59,130,246,0.2); color: #93c5fd;
    }

    /* ── Body ── */
    .gsd-body {
      padding: 28px 32px 48px;
      display: flex; flex-direction: column; gap: 32px;
      max-width: 1200px; margin: 0 auto;
    }
    .gsd-body > section { min-width: 0; }

    /* ── Pills & dots ── */
    .gsd-pill {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 5px 10px; border-radius: 999px;
      background: rgba(255,255,255,0.05); border: 1px solid var(--gsd-line-2);
      font-size: 11px;
    }
    .gsd-pill--accent { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #93c5fd; }
    .gsd-pill--green  { background: rgba(52,211,153,0.1); border-color: rgba(52,211,153,0.3); color: #6ee7b7; }
    .gsd-pill--violet { background: rgba(167,139,250,0.15); border-color: rgba(167,139,250,0.35); color: #c4b5fd; }
    .gsd-pill--status .mono { color: var(--gsd-mute); }
    .gsd-pill .mono { letter-spacing: 1px; text-transform: uppercase; font-size: 11px; }

    .gsd-dot { display: inline-block; width: 6px; height: 6px; border-radius: 3px; background: currentColor; }
    .gsd-dot--green { background: var(--gsd-green); }
    .gsd-dot--blue  { background: var(--gsd-blue-2); }

    @keyframes gsdPulse { 0%, 100% { opacity: .4 } 50% { opacity: 1 } }
    .pulse-dot { animation: gsdPulse 1.4s ease-in-out infinite; }

    @keyframes gsdMarch { to { stroke-dashoffset: -24; } }
    .march { stroke-dasharray: 6 6; animation: gsdMarch 1.2s linear infinite; }

    @keyframes gsdFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    .float-slow { animation: gsdFloat 3.2s ease-in-out infinite; }

    @keyframes gsdCaret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
    .caret { animation: gsdCaret 1s step-end infinite; }

    @keyframes gsdFillbar { from { transform: scaleX(0); } to { transform: scaleX(1); } }

    /* ── Buttons ── */
    .gsd-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 12px 18px; border-radius: 10px;
      font-size: 14px; font-weight: 500; white-space: nowrap;
      transition: transform .15s ease, background .15s ease, border-color .15s ease;
    }
    .gsd-btn .material-symbols-outlined { font-size: 18px; }
    .gsd-btn--sm { padding: 7px 12px; font-size: 12px; }
    .gsd-btn--sm .material-symbols-outlined { font-size: 16px; }
    .gsd-btn--primary {
      background: var(--gsd-blue); color: #fff; font-weight: 600;
      box-shadow: 0 8px 24px rgba(59,130,246,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset;
    }
    .gsd-btn--primary:hover { transform: translateY(-1px); }
    .gsd-btn--secondary {
      background: rgba(255,255,255,0.06); border: 1px solid var(--gsd-line-2);
    }
    .gsd-btn--secondary:hover { background: rgba(255,255,255,0.09); }
    .gsd-btn--ghost { color: var(--gsd-dim); padding: 12px 14px; font-size: 13px; }
    .gsd-btn--ghost:hover { color: var(--gsd-text); }

    /* ── Hero (shared wrapper) ── */
    .gsd-hero {
      position: relative; border-radius: 20px; overflow: hidden;
      background: linear-gradient(180deg, #0f1a30 0%, #0c1424 100%);
      border: 1px solid var(--gsd-line-2);
      padding: 40px 48px;
    }
    .gsd-hero__bg {
      position: absolute; inset: 0; pointer-events: none;
      background:
        radial-gradient(600px 300px at 20% 0%, rgba(59,130,246,0.18), transparent 60%),
        radial-gradient(500px 300px at 90% 100%, rgba(167,139,250,0.12), transparent 60%);
    }
    .gsd-hero__bg--green {
      background:
        radial-gradient(600px 300px at 20% 0%, rgba(52,211,153,0.14), transparent 60%),
        radial-gradient(500px 300px at 90% 100%, rgba(59,130,246,0.14), transparent 60%);
    }
    .gsd-hero__grid-bg {
      position: absolute; inset: 0; opacity: .5;
      background-image:
        linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
      background-size: 48px 48px;
      -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
              mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
    }
    .gsd-hero__inner { position: relative; display: grid; grid-template-columns: 1.1fr 1.3fr; gap: 48px; align-items: center; }
    .gsd-hero__copy h1 { font-size: 56px; line-height: 1.02; letter-spacing: -1.2px; font-weight: 700; margin-top: 18px; }
    .gsd-hero__headline .serif { font-size: 58px; }
    .gsd-hero__lede { color: var(--gsd-dim); font-size: 16px; margin: 18px 0 0; max-width: 480px; line-height: 1.55; }
    .gsd-hero__ctas { display: flex; gap: 10px; margin-top: 26px; flex-wrap: wrap; }
    .gsd-stats { margin-top: 32px; display: flex; gap: 24px; padding-top: 22px; border-top: 1px solid var(--gsd-line); }
    .gsd-stats__k { font-size: 22px; font-weight: 700; }
    .gsd-stats__v { font-size: 11px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1px; }

    /* ── Live Pipeline card ── */
    .gsd-pipeline-card {
      position: relative;
      background: rgba(8,13,25,0.7);
      border: 1px solid var(--gsd-line-2);
      border-radius: 16px;
      padding: 20px;
      min-height: 340px;
      box-shadow: 0 30px 60px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.02) inset;
    }
    .gsd-pipeline-card__chrome { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
    .gsd-traffic { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
    .gsd-traffic--red    { background: #ff5f56; }
    .gsd-traffic--amber  { background: #ffbd2e; }
    .gsd-traffic--green  { background: #27c93f; }
    .gsd-pipeline-card__filename { margin-left: 10px; font-size: 11px; color: var(--gsd-mute); flex: 1; }
    .gsd-pipeline-card__running {
      font-size: 10px; color: var(--gsd-green); display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 7px; background: rgba(52,211,153,0.1); border-radius: 6px;
      border: 1px solid rgba(52,211,153,0.25); font-family: 'JetBrains Mono', monospace;
    }
    .gsd-pipeline-svg { width: 100%; height: 240px; display: block; }
    .gsd-pipeline-card__log {
      margin-top: 10px; font-size: 11px; color: var(--gsd-mute);
      padding: 10px 12px; background: rgba(0,0,0,0.25);
      border-radius: 8px; border: 1px solid var(--gsd-line);
      display: flex; gap: 16px; align-items: center;
    }
    .gsd-pipeline-card__log b { color: var(--gsd-text); }
    .gsd-pipeline-card__chip {
      position: absolute; top: -14px; right: -14px;
      padding: 8px 12px; background: linear-gradient(135deg, #3b82f6, #6366f1);
      border-radius: 999px; font-size: 12px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 6px;
      box-shadow: 0 10px 24px rgba(59,130,246,0.4);
    }

    /* ── Guided Tour hero ── */
    .gsd-hero__inner--tour { display: block; }
    .gsd-tour__headers { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: end; margin-bottom: 30px; }
    .gsd-hero__headline--tour { font-size: 52px; letter-spacing: -1px; line-height: 1.05; margin-top: 18px; }
    .gsd-tour__copy p { color: var(--gsd-dim); font-size: 15px; margin: 0; line-height: 1.6; max-width: 440px; }
    .gsd-tour__ctas { display: flex; gap: 10px; margin-top: 18px; }
    .gsd-tour__ctas .gsd-btn { padding: 11px 16px; font-size: 14px; }

    .gsd-tour__rail { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; margin-bottom: 22px; }
    .gsd-tour__step {
      text-align: left; padding: 14px 16px; border-radius: 12px;
      background: rgba(20,28,46,0.5); border: 1px solid var(--gsd-line-2);
      display: flex; flex-direction: column; gap: 8px; position: relative; overflow: hidden;
      transition: border-color .2s ease, background .2s ease;
    }
    .gsd-tour__step.is-current { border-color: var(--step-color); background: rgba(20,28,46,1); }
    .gsd-tour__step-head { display: flex; align-items: center; gap: 10px; }
    .gsd-tour__step-n {
      width: 26px; height: 26px; border-radius: 8px;
      background: rgba(255,255,255,0.06); color: var(--gsd-dim);
      display: grid; place-items: center; font-size: 12px; font-weight: 700;
    }
    .gsd-tour__step.is-current .gsd-tour__step-n { background: var(--step-color); color: #0a0f1c; }
    .gsd-tour__step-label-small { font-size: 10px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1px; }
    .gsd-tour__step-title { font-size: 14px; font-weight: 600; }
    .gsd-tour__step-sub   { font-size: 12px; color: var(--gsd-mute); margin-top: 2px; }
    .gsd-tour__progress {
      position: absolute; left: 0; bottom: 0; height: 2px; width: 100%;
      background: rgba(255,255,255,0.04); display: none;
    }
    .gsd-tour__step.is-current .gsd-tour__progress { display: block; }
    .gsd-tour__progress > div {
      height: 100%; width: 100%; background: var(--step-color);
      transform-origin: left; animation: gsdFillbar 2.6s linear;
    }

    .gsd-tour__pane {
      background: rgba(8,13,25,0.7); border: 1px solid var(--gsd-line-2);
      border-radius: 16px; padding: 22px; min-height: 260px;
      box-shadow: 0 30px 60px rgba(0,0,0,0.45);
    }

    /* Tour panes */
    .gsd-pane { min-height: 200px; }
    .gsd-pane__sub { font-size: 13px; color: var(--gsd-dim); margin-bottom: 10px; }
    .gsd-pane--drop { display: grid; grid-template-columns: 1.2fr 1fr; gap: 22px; align-items: center; }
    .gsd-dropzone {
      border: 2px dashed rgba(45,212,191,0.35); border-radius: 14px;
      padding: 30px; background: rgba(45,212,191,0.04);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; min-height: 200px;
    }
    .gsd-dropzone__icon {
      width: 56px; height: 56px; border-radius: 16px;
      background: rgba(45,212,191,0.15); display: grid; place-items: center; color: var(--gsd-teal);
    }
    .gsd-dropzone__icon .material-symbols-outlined { font-size: 28px; }
    .gsd-dropzone__title { font-size: 16px; font-weight: 600; }
    .gsd-dropzone__formats { font-size: 11px; color: var(--gsd-mute); }
    .gsd-pane__row {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 10px;
      background: rgba(255,255,255,0.03); border: 1px solid var(--gsd-line);
      margin-bottom: 6px;
    }
    .gsd-pane__row-title { font-size: 12px; }
    .gsd-pane__row-sub   { font-size: 11px; color: var(--gsd-mute); }

    .gsd-recipe-search { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .gsd-recipe-search__input {
      flex: 1; padding: 10px 12px; border: 1px solid var(--gsd-line-2); border-radius: 10px;
      background: rgba(255,255,255,0.03); font-size: 13px; color: var(--gsd-dim);
      display: flex; align-items: center; gap: 8px; font-family: 'JetBrains Mono', monospace;
    }
    .gsd-recipe-search__input .material-symbols-outlined { color: var(--gsd-mute); font-size: 16px; }
    .gsd-recipe-search__count { font-size: 11px; color: var(--gsd-mute); }
    .gsd-recipe-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .gsd-recipe-card {
      padding: 14px; border-radius: 12px;
      background: rgba(255,255,255,0.03); border: 1px solid var(--gsd-line-2);
    }
    .gsd-recipe-card.is-selected { border-color: var(--card-color); }
    .gsd-recipe-card__thumb {
      height: 70px; border-radius: 8px; margin-bottom: 10px; position: relative; overflow: hidden;
    }
    .gsd-recipe-card__thumb::after {
      content: ''; position: absolute; inset: 0;
      background-image: repeating-linear-gradient(135deg, rgba(255,255,255,0.04) 0 8px, transparent 8px 16px);
    }
    .gsd-recipe-card__name { font-size: 13px; font-weight: 600; }
    .gsd-recipe-card__tags { display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap; }
    .gsd-recipe-card__tags span {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(255,255,255,0.05); color: var(--gsd-dim);
    }

    .gsd-pane--tweak { display: grid; grid-template-columns: 1.1fr 1fr; gap: 22px; }
    .gsd-tweak-row { margin-bottom: 14px; }
    .gsd-tweak-row__head { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: var(--gsd-dim); }
    .gsd-tweak-row__track { height: 4px; border-radius: 2px; background: rgba(255,255,255,0.06); position: relative; }
    .gsd-tweak-row__track > div { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; }
    .gsd-tweak-row__knob {
      position: absolute; top: 50%; width: 12px; height: 12px; border-radius: 50%;
      transform: translate(-50%, -50%);
    }
    .gsd-tweak-preview {
      border-radius: 12px; background: linear-gradient(135deg, #3a2418, #1a1410);
      position: relative; overflow: hidden; min-height: 200px;
      display: grid; place-items: center;
    }
    .gsd-tweak-preview::before {
      content: ''; position: absolute; inset: 0;
      background-image: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 2px, transparent 2px 4px);
    }
    .gsd-tweak-preview__chip {
      position: absolute; left: 12px; top: 10px;
      font-size: 10px; color: rgba(255,255,255,0.6);
      padding: 3px 7px; background: rgba(0,0,0,0.4); border-radius: 4px;
    }
    .gsd-tweak-preview .material-symbols-outlined { color: rgba(255,255,255,0.25); font-size: 48px; }

    .gsd-pane--ba { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .gsd-ba-frame {
      border-radius: 12px; border: 1px solid var(--gsd-line-2); overflow: hidden;
      position: relative; min-height: 210px; display: grid; place-items: center;
      background: linear-gradient(135deg, #2a2f3a, #0a0f1c);
    }
    .gsd-ba-frame.is-after {
      border-color: var(--gsd-orange);
      background: linear-gradient(135deg, #3a2418, #0a0f1c);
    }
    .gsd-ba-frame::before {
      content: ''; position: absolute; inset: 0;
      background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 12px, transparent 12px 24px);
    }
    .gsd-ba-frame__label {
      position: absolute; top: 10px; left: 12px;
      font-size: 11px; color: rgba(255,255,255,0.75);
      padding: 3px 8px; border-radius: 6px; background: rgba(0,0,0,0.45);
    }
    .gsd-ba-frame .material-symbols-outlined { color: rgba(255,255,255,0.2); font-size: 40px; position: relative; }

    .gsd-run-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .gsd-run-head__title { font-size: 15px; font-weight: 600; }
    .gsd-run-head__sub   { font-size: 11px; color: var(--gsd-mute); }
    .gsd-run-bar { height: 10px; border-radius: 5px; background: rgba(255,255,255,0.06); overflow: hidden; margin-bottom: 16px; }
    .gsd-run-bar > div { height: 100%; width: 62%; background: linear-gradient(90deg, var(--gsd-blue), var(--gsd-teal)); }
    .gsd-run-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 6px; }
    .gsd-run-tile { aspect-ratio: 1 / 1; border-radius: 4px; }
    .gsd-run-legend { display: flex; gap: 20px; margin-top: 16px; color: var(--gsd-dim); font-size: 12px; }

    /* ── Pipeline Diagram ── */
    .gsd-card {
      background: var(--gsd-panel); border: 1px solid var(--gsd-line-2);
      border-radius: 16px; padding: 32px; position: relative; overflow: hidden;
    }
    .gsd-pipeline-diagram__bg {
      position: absolute; inset: 0; pointer-events: none;
      background: radial-gradient(600px 200px at 50% 0%, rgba(59,130,246,0.08), transparent 70%);
    }
    .gsd-pipeline-diagram__inner { position: relative; }
    .gsd-section-title { display: flex; align-items: baseline; gap: 14px; margin-bottom: 26px; flex-wrap: wrap; }
    .gsd-section-title h2 { font-size: 28px; font-weight: 700; letter-spacing: -.5px; }
    .gsd-section-title .mono { font-size: 11px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1.4px; }
    .gsd-pipeline-diagram__grid { display: grid; grid-template-columns: 200px 1fr 200px; gap: 24px; align-items: stretch; }
    .gsd-pipeline-diagram__io {
      background: rgba(8,13,25,0.6); border: 1px solid var(--gsd-line-2);
      border-radius: 14px; padding: 18px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .gsd-pipeline-diagram__io-tag { font-size: 10px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1.4px; margin-bottom: 10px; }
    .gsd-pipeline-diagram__io-title { font-size: 18px; font-weight: 600; margin-bottom: 4px; }
    .gsd-pipeline-diagram__io-sub   { font-size: 12px; color: var(--gsd-dim); }
    .gsd-pipeline-diagram__formats { display: flex; gap: 4px; margin-top: 14px; flex-wrap: wrap; }
    .gsd-pipeline-diagram__formats span {
      font-size: 10px; padding: 2px 6px; border-radius: 4px;
      background: rgba(255,255,255,0.05); border: 1px solid var(--gsd-line); color: var(--gsd-dim);
    }
    .gsd-pipeline-diagram__out-paths { margin-top: 14px; display: flex; flex-direction: column; gap: 4px; }
    .gsd-pipeline-diagram__out-paths > div { font-size: 11px; color: var(--gsd-dim); display: inline-flex; align-items: center; gap: 6px; }

    .gsd-pipeline-diagram__core { display: flex; flex-direction: column; gap: 10px; position: relative; }
    .gsd-pipeline-diagram__connector {
      position: absolute; top: 50%; width: 24px; height: 2px; transform: translateY(-50%);
    }
    .gsd-pipeline-diagram__connector--left  { left: -24px;  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15)); }
    .gsd-pipeline-diagram__connector--right { right: -24px; background: linear-gradient(90deg, rgba(255,255,255,0.15), transparent); }

    .gsd-pipeline-row {
      display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: 14px;
      padding: 10px 14px; border-radius: 10px;
      background: rgba(8,13,25,0.4); border: 1px solid var(--gsd-line);
      position: relative;
      transition: transform .2s ease, border-color .2s ease, background .2s ease;
    }
    .gsd-pipeline-row:hover { transform: translateY(-2px); border-color: var(--row-color); }
    .gsd-pipeline-row__icon {
      width: 32px; height: 32px; border-radius: 8px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--row-color) 20%, transparent), color-mix(in srgb, var(--row-color) 5%, transparent));
      border: 1px solid color-mix(in srgb, var(--row-color) 35%, transparent);
      color: var(--row-color); display: grid; place-items: center;
    }
    .gsd-pipeline-row__icon .material-symbols-outlined { font-size: 18px; }
    .gsd-pipeline-row__title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
    .gsd-pipeline-row__idx {
      font-size: 10px; color: var(--gsd-mute); padding: 1px 6px;
      border: 1px solid var(--gsd-line); border-radius: 4px;
    }
    .gsd-pipeline-row__sub { font-size: 12px; color: var(--gsd-dim); }
    .gsd-pipeline-row__count { color: var(--gsd-mute); font-size: 11px; }
    .gsd-pipeline-row__tick {
      position: absolute; left: 0; top: 50%; width: 3px; height: 22px;
      background: var(--row-color); border-radius: 2px; transform: translateY(-50%);
    }

    /* ── Personas ── */
    .gsd-personas__grid { display: grid; grid-template-columns: 300px 1fr; gap: 22px; }
    .gsd-personas__rail { display: flex; flex-direction: column; gap: 6px; }
    .gsd-persona-tab {
      text-align: left; padding: 12px 14px; border-radius: 10px;
      background: transparent; border: 1px solid var(--gsd-line);
      display: flex; align-items: center; gap: 12px;
    }
    .gsd-persona-tab.is-active { background: rgba(20,28,46,1); border-color: var(--persona-color); }
    .gsd-persona-tab__icon {
      width: 30px; height: 30px; border-radius: 8px; flex: 0 0 30px;
      background: linear-gradient(135deg, color-mix(in srgb, var(--persona-color) 20%, transparent), color-mix(in srgb, var(--persona-color) 5%, transparent));
      border: 1px solid color-mix(in srgb, var(--persona-color) 35%, transparent);
      color: var(--persona-color); display: grid; place-items: center;
    }
    .gsd-persona-tab__icon--lg { width: 44px; height: 44px; border-radius: 12px; flex: 0 0 44px; }
    .gsd-persona-tab__icon .material-symbols-outlined { font-size: 18px; }
    .gsd-persona-tab__icon--lg .material-symbols-outlined { font-size: 24px; }
    .gsd-persona-tab__body { min-width: 0; flex: 1; }
    .gsd-persona-tab__label { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .gsd-persona-tab__stat  { font-size: 11px; color: var(--gsd-mute); white-space: nowrap; }

    .gsd-persona-detail {
      background: var(--gsd-panel); border: 1px solid var(--gsd-line-2);
      border-radius: 14px; padding: 24px; position: relative; overflow: hidden;
    }
    .gsd-persona-detail__glow {
      position: absolute; top: 0; right: 0; width: 240px; height: 240px;
      background: radial-gradient(circle at top right, color-mix(in srgb, var(--persona-color) 14%, transparent), transparent 60%);
      pointer-events: none;
    }
    .gsd-persona-detail__head { display: flex; align-items: center; gap: 14px; margin-bottom: 16px; position: relative; }
    .gsd-persona-detail__title { font-size: 18px; font-weight: 700; white-space: nowrap; }
    .gsd-persona-detail__stat  { font-size: 11px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1.4px; }
    .gsd-persona-detail__desc  { margin: 0; color: var(--gsd-dim); font-size: 14px; line-height: 1.6; max-width: 640px; position: relative; }
    .gsd-persona-detail__samples-tag {
      font-size: 10px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1.4px; margin: 22px 0 10px;
      position: relative;
    }
    .gsd-persona-detail__samples { display: flex; gap: 10px; flex-wrap: wrap; position: relative; }
    .gsd-persona-chip {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-radius: 10px;
      background: rgba(255,255,255,0.03); border: 1px solid var(--gsd-line-2);
      font-size: 13px;
    }
    .gsd-persona-chip:hover { background: rgba(255,255,255,0.06); }
    .gsd-persona-chip--primary {
      background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #93c5fd; font-weight: 500;
    }
    .gsd-persona-chip .gsd-dot { width: 6px; height: 6px; border-radius: 3px; }

    /* ── Smart Automation ── */
    .gsd-automation {
      border-radius: 16px; padding: 32px;
      background: linear-gradient(135deg, rgba(59,130,246,0.14), rgba(167,139,250,0.08));
      border: 1px solid rgba(59,130,246,0.3);
      position: relative; overflow: hidden;
    }
    .gsd-automation__bg {
      position: absolute; top: -60px; right: -60px; width: 260px; height: 260px;
      background: radial-gradient(circle, rgba(167,139,250,0.25), transparent 60%);
      pointer-events: none;
    }
    .gsd-automation__inner {
      display: grid; grid-template-columns: 1.3fr 1fr; gap: 28px;
      align-items: center; position: relative;
    }
    .gsd-automation__headline { font-size: 26px; font-weight: 700; letter-spacing: -.4px; margin: 12px 0 10px; }
    .gsd-automation__lede { color: var(--gsd-dim); font-size: 14px; line-height: 1.6; margin: 0; max-width: 480px; }
    .gsd-automation__terminal {
      background: rgba(8,13,25,0.85); border: 1px solid var(--gsd-line-2);
      border-radius: 12px; padding: 16px;
    }
    .gsd-automation__prompt { font-size: 14px; line-height: 1.5; min-height: 56px; color: var(--gsd-text); }
    .gsd-automation__foot { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; }
    .gsd-automation__dots { display: flex; gap: 6px; }
    .gsd-automation__dot  { width: 24px; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.1); transition: background .2s; }
    .gsd-automation__dot.is-active { background: var(--gsd-blue-2); }

    /* ── Shortcuts ── */
    .gsd-shortcuts {
      display: flex; gap: 18px; flex-wrap: wrap;
      padding: 18px 24px; border-radius: 12px;
      background: rgba(255,255,255,0.02); border: 1px solid var(--gsd-line);
    }
    .gsd-shortcuts__tag { font-size: 10px; color: var(--gsd-mute); text-transform: uppercase; letter-spacing: 1.4px; align-self: center; }
    .gsd-shortcuts__item { display: inline-flex; align-items: center; gap: 8px; }
    .gsd-shortcuts__keys { display: inline-flex; gap: 3px; }
    .gsd-shortcuts__keys kbd {
      font-size: 11px; padding: 3px 7px; border-radius: 5px;
      background: rgba(255,255,255,0.06); border: 1px solid var(--gsd-line-2);
      border-bottom-width: 2px;
    }
    .gsd-shortcuts__label { font-size: 12px; color: var(--gsd-dim); }
    .gsd-shortcuts__meta  { font-size: 11px; color: var(--gsd-mute); align-self: center; }

    /* ── Responsive collapse ── */
    @media (max-width: 1000px) {
      .gsd-hero { padding: 28px; }
      .gsd-hero__inner { grid-template-columns: 1fr; gap: 28px; }
      .gsd-hero__copy h1 { font-size: 42px; }
      .gsd-hero__headline .serif { font-size: 44px; }
      .gsd-tour__headers { grid-template-columns: 1fr; gap: 18px; align-items: start; }
      .gsd-tour__rail { grid-template-columns: repeat(5, minmax(0,1fr)); }
      .gsd-pipeline-diagram__grid { grid-template-columns: 1fr; }
      .gsd-pipeline-diagram__connector { display: none; }
      .gsd-personas__grid { grid-template-columns: 1fr; }
      .gsd-automation__inner { grid-template-columns: 1fr; gap: 18px; }
    }
    @media (max-width: 700px) {
      .gsd-body { padding: 18px; gap: 22px; }
      .gsd-header { padding: 14px 18px; }
      .gsd-header__right .gsd-pill--status { display: none; }
      .gsd-pane--drop,
      .gsd-pane--tweak,
      .gsd-pane--ba { grid-template-columns: 1fr !important; }
      .gsd-recipe-grid { grid-template-columns: repeat(2, 1fr); }
      .gsd-tour__rail { grid-template-columns: repeat(2, 1fr); }
      .gsd-run-grid { grid-template-columns: repeat(5, 1fr); }
    }
  `;
  document.head.appendChild(style);
}
