/**
 * PicMachina — GSD: Get Started (benefits-focused, scroll-snap landing)
 *
 * Vertical stack of full-viewport slides with CSS scroll-snap (Apple-style).
 * Three interactive slides — Why-switch, Outcomes, Personas — let the user
 * click a tile: the other tiles slide away, the chosen tile docks on the
 * left, and a detail panel reveals on the right. The detail panel content
 * varies by slide:
 *   • Why-switch → video placeholder
 *   • Outcomes   → split before/after placeholder
 *   • Personas   → video testimonial placeholder
 *
 * A "Powerful in dozens of ways" slide shows ~50 feature labels floating
 * outward from the centre, repeating.
 */

import { getAllRecipes } from '../data/recipes.js';

// ─── Utils ────────────────────────────────────────────────────
function go(hash) {
  if (!hash.startsWith('#')) hash = '#' + hash;
  location.hash = hash;
}

async function getStats() {
  const recipes = await getAllRecipes().catch(() => []);
  return { recipeCount: recipes.length };
}

const SLIDES = [
  { id: 'hero',     label: 'Welcome' },
  { id: 'why',      label: 'Why' },
  { id: 'outcomes', label: 'Outcomes' },
  { id: 'personas', label: 'Who it\'s for' },
  { id: 'how',      label: 'How' },
  { id: 'features', label: 'Features' },
  { id: 'stats',    label: 'At a glance' },
  { id: 'cta',      label: 'Get started' },
];

// 50 feature labels for the floating cloud
const FEATURES = [
  'Background Removal', 'Watermarking', 'Smart Crop', 'Face Swap', 'Colour Match',
  'Auto-Levels', 'Slideshow Builder', 'Video Trim', 'Frame Extraction', 'GIF Export',
  'Batch Resize', 'Format Convert', 'Multi-Size Export', 'EXIF Strip', 'Geotag Edit',
  'AI Upscaling', 'Style Transfer', 'Mask Generation', 'Object Removal', 'Sky Replace',
  'Tone Mapping', 'HDR Merge', 'Panorama Stitch', 'Border & Frame', 'Caption Overlay',
  'Logo Stamp', 'Sequence Numbering', 'Filename Templates', 'Folder Routing', 'CSV Import',
  'Drag & Drop Recipes', 'Block Builder', 'Live Preview', 'Undo History', 'Run Queue',
  'Output Browser', 'Template Library', 'AI Recipe Author', 'Conditional Steps', 'Loop Steps',
  'Webhooks', 'Local-First', 'GPU Acceleration', 'Privacy by Default', 'Cross-Platform',
  'Keyboard Shortcuts', 'Dark & Light', 'Plugin API', 'Smart Naming', 'Audio Tracks',
];

// ─── Detail panel content ─────────────────────────────────────
const WHY_DETAILS = {
  hours: {
    title: 'Save hours every week',
    blurb: 'Watch a real run finish in the time it takes to make coffee.',
    video: 'why-hours.mp4',
  },
  same: {
    title: 'The same result, every time',
    blurb: '500 product shots, identical crop, watermark and colour profile.',
    video: 'why-same.mp4',
  },
  channel: {
    title: 'One workflow, every channel',
    blurb: 'A single source image fanned out to web, social and print.',
    video: 'why-channel.mp4',
  },
};

const OUTCOME_DETAILS = {
  bg:        { title: 'Strip backgrounds from 200 product photos',     blurb: 'Drag the folder, hit Run.' },
  slide:     { title: 'Make a slideshow video from a holiday folder',  blurb: 'Pick the music, you\'re done.' },
  watermark: { title: 'Watermark and resize a year of blog images',    blurb: 'One recipe, applied to the lot.' },
  swap:      { title: 'Swap faces or colours across a batch',          blurb: 'Consistent edits, zero manual tweaking.' },
  social:    { title: 'Build a social pack — square, portrait, story', blurb: 'Every aspect ratio in one go.' },
  vid:       { title: 'Turn a video into stills, or stills into a video', blurb: 'Both directions, no extra tools.' },
};

const PERSONA_DETAILS = {
  creator:      { title: 'Content creators',           blurb: '"I publish 5 videos a week — PicMachina makes the thumbnails."', video: 'persona-creator.mp4' },
  shop:         { title: 'Small shops & marketplaces', blurb: '"Every listing photo perfectly on-brand, in minutes."',          video: 'persona-shop.mp4' },
  photographer: { title: 'Photographers',              blurb: '"Client galleries delivered in every format the brief asks for."', video: 'persona-photographer.mp4' },
  library:      { title: 'Anyone with a messy library',blurb: '"My 30,000-photo backlog, finally organised."',                  video: 'persona-library.mp4' },
};

// ─── Main render ──────────────────────────────────────────────
export async function render(container) {
  injectStyles();
  const stats = await getStats();

  container.innerHTML = `
    <div class="wel-screen" id="wel-scroller">

      <!-- Slide 1: Hero -->
      <section class="wel-slide wel-slide--hero" id="slide-hero">
        <div class="wel-slide__inner wel-hero">
          <h1 class="wel-hero__title">
            Edit one photo.<br/>
            <span class="wel-accent">Apply it to a thousand.</span>
          </h1>
          <p class="wel-hero__sub">
            PicMachina turns the fiddly bits of image and video work — resizing,
            watermarking, swapping backgrounds, exporting for every platform —
            into one-click recipes you can reuse forever.
          </p>
          <div class="wel-hero__cta">
            <button class="wel-btn wel-btn--primary" data-go="#lib">
              <span class="material-symbols-outlined">play_arrow</span>
              Process my first batch
            </button>
            <button class="wel-btn wel-btn--ghost" data-go="#shc">
              <span class="material-symbols-outlined">auto_awesome</span>
              See what's possible
            </button>
          </div>
          <div class="wel-scroll-hint">
            <span class="material-symbols-outlined">keyboard_arrow_down</span>
            <span>Scroll to explore</span>
          </div>
        </div>
      </section>

      <!-- Slide 2: Why-switch -->
      <section class="wel-slide" id="slide-why">
        <div class="wel-slide__inner">
          <header class="wel-slide__head">
            <p class="wel-eyebrow">The benefits</p>
            <h2 class="wel-h2">Why people switch to PicMachina</h2>
          </header>
          <div class="wel-detail-wrap" data-kind="why">
            <div class="wel-tiles">
              ${tile('hours',   'schedule', 'Save hours every week',         'Drop in a folder, pick a recipe, walk away. What used to take an afternoon in Photoshop runs in minutes — untouched.')}
              ${tile('same',    'repeat',   'The same result, every time',   'Recipes are repeatable. Your thumbnails, product shots and social posts come out identical whether it\'s 5 images or 5,000.')}
              ${tile('channel', 'share',    'One workflow, every channel',   'Web-ready, Instagram, YouTube thumbnails, print — every size and format from a single source image.')}
              ${backBtn()}
            </div>
            <aside class="wel-detail" aria-live="polite"></aside>
          </div>
        </div>
      </section>

      <!-- Slide 3: Outcomes -->
      <section class="wel-slide" id="slide-outcomes">
        <div class="wel-slide__inner">
          <header class="wel-slide__head">
            <p class="wel-eyebrow">Real outcomes — not features</p>
            <h2 class="wel-h2">What you can do in an afternoon</h2>
          </header>
          <div class="wel-detail-wrap wel-detail-wrap--outcomes" data-kind="outcomes">
            <div class="wel-outcomes">
              ${outcomeCard('bg',        'content_cut',              'Strip backgrounds from 200 product photos',          'Drag the folder, hit Run.')}
              ${outcomeCard('slide',     'movie',                    'Make a slideshow video from a holiday folder',       'Pick the music, you\'re done.')}
              ${outcomeCard('watermark', 'branding_watermark',       'Watermark and resize a year of blog images',         'One recipe, applied to the lot.')}
              ${outcomeCard('swap',      'face_retouching_natural',  'Swap faces or colours across a batch',               'Consistent edits, zero manual tweaking.')}
              ${outcomeCard('social',    'aspect_ratio',             'Build a social pack — square, portrait, story',      'Every aspect ratio in one go.')}
              ${outcomeCard('vid',       'movie_filter',             'Turn a video into stills, or stills into a video',   'Both directions, no extra tools.')}
              ${backBtn()}
            </div>
            <aside class="wel-detail" aria-live="polite"></aside>
          </div>
        </div>
      </section>

      <!-- Slide 4: Personas -->
      <section class="wel-slide" id="slide-personas">
        <div class="wel-slide__inner">
          <header class="wel-slide__head">
            <p class="wel-eyebrow">Who it's for</p>
            <h2 class="wel-h2">Built for anyone with a folder full of media</h2>
          </header>
          <div class="wel-detail-wrap wel-detail-wrap--personas" data-kind="personas">
            <div class="wel-personas">
              ${persona('creator',      'podcasts',     'Content creators',           'Keeping a publishing schedule alive without burning out on edits.')}
              ${persona('shop',         'storefront',   'Small shops & marketplaces', 'Every product photo on-brand and on-spec, automatically.')}
              ${persona('photographer', 'photo_camera', 'Photographers',              'Client galleries delivered in every required size and format.')}
              ${persona('library',      'photo_library','Anyone with a messy library','Order without hours of clicking.')}
              ${backBtn()}
            </div>
            <aside class="wel-detail" aria-live="polite"></aside>
          </div>
        </div>
      </section>

      <!-- Slide 5: How-it-works -->
      <section class="wel-slide" id="slide-how">
        <div class="wel-slide__inner">
          <header class="wel-slide__head">
            <p class="wel-eyebrow">How it works</p>
            <h2 class="wel-h2">Three steps. That's the whole product.</h2>
          </header>
          <div class="wel-steps">
            <div class="wel-step">
              <div class="wel-step__num">1</div>
              <h3>Pick a recipe</h3>
              <p>Start from a ready-made one, or describe what you want and let
              AI build it for you.</p>
            </div>
            <div class="wel-step">
              <div class="wel-step__num">2</div>
              <h3>Point it at your images</h3>
              <p>A folder, a selection, or a single file — whatever you have.</p>
            </div>
            <div class="wel-step">
              <div class="wel-step__num">3</div>
              <h3>Press Run</h3>
              <p>Get a tidy export folder, every time.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Slide 6: Floating features -->
      <section class="wel-slide wel-slide--features" id="slide-features">
        <div class="wel-features-bg" aria-hidden="true">
          ${FEATURES.map((f, i) => `<span class="wel-fly" style="${flyStyle(i, FEATURES.length)}">${f}</span>`).join('')}
        </div>
        <div class="wel-slide__inner wel-features-inner">
          <p class="wel-eyebrow">Powerful in dozens of ways</p>
          <h2 class="wel-h2">${FEATURES.length}+ features.<br/>One simple workflow.</h2>
          <p class="wel-features-sub">From background removal to AI upscaling — every tool you need to
          take one image (or a folder of them) all the way to publish-ready.</p>
        </div>
      </section>

      <!-- Slide 7: Stats -->
      <section class="wel-slide" id="slide-stats">
        <div class="wel-slide__inner">
          <header class="wel-slide__head">
            <p class="wel-eyebrow">At a glance</p>
            <h2 class="wel-h2">Powerful, private, and ready right now</h2>
          </header>
          <div class="wel-stats">
            <div class="wel-stats__item">
              <div class="wel-stats__num">${stats.recipeCount}</div>
              <div class="wel-stats__label">ready-made recipes — no setup needed</div>
            </div>
            <div class="wel-stats__item">
              <div class="wel-stats__num">∞</div>
              <div class="wel-stats__label">images per run — your hardware is the limit</div>
            </div>
            <div class="wel-stats__item">
              <div class="wel-stats__num">100%</div>
              <div class="wel-stats__label">local — your photos never leave your machine</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Slide 8: Closing CTA -->
      <section class="wel-slide wel-slide--cta" id="slide-cta">
        <div class="wel-slide__inner wel-closing">
          <h2>Stop redoing the same edits.<br/>Start running them.</h2>
          <button class="wel-btn wel-btn--primary wel-btn--lg" data-go="#lib">
            <span class="material-symbols-outlined">play_arrow</span>
            Try a recipe now
          </button>
          <p class="wel-closing__hint">
            Looking for engine internals, the node catalogue, or AI integrations?
            <a href="#pow" class="wel-link">Visit the Power Users page →</a>
          </p>
        </div>
      </section>

      <!-- Side dot-nav -->
      <nav class="wel-dots" aria-label="Page sections">
        ${SLIDES.map(s => `
          <button class="wel-dot" data-target="slide-${s.id}" aria-label="${s.label}">
            <span class="wel-dot__pip"></span>
            <span class="wel-dot__label">${s.label}</span>
          </button>
        `).join('')}
      </nav>

    </div>
  `;

  wireCTAs(container);
  wireDots(container);
  wireInteractiveTiles(container);
  wireVisibility(container);
}

// ─── Card helpers ─────────────────────────────────────────────
function tile(id, icon, title, body) {
  return `
    <button class="wel-tile" data-tile="${id}" type="button">
      <div class="wel-tile__icon"><span class="material-symbols-outlined">${icon}</span></div>
      <h3>${title}</h3>
      <p>${body}</p>
      <span class="wel-tile__cta">
        <span class="material-symbols-outlined">play_circle</span>
        Watch
      </span>
    </button>
  `;
}

function outcomeCard(id, icon, title, sub) {
  return `
    <button class="wel-outcome" data-tile="${id}" type="button">
      <span class="material-symbols-outlined wel-outcome__icon">${icon}</span>
      <div class="wel-outcome__body">
        <h3>${title}</h3>
        <p>${sub}</p>
      </div>
      <span class="wel-outcome__cta">
        <span class="material-symbols-outlined">compare</span>
        Before / after
      </span>
    </button>
  `;
}

function backBtn() {
  return `
    <button class="wel-back" type="button" aria-label="Back to all">
      <span class="material-symbols-outlined">arrow_back</span>
      Back to all
    </button>
  `;
}

function persona(id, icon, title, body) {
  return `
    <button class="wel-persona" data-tile="${id}" type="button">
      <span class="material-symbols-outlined wel-persona__icon">${icon}</span>
      <h3>${title}</h3>
      <p>${body}</p>
      <span class="wel-persona__cta">
        <span class="material-symbols-outlined">play_circle</span>
        Hear their story
      </span>
    </button>
  `;
}

// ─── Floating features positioning ────────────────────────────
function flyStyle(i, total) {
  // pseudo-random but deterministic
  const seed = (i * 9301 + 49297) % 233280;
  const rand = (n) => ((seed * (n + 1)) % 1000) / 1000;
  const angle = rand(1) * Math.PI * 2;
  const radius = 12 + rand(2) * 38; // 12% to 50% from centre
  const x = 50 + Math.cos(angle) * radius;
  const y = 50 + Math.sin(angle) * radius * 0.85;
  const delay = -(i / total) * 14; // stagger across the 14s loop
  const duration = 12 + rand(3) * 6;
  const z = rand(4);
  return `--fx:${x.toFixed(2)}%; --fy:${y.toFixed(2)}%; --fd:${delay.toFixed(2)}s; --fdur:${duration.toFixed(2)}s; --fz:${z.toFixed(2)};`;
}

// ─── Wiring ───────────────────────────────────────────────────
function wireCTAs(container) {
  container.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.getAttribute('data-go')));
  });
}

function wireDots(container) {
  const dots = Array.from(container.querySelectorAll('.wel-dot'));
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const target = container.querySelector('#' + dot.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function wireInteractiveTiles(container) {
  container.querySelectorAll('.wel-detail-wrap').forEach((wrap) => {
    const kind = wrap.dataset.kind;
    const detail = wrap.querySelector('.wel-detail');
    const back = wrap.querySelector('.wel-back');

    wrap.querySelectorAll('[data-tile]').forEach((tileEl) => {
      tileEl.addEventListener('click', () => expandTile(wrap, detail, kind, tileEl));
    });
    back?.addEventListener('click', () => collapseWrap(wrap));
  });
}

// Expand / collapse via the View Transitions API where available — the
// browser captures the before/after layouts and morphs the selected tile
// into its new docked position automatically. We assign a stable
// `view-transition-name` on the active tile and the detail panel so they
// each get tracked across the layout change.
function expandTile(wrap, detail, kind, tileEl) {
  if (wrap._busy) return;
  wrap._busy = true;
  const id = tileEl.dataset.tile;

  const apply = () => {
    const tiles = wrap.querySelectorAll('[data-tile]');
    tiles.forEach(t => t.classList.toggle('is-active', t === tileEl));
    tiles.forEach(t => { if (t !== tileEl) t.classList.add('is-hidden'); });
    detail.innerHTML = renderDetail(kind, id);
    wrap.classList.add('is-expanded');
  };

  runWithTransition(wrap, tileEl, detail, apply, () => { wrap._busy = false; });
}

function collapseWrap(wrap) {
  if (wrap._busy) return;
  wrap._busy = true;
  const detail = wrap.querySelector('.wel-detail');
  const activeTile = wrap.querySelector('[data-tile].is-active');

  const apply = () => {
    wrap.classList.remove('is-expanded');
    wrap.querySelectorAll('[data-tile].is-hidden').forEach(t => t.classList.remove('is-hidden'));
    wrap.querySelectorAll('[data-tile]').forEach(t => t.classList.remove('is-active'));
    detail.innerHTML = '';
  };

  runWithTransition(wrap, activeTile, detail, apply, () => { wrap._busy = false; });
}

function runWithTransition(wrap, tileEl, detail, apply, done) {
  if ('startViewTransition' in document) {
    if (tileEl) tileEl.style.viewTransitionName = 'wel-vt-tile';
    if (detail) detail.style.viewTransitionName = 'wel-vt-detail';
    const t = document.startViewTransition(apply);
    t.finished.finally(() => {
      if (tileEl) tileEl.style.viewTransitionName = '';
      if (detail) detail.style.viewTransitionName = '';
      done();
    });
  } else {
    apply();
    done();
  }
}

function renderDetail(kind, id) {
  if (kind === 'why') {
    const d = WHY_DETAILS[id] || {};
    return `
      <div class="wel-detail__pane wel-detail__pane--video">
        <div class="wel-video-ph">
          <span class="material-symbols-outlined">play_circle</span>
          <p>Video coming soon</p>
          <small>${d.video || ''}</small>
        </div>
        <div class="wel-detail__caption">
          <h4>${d.title || ''}</h4>
          <p>${d.blurb || ''}</p>
        </div>
      </div>
    `;
  }
  if (kind === 'outcomes') {
    const d = OUTCOME_DETAILS[id] || {};
    return `
      <div class="wel-detail__pane wel-detail__pane--ba">
        <div class="wel-ba">
          <div class="wel-ba__slot">
            <span class="wel-ba__label">Before</span>
            <div class="wel-ba__placeholder">
              <span class="material-symbols-outlined">image</span>
              <small>before-${id}</small>
            </div>
          </div>
          <div class="wel-ba__slot">
            <span class="wel-ba__label">After</span>
            <div class="wel-ba__placeholder wel-ba__placeholder--after">
              <span class="material-symbols-outlined">auto_awesome</span>
              <small>after-${id}</small>
            </div>
          </div>
        </div>
        <div class="wel-detail__caption">
          <h4>${d.title || ''}</h4>
          <p>${d.blurb || ''}</p>
        </div>
      </div>
    `;
  }
  if (kind === 'personas') {
    const d = PERSONA_DETAILS[id] || {};
    return `
      <div class="wel-detail__pane wel-detail__pane--video">
        <div class="wel-video-ph wel-video-ph--testimonial">
          <span class="material-symbols-outlined">record_voice_over</span>
          <p>Video testimonial coming soon</p>
          <small>${d.video || ''}</small>
        </div>
        <div class="wel-detail__caption">
          <h4>${d.title || ''}</h4>
          <p>${d.blurb || ''}</p>
        </div>
      </div>
    `;
  }
  return '';
}

function wireVisibility(container) {
  const scroller = container.querySelector('#wel-scroller');
  const dots = Array.from(container.querySelectorAll('.wel-dot'));
  const slides = Array.from(container.querySelectorAll('.wel-slide'));
  const setActive = (id) => {
    dots.forEach(d => d.classList.toggle('is-active', d.dataset.target === id));
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting && e.intersectionRatio >= 0.4) {
          e.target.classList.add('is-visible');
        }
      });
      const visible = entries
        .filter(e => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { root: scroller, threshold: [0.4, 0.6, 0.8] });
    slides.forEach(s => io.observe(s));
  } else {
    slides.forEach(s => s.classList.add('is-visible'));
  }
  if (slides[0]) {
    slides[0].classList.add('is-visible');
    setActive(slides[0].id);
  }
}

// ─── Styles ───────────────────────────────────────────────────
let _stylesInjected = false;
function injectStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;
  const style = document.createElement('style');
  style.id = 'wel-screen-styles';
  style.textContent = `
    .wel-screen {
      --wel-bg:        #0a0f1c;
      --wel-panel:     #141c2e;
      --wel-panel-2:   #1a2238;
      --wel-line:      rgba(255,255,255,0.08);
      --wel-line-2:    rgba(255,255,255,0.14);
      --wel-text:      #e7ecf5;
      --wel-dim:       #98a3b8;
      --wel-mute:      #6a7590;
      --wel-blue:      #3b82f6;
      --wel-blue-2:    #60a5fa;
      --wel-violet:    #8b5cf6;

      position: relative;
      height: 100%;
      overflow-y: scroll;
      scroll-snap-type: y mandatory;
      scroll-behavior: smooth;
      color: var(--wel-text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      line-height: 1.55;
      background: var(--wel-bg);
    }
    .wel-screen::-webkit-scrollbar { width: 0; height: 0; }
    .wel-screen { scrollbar-width: none; }

    .wel-screen h2, .wel-screen h3, .wel-screen h4 { color: var(--wel-text); }
    .wel-screen p { color: var(--wel-dim); margin: 0; }

    /* ─── Slide shell ──────────────────────────────────────── */
    .wel-slide {
      scroll-snap-align: start;
      scroll-snap-stop: always;
      min-height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 56px 28px;
      box-sizing: border-box;
      position: relative;
    }
    .wel-slide__inner { width: 100%; max-width: 1200px; }
    .wel-slide__head  { margin-bottom: 28px; max-width: 820px; }

    .wel-eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.18em;
      font-size: 12px;
      color: var(--wel-blue-2) !important;
      margin: 0 0 10px !important;
      font-weight: 600;
    }
    .wel-h2 {
      font-size: clamp(28px, 4vw, 44px);
      letter-spacing: -0.02em;
      line-height: 1.1;
      margin: 0;
      font-weight: 650;
    }

    /* Subtle fade-up when a slide enters view */
    @media (prefers-reduced-motion: no-preference) {
      .wel-slide__inner > * {
        opacity: 0;
        transform: translateY(18px);
        transition: opacity .7s ease, transform .7s ease;
      }
      .wel-slide.is-visible .wel-slide__inner > * { opacity: 1; transform: none; }
      .wel-slide.is-visible .wel-slide__inner > *:nth-child(2) { transition-delay: .08s; }
      .wel-slide.is-visible .wel-slide__inner > *:nth-child(3) { transition-delay: .16s; }
    }

    /* ─── Hero ─────────────────────────────────────────────── */
    .wel-slide--hero {
      background:
        radial-gradient(1100px 520px at 15% 10%, rgba(96,165,250,0.22), transparent 60%),
        radial-gradient(900px 420px at 110% 110%, rgba(139,92,246,0.18), transparent 60%),
        linear-gradient(180deg, #111a2e 0%, #0c1326 100%);
    }
    .wel-hero { max-width: 880px; }
    .wel-hero__title {
      font-size: clamp(40px, 6.4vw, 76px);
      line-height: 1.02;
      letter-spacing: -0.025em;
      margin: 0 0 26px;
      font-weight: 700;
    }
    .wel-accent {
      background: linear-gradient(90deg, var(--wel-blue-2), var(--wel-violet));
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .wel-hero__sub {
      font-size: clamp(16px, 1.5vw, 21px);
      color: var(--wel-dim);
      margin-bottom: 36px;
      max-width: 700px;
    }
    .wel-hero__cta { display: flex; gap: 12px; flex-wrap: wrap; }

    .wel-scroll-hint {
      position: absolute; bottom: 32px; left: 50%;
      transform: translateX(-50%);
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      color: var(--wel-mute); font-size: 12px;
      letter-spacing: 0.1em; text-transform: uppercase;
      opacity: 0.7;
      animation: wel-bob 2.2s ease-in-out infinite;
    }
    .wel-scroll-hint .material-symbols-outlined { font-size: 22px; }
    @keyframes wel-bob {
      0%, 100% { transform: translate(-50%, 0); }
      50%      { transform: translate(-50%, 6px); }
    }

    /* ─── Buttons ──────────────────────────────────────────── */
    .wel-btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 13px 24px;
      border-radius: 999px;
      border: 1px solid transparent;
      font-size: 15px; font-weight: 600;
      cursor: pointer;
      transition: transform .12s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease;
    }
    .wel-btn .material-symbols-outlined { font-size: 20px; }
    .wel-btn--primary {
      background: linear-gradient(135deg, var(--wel-blue) 0%, var(--wel-violet) 100%);
      color: white;
      box-shadow: 0 8px 24px rgba(59,130,246,0.32);
    }
    .wel-btn--primary:hover { transform: translateY(-1px); box-shadow: 0 12px 28px rgba(59,130,246,0.4); }
    .wel-btn--ghost {
      background: rgba(255,255,255,0.04);
      color: var(--wel-text);
      border-color: var(--wel-line-2);
    }
    .wel-btn--ghost:hover { background: rgba(255,255,255,0.08); border-color: var(--wel-blue-2); }
    .wel-btn--lg { padding: 16px 30px; font-size: 16px; }

    /* ─── Detail-wrap (interactive tiles) ──────────────────── */
    /* Layout SNAPS — no transition on grid-template-columns.
       The View Transitions API morphs the active tile and detail panel
       smoothly between the two snapped states. */
    .wel-detail-wrap {
      position: relative;
      display: grid;
      grid-template-columns: 1fr;
      gap: 0;
      align-items: start;
    }
    .wel-detail-wrap.is-expanded {
      grid-template-columns: minmax(340px, 380px) 1fr;
      gap: 28px;
    }

    .wel-tiles, .wel-outcomes, .wel-personas {
      display: grid;
      gap: 20px;
      min-width: 0;
    }
    .wel-tiles    { grid-template-columns: repeat(3, 1fr); }
    .wel-outcomes { grid-template-columns: repeat(2, 1fr); }
    .wel-personas { grid-template-columns: repeat(4, 1fr); }
    .wel-detail-wrap.is-expanded .wel-tiles,
    .wel-detail-wrap.is-expanded .wel-outcomes,
    .wel-detail-wrap.is-expanded .wel-personas {
      grid-template-columns: 1fr;
    }

    [data-tile] { transition: border-color .18s ease, transform .18s ease; }
    [data-tile].is-hidden { display: none; }

    .wel-detail { min-width: 0; }
    .wel-detail-wrap:not(.is-expanded) .wel-detail { display: none; }

    /* View transition tuning */
    ::view-transition-group(wel-vt-tile),
    ::view-transition-group(wel-vt-detail) {
      animation-duration: .55s;
      animation-timing-function: cubic-bezier(.4, 0, .2, 1);
    }
    ::view-transition-old(wel-vt-tile),
    ::view-transition-new(wel-vt-tile) {
      animation-duration: .35s;
      animation-timing-function: ease-out;
    }
    ::view-transition-old(root),
    ::view-transition-new(root) {
      animation-duration: .4s;
    }

    /* Back button — sits inside the grid, last child, full row.
       Hidden by default; revealed once expanded so it appears directly
       below the active tile on the left. */
    .wel-back {
      grid-column: 1 / -1;
      justify-self: stretch;
      display: none;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: rgba(255,255,255,0.04);
      color: var(--wel-blue-2);
      border: 1px solid var(--wel-line-2);
      border-radius: 12px;
      padding: 12px 18px;
      font-size: 14px; font-weight: 600;
      cursor: pointer;
      opacity: 0;
      transition: opacity .25s ease, background .18s ease, border-color .18s ease, color .18s ease;
    }
    .wel-back .material-symbols-outlined { font-size: 18px; }
    .wel-back:hover {
      background: rgba(96,165,250,0.12);
      border-color: var(--wel-blue-2);
      color: var(--wel-text);
    }
    .wel-detail-wrap.is-expanded .wel-back {
      display: inline-flex;
      opacity: 1;
      transition: opacity .3s ease .25s;
    }

    /* ─── Why-switch tiles ─────────────────────────────────── */
    .wel-tile {
      text-align: left;
      cursor: pointer;
      background: var(--wel-panel);
      border: 1px solid var(--wel-line);
      border-radius: 16px;
      padding: 28px 24px;
      color: inherit;
      font: inherit;
      transition: border-color .18s ease, transform .18s ease, max-height .45s ease, opacity .35s ease, padding .35s ease, border-width .35s ease;
    }
    .wel-tile:hover { border-color: var(--wel-blue-2); transform: translateY(-3px); }
    .wel-tile.is-active { border-color: var(--wel-blue-2); box-shadow: 0 8px 24px rgba(59,130,246,0.18); }
    .wel-detail-wrap.is-expanded .wel-tile.is-active .wel-tile__cta { display: none; }
    .wel-tile__icon {
      width: 48px; height: 48px;
      border-radius: 12px;
      background: rgba(96,165,250,0.14);
      color: var(--wel-blue-2);
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 14px;
    }
    .wel-tile__icon .material-symbols-outlined { font-size: 26px; }
    .wel-tile h3 { font-size: 18px; margin: 0 0 6px; font-weight: 600; }
    .wel-tile p  { font-size: 14.5px; }
    .wel-tile__cta {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 14px;
      color: var(--wel-blue-2);
      font-size: 13px; font-weight: 600;
    }
    .wel-tile__cta .material-symbols-outlined { font-size: 18px; }

    /* ─── Outcome cards ────────────────────────────────────── */
    .wel-outcome {
      text-align: left; cursor: pointer;
      background: var(--wel-panel);
      border: 1px solid var(--wel-line);
      border-radius: 14px;
      padding: 22px 24px;
      color: inherit; font: inherit;
      display: grid;
      grid-template-columns: auto 1fr;
      column-gap: 16px;
      align-items: start;
      transition: border-color .18s ease, transform .18s ease, max-height .45s ease, opacity .35s ease, padding .35s ease, border-width .35s ease;
    }
    .wel-outcome:hover { border-color: var(--wel-line-2); transform: translateY(-2px); }
    .wel-outcome.is-active { border-color: var(--wel-blue-2); box-shadow: 0 8px 24px rgba(59,130,246,0.18); }
    /* When the outcome card is the docked active tile, stack icon above text
       so the title doesn't get squeezed into a narrow column. */
    .wel-detail-wrap.is-expanded .wel-outcome.is-active {
      grid-template-columns: 1fr;
      row-gap: 12px;
    }
    .wel-detail-wrap.is-expanded .wel-outcome.is-active .wel-outcome__icon {
      font-size: 32px !important;
    }
    .wel-detail-wrap.is-expanded .wel-outcome.is-active .wel-outcome__cta { display: none; }
    .wel-outcome__icon {
      font-size: 28px !important;
      color: var(--wel-blue-2);
      margin-top: 2px;
    }
    .wel-outcome__body { min-width: 0; }
    .wel-outcome h3 { font-size: 16px; margin: 0 0 4px; font-weight: 600; }
    .wel-outcome p  { font-size: 14px; }
    .wel-outcome__cta {
      grid-column: 1 / -1;
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 10px;
      color: var(--wel-blue-2);
      font-size: 13px; font-weight: 600;
    }
    .wel-outcome__cta .material-symbols-outlined { font-size: 18px; }

    /* ─── Personas ─────────────────────────────────────────── */
    .wel-persona {
      text-align: left; cursor: pointer;
      background: var(--wel-panel-2);
      border: 1px solid var(--wel-line);
      border-radius: 14px;
      padding: 24px 22px;
      color: inherit; font: inherit;
      transition: border-color .18s ease, transform .18s ease, max-height .45s ease, opacity .35s ease, padding .35s ease, border-width .35s ease;
    }
    .wel-persona:hover { border-color: var(--wel-line-2); transform: translateY(-2px); }
    .wel-persona.is-active { border-color: var(--wel-violet); box-shadow: 0 8px 24px rgba(139,92,246,0.22); }
    .wel-detail-wrap.is-expanded .wel-persona.is-active .wel-persona__cta { display: none; }
    .wel-persona__icon {
      font-size: 32px !important;
      color: var(--wel-violet);
      display: block;
      margin-bottom: 12px;
    }
    .wel-persona h3 { font-size: 16px; margin: 0 0 6px; font-weight: 600; }
    .wel-persona p  { font-size: 13.5px; }
    .wel-persona__cta {
      display: inline-flex; align-items: center; gap: 6px;
      margin-top: 12px;
      color: var(--wel-violet);
      font-size: 13px; font-weight: 600;
    }
    .wel-persona__cta .material-symbols-outlined { font-size: 18px; }

    /* ─── Detail panel content ─────────────────────────────── */
    .wel-detail__pane {
      display: flex;
      flex-direction: column;
      gap: 16px;
      height: 100%;
      min-height: 360px;
    }
    .wel-detail__caption h4 { font-size: 18px; margin: 0 0 4px; font-weight: 600; }
    .wel-detail__caption p  { font-size: 14.5px; }

    .wel-video-ph {
      flex: 1;
      min-height: 280px;
      border-radius: 14px;
      background:
        radial-gradient(600px 240px at 50% 40%, rgba(96,165,250,0.15), transparent 60%),
        var(--wel-panel-2);
      border: 1px dashed var(--wel-line-2);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 8px;
      color: var(--wel-mute);
    }
    .wel-video-ph .material-symbols-outlined { font-size: 56px; color: var(--wel-blue-2); }
    .wel-video-ph p { color: var(--wel-dim); margin: 0; font-weight: 500; }
    .wel-video-ph small { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
    .wel-video-ph--testimonial .material-symbols-outlined { color: var(--wel-violet); }

    .wel-ba {
      flex: 1;
      min-height: 280px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .wel-ba__slot {
      position: relative;
      border-radius: 12px;
      background: var(--wel-panel-2);
      border: 1px dashed var(--wel-line-2);
      overflow: hidden;
    }
    .wel-ba__label {
      position: absolute; top: 10px; left: 12px;
      font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase;
      color: var(--wel-blue-2);
      background: rgba(10,15,28,0.6);
      padding: 4px 8px; border-radius: 999px;
    }
    .wel-ba__placeholder {
      width: 100%; height: 100%;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 6px;
      color: var(--wel-mute);
    }
    .wel-ba__placeholder .material-symbols-outlined { font-size: 40px; color: var(--wel-blue-2); }
    .wel-ba__placeholder--after .material-symbols-outlined { color: var(--wel-violet); }
    .wel-ba__placeholder small { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }

    /* ─── Steps ────────────────────────────────────────────── */
    .wel-steps {
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px;
    }
    .wel-step {
      background: var(--wel-panel);
      border: 1px solid var(--wel-line);
      border-radius: 16px;
      padding: 32px 28px;
    }
    .wel-step__num {
      width: 38px; height: 38px;
      border-radius: 50%;
      background: linear-gradient(135deg, var(--wel-blue), var(--wel-violet));
      color: white; font-weight: 700; font-size: 16px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 14px;
    }
    .wel-step h3 { font-size: 19px; margin: 0 0 8px; font-weight: 600; }
    .wel-step p  { font-size: 15px; }

    /* ─── Floating features slide ──────────────────────────── */
    .wel-slide--features {
      overflow: hidden;
      background:
        radial-gradient(900px 500px at 50% 50%, rgba(59,130,246,0.16), transparent 60%),
        var(--wel-bg);
    }
    .wel-features-bg {
      position: absolute; inset: 0;
      perspective: 900px;
      pointer-events: none;
    }
    .wel-fly {
      position: absolute;
      left: var(--fx);
      top:  var(--fy);
      transform: translate(-50%, -50%);
      font-size: 14px;
      font-weight: 600;
      color: var(--wel-text);
      background: rgba(20,28,46,0.55);
      border: 1px solid var(--wel-line);
      backdrop-filter: blur(4px);
      padding: 6px 12px;
      border-radius: 999px;
      white-space: nowrap;
      animation: wel-fly var(--fdur) linear var(--fd) infinite;
      will-change: transform, opacity;
    }
    @keyframes wel-fly {
      0%   { transform: translate(-50%, -50%) translateZ(-800px); opacity: 0; }
      12%  { opacity: 0.9; }
      80%  { opacity: 1; }
      100% { transform: translate(-50%, -50%) translateZ(500px); opacity: 0; }
    }
    .wel-features-inner {
      position: relative;
      z-index: 1;
      text-align: center;
      max-width: 720px;
      background: radial-gradient(420px 240px at 50% 50%, rgba(10,15,28,0.85), rgba(10,15,28,0.0) 75%);
      padding: 40px 24px;
      border-radius: 24px;
    }
    .wel-features-sub {
      margin-top: 16px !important;
      font-size: 16px;
      color: var(--wel-dim);
    }

    /* ─── Stats ────────────────────────────────────────────── */
    .wel-stats {
      padding: 40px;
      border-radius: 18px;
      background: linear-gradient(180deg, rgba(96,165,250,0.08), rgba(139,92,246,0.05));
      border: 1px solid var(--wel-line);
      display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px;
      text-align: center;
    }
    .wel-stats__num {
      font-size: clamp(38px, 5vw, 56px);
      font-weight: 700; letter-spacing: -0.02em; line-height: 1;
      background: linear-gradient(90deg, var(--wel-blue-2), var(--wel-violet));
      -webkit-background-clip: text; background-clip: text; color: transparent;
    }
    .wel-stats__label { color: var(--wel-dim); font-size: 14.5px; margin-top: 10px; }

    /* ─── Closing ──────────────────────────────────────────── */
    .wel-slide--cta {
      background:
        radial-gradient(800px 360px at 50% 0%, rgba(96,165,250,0.22), transparent 60%),
        radial-gradient(700px 340px at 50% 100%, rgba(139,92,246,0.18), transparent 60%),
        var(--wel-bg);
    }
    .wel-closing { text-align: center; }
    .wel-closing h2 {
      font-size: clamp(32px, 5vw, 56px);
      letter-spacing: -0.02em;
      margin: 0 0 32px; font-weight: 700; line-height: 1.1;
    }
    .wel-closing__hint { margin-top: 28px; color: var(--wel-mute); font-size: 14px; }
    .wel-link { color: var(--wel-blue-2); text-decoration: none; font-weight: 600; }
    .wel-link:hover { text-decoration: underline; }

    /* ─── Side dot-nav ─────────────────────────────────────── */
    .wel-dots {
      position: fixed; right: 24px; top: 50%;
      transform: translateY(-50%);
      display: flex; flex-direction: column; gap: 10px;
      z-index: 5;
    }
    .wel-dot {
      background: transparent; border: 0; padding: 6px 8px;
      cursor: pointer;
      display: flex; align-items: center; gap: 10px;
      color: var(--wel-mute);
      font-size: 12px; letter-spacing: 0.06em;
    }
    .wel-dot__pip {
      width: 8px; height: 8px; border-radius: 50%;
      background: rgba(255,255,255,0.25);
      transition: all .2s ease;
    }
    .wel-dot__label {
      opacity: 0; transform: translateX(6px);
      transition: opacity .2s ease, transform .2s ease;
      white-space: nowrap;
    }
    .wel-dot:hover .wel-dot__label { opacity: 1; transform: translateX(0); }
    .wel-dot:hover .wel-dot__pip   { background: var(--wel-blue-2); }
    .wel-dot.is-active .wel-dot__pip {
      background: var(--wel-blue-2);
      box-shadow: 0 0 0 4px rgba(96,165,250,0.18);
      transform: scale(1.15);
    }
    .wel-dot.is-active { color: var(--wel-text); }

    /* ─── Responsive ───────────────────────────────────────── */
    @media (max-width: 1100px) {
      .wel-personas { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 900px) {
      .wel-tiles, .wel-steps, .wel-stats { grid-template-columns: 1fr; }
      .wel-outcomes { grid-template-columns: 1fr; }
      .wel-detail-wrap { grid-template-columns: 1fr; }
      .wel-detail-wrap.is-expanded { grid-template-columns: 1fr; gap: 20px; }
      .wel-dots { right: 12px; }
      .wel-dot__label { display: none; }
    }
    @media (max-width: 560px) {
      .wel-slide { padding: 40px 18px; }
      .wel-personas { grid-template-columns: 1fr; }
    }

    /* Respect users who prefer no scroll-hijacking */
    @media (prefers-reduced-motion: reduce) {
      .wel-screen { scroll-snap-type: none; scroll-behavior: auto; }
      .wel-scroll-hint, .wel-fly { animation: none; }
    }
  `;
  document.head.appendChild(style);
}
