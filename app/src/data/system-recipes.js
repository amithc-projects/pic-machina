/**
 * ImageChef — Built-in System Recipes
 *
 * These are read-only. Users can clone them to create their own.
 * Seeded into IndexedDB on first launch by db.js.
 */

export const SYSTEM_RECIPES = [

  // ─── 1. Web Optimise ──────────────────────────────────
  {
    id:          'sys-web-optimise',
    name:        'Web Optimise',
    description: 'Resize to max 1920px wide, strip GPS metadata, export as WebP at 85% quality.',
    isSystem:    true,
    coverColor:  '#0077ff',
    tags:        ['web', 'performance', 'resize'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id:   'step-1', type: 'transform', transformId: 'geo-resize',
        params: { width: '1920', height: '', maintainAspect: true, algo: 'Lanczos' },
        label: 'Resize to 1920px'
      },
      {
        id:   'step-2', type: 'transform', transformId: 'meta-strip',
        params: { level: 'GPS Only' },
        label: 'Strip GPS'
      },
      {
        id:   'step-3', type: 'transform', transformId: 'flow-export',
        params: { suffix: '', format: 'image/webp', quality: 85 },
        label: 'Export WebP 85%'
      }
    ]
  },

  // ─── 2. Thumbnail Pack ────────────────────────────────
  {
    id:          'sys-thumbnail-pack',
    name:        'Thumbnail Pack',
    description: 'Create four JPEG size variants — Full (1920px), Medium (800px), Thumb (400px), Micro (200px) — using the Multi-size Export block.',
    isSystem:    true,
    coverColor:  '#8b5cf6',
    tags:        ['thumbnails', 'variants', 'resize'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'tp-block-ref', type: 'block-ref',
        blockId: 'sys-block-multi-export',
        label: 'Multi-size Export'
      }
    ]
  },

  // ─── 3. Privacy Scrub ─────────────────────────────────
  {
    id:          'sys-privacy-scrub',
    name:        'Privacy Scrub',
    description: 'Blur detected faces and remove all EXIF metadata including GPS. Safe to share.',
    isSystem:    true,
    coverColor:  '#22c55e',
    tags:        ['privacy', 'faces', 'metadata'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'step-1', type: 'transform', transformId: 'ai-face-privacy',
        params: { mode: 'Blur', confidence: 70 },
        label: 'Blur Faces'
      },
      {
        id: 'step-2', type: 'transform', transformId: 'meta-strip',
        params: { level: 'All' },
        label: 'Strip All Metadata'
      },
      {
        id: 'step-3', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_private', format: 'image/jpeg', quality: 90 },
        label: 'Export'
      }
    ]
  },

  // ─── 4. Polaroid Simulator ────────────────────────────
  {
    id:          'sys-polaroid',
    name:        'Polaroid Simulator',
    description: 'Square-crop, add a classic white Polaroid border with a wider bottom, gentle vignette and warm tones.',
    isSystem:    true,
    coverColor:  '#f59e0b',
    tags:        ['creative', 'retro', 'border'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'step-1', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' },
        label: 'Square Crop'
      },
      {
        id: 'step-2', type: 'transform', transformId: 'geo-padding',
        params: { top: '8%', right: '8%', bottom: '14%', left: '8%', color: '#ffffff' },
        label: 'Polaroid Border'
      },
      {
        id: 'step-3', type: 'transform', transformId: 'color-vignette',
        params: { amount: 30, radius: 70 },
        label: 'Vignette'
      },
      {
        id: 'step-4', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 5, saturation: 15, vibrance: 10 },
        label: 'Warm Tones'
      },
      {
        id: 'step-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_polaroid', format: 'image/jpeg', quality: 92 },
        label: 'Export'
      }
    ]
  },

  // ─── 5. Copyrighter ───────────────────────────────────
  {
    id:          'sys-copyrighter',
    name:        'Copyrighter',
    description: 'Stamps a © copyright notice with the image\'s EXIF date (DD-MMM-YYYY) in the bottom-right corner.',
    isSystem:    true,
    coverColor:  '#f472b6',
    tags:        ['copyright', 'text', 'watermark'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'step-1', type: 'transform', transformId: 'overlay-rich-text',
        params: {
          content:   '© {{exif.author | "Owner"}} {{exif.date | date("DD-MMM-YYYY")}}',
          font:      'Inter',
          size:      22,
          color:     '#ffffff',
          opacity:   85,
          anchor:    'bottom-right',
          offsetX:   24,
          offsetY:   24,
          shadow:    true,
          shadowColor: 'rgba(0,0,0,0.7)',
          blendMode: 'source-over',
        },
        label: 'Copyright Stamp'
      },
      {
        id: 'step-2', type: 'transform', transformId: 'flow-export',
        params: { suffix: '', format: 'image/jpeg', quality: 92 },
        label: 'Export'
      }
    ]
  },

  // ─── 6. Black & White Classic ─────────────────────────
  {
    id:          'sys-bw-classic',
    name:        'Black & White Classic',
    description: 'High-contrast desaturated conversion with vignette and light sharpening.',
    isSystem:    true,
    coverColor:  '#374151',
    tags:        ['black and white', 'classic', 'filter'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'step-1', type: 'transform', transformId: 'color-tuning',
        params: { saturation: -100, contrast: 20 },
        label: 'Desaturate + Contrast'
      },
      {
        id: 'step-2', type: 'transform', transformId: 'color-vignette',
        params: { amount: 40, radius: 65 },
        label: 'Vignette'
      },
      {
        id: 'step-3', type: 'transform', transformId: 'filter-advanced',
        params: { sharpenAmount: 20 },
        label: 'Sharpen'
      },
      {
        id: 'step-4', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_bw', format: 'image/jpeg', quality: 90 },
        label: 'Export'
      }
    ]
  },

  // ─── 7. Film Grain ────────────────────────────────────
  {
    id:          'sys-film-grain',
    name:        'Film Grain',
    description: 'Warm tones, film grain noise and vignette for an analogue photography look.',
    isSystem:    true,
    coverColor:  '#92400e',
    tags:        ['film', 'grain', 'vintage', 'filter'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'step-1', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 15, saturation: -10 },
        label: 'Film Tone'
      },
      {
        id: 'step-2', type: 'transform', transformId: 'color-tint',
        params: { color: '#c8a97e', strength: 12, blendMode: 'multiply' },
        label: 'Warm Tint'
      },
      {
        id: 'step-3', type: 'transform', transformId: 'filter-advanced',
        params: { noiseLevel: 18 },
        label: 'Film Grain'
      },
      {
        id: 'step-4', type: 'transform', transformId: 'color-vignette',
        params: { amount: 35, radius: 60 },
        label: 'Vignette'
      },
      {
        id: 'step-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_film', format: 'image/jpeg', quality: 90 },
        label: 'Export'
      }
    ]
  },

  // ─── 8. Social Ready ──────────────────────────────────
  {
    id:          'sys-social-ready',
    name:        'Social Ready',
    description: 'Square-crop for social media, subtle tuning, strip metadata, export as high-quality WebP.',
    isSystem:    true,
    coverColor:  '#0ea5e9',
    tags:        ['social', 'instagram', 'square', 'webp'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'step-1', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Attention' },
        label: 'Square Crop'
      },
      {
        id: 'step-2', type: 'transform', transformId: 'geo-resize',
        params: { width: '1080', maintainAspect: true },
        label: 'Resize to 1080px'
      },
      {
        id: 'step-3', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 8, saturation: 12, vibrance: 8 },
        label: 'Pop Tuning'
      },
      {
        id: 'step-4', type: 'transform', transformId: 'meta-strip',
        params: { level: 'GPS Only' },
        label: 'Strip GPS'
      },
      {
        id: 'step-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_social', format: 'image/webp', quality: 90 },
        label: 'Export WebP'
      }
    ]
  }
,

  // ─── 9. Pop Art Warhol ───────────────────────────────────
  {
    id:          'sys-popart-warhol',
    name:        'Pop Art Warhol',
    description: 'Transform a portrait into a 4-panel Andy Warhol-style silkscreen with four bold duotone colour schemes assembled into a 2×2 grid.',
    isSystem:    true,
    coverColor:  '#c8005c',
    tags:        ['creative', 'popart', 'warhol', 'duotone', 'grid'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      // ── Prepare base panel ──
      { id: 'warhol-crop',     type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'warhol-resize',   type: 'transform', transformId: 'geo-resize',
        params: { width: '1000', height: '', maintainAspect: true }, label: 'Resize to 1000px Panel' },
      // ── Tonal base ──
      { id: 'warhol-contrast', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 35, saturation: -20 }, label: 'Boost Contrast' },
      { id: 'warhol-post',     type: 'transform', transformId: 'color-posterize',
        params: { levels: 4 }, label: 'Posterize' },
      { id: 'warhol-base',     type: 'transform', transformId: 'flow-save',
        params: { label: 'warhol-base' }, label: 'Save Base State' },
      // ── Panel 1: Hot Pink ──
      { id: 'warhol-l1', type: 'transform', transformId: 'flow-load',     params: { label: 'warhol-base' }, label: 'Load Base' },
      { id: 'warhol-d1', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#c8005c', lightColor: '#ffb3d4' }, label: 'Panel 1: Hot Pink' },
      { id: 'warhol-s1', type: 'transform', transformId: 'flow-save',     params: { label: 'panel-1' }, label: 'Save Panel 1' },
      // ── Panel 2: Teal ──
      { id: 'warhol-l2', type: 'transform', transformId: 'flow-load',     params: { label: 'warhol-base' }, label: 'Load Base' },
      { id: 'warhol-d2', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#006666', lightColor: '#b3ffff' }, label: 'Panel 2: Teal' },
      { id: 'warhol-s2', type: 'transform', transformId: 'flow-save',     params: { label: 'panel-2' }, label: 'Save Panel 2' },
      // ── Panel 3: Orange ──
      { id: 'warhol-l3', type: 'transform', transformId: 'flow-load',     params: { label: 'warhol-base' }, label: 'Load Base' },
      { id: 'warhol-d3', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#c84b00', lightColor: '#ffd4b3' }, label: 'Panel 3: Orange' },
      { id: 'warhol-s3', type: 'transform', transformId: 'flow-save',     params: { label: 'panel-3' }, label: 'Save Panel 3' },
      // ── Panel 4: Purple ──
      { id: 'warhol-l4', type: 'transform', transformId: 'flow-load',     params: { label: 'warhol-base' }, label: 'Load Base' },
      { id: 'warhol-d4', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#3300aa', lightColor: '#ffccff' }, label: 'Panel 4: Purple' },
      { id: 'warhol-s4', type: 'transform', transformId: 'flow-save',     params: { label: 'panel-4' }, label: 'Save Panel 4' },
      // ── Assemble & export ──
      { id: 'warhol-grid',   type: 'transform', transformId: 'flow-compose-grid',
        params: { panels: 'panel-1,panel-2,panel-3,panel-4', columns: 2, gap: 8, bgColor: '#000000' },
        label: 'Assemble 2×2 Grid' },
      { id: 'warhol-export', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_warhol', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ─── 10. Pop Art Warhol — Halftone ───────────────────────
  {
    id:          'sys-popart-warhol-halftone',
    name:        'Pop Art Warhol — Halftone',
    description: 'Warhol-style 2×2 silkscreen grid with a halftone dot overlay on each panel for a vintage print look.',
    isSystem:    true,
    coverColor:  '#c8005c',
    tags:        ['creative', 'popart', 'warhol', 'halftone', 'duotone', 'grid'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      // ── Prepare base panel ──
      { id: 'wht-crop',     type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'wht-resize',   type: 'transform', transformId: 'geo-resize',
        params: { width: '1000', height: '', maintainAspect: true }, label: 'Resize to 1000px Panel' },
      { id: 'wht-contrast', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 35, saturation: -20 }, label: 'Boost Contrast' },
      { id: 'wht-post',     type: 'transform', transformId: 'color-posterize',
        params: { levels: 4 }, label: 'Posterize' },
      { id: 'wht-base',     type: 'transform', transformId: 'flow-save',
        params: { label: 'wht-base' }, label: 'Save Base State' },
      // ── Panel 1: Hot Pink + Halftone ──
      { id: 'wht-l1', type: 'transform', transformId: 'flow-load',     params: { label: 'wht-base' }, label: 'Load Base' },
      { id: 'wht-d1', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#c8005c', lightColor: '#ffb3d4' }, label: 'Duotone: Hot Pink' },
      { id: 'wht-h1', type: 'transform', transformId: 'filter-halftone', params: { dotSpacing: 10, dotColor: '#000000', opacity: 35 }, label: 'Halftone' },
      { id: 'wht-s1', type: 'transform', transformId: 'flow-save',     params: { label: 'wht-panel-1' }, label: 'Save Panel 1' },
      // ── Panel 2: Teal + Halftone ──
      { id: 'wht-l2', type: 'transform', transformId: 'flow-load',     params: { label: 'wht-base' }, label: 'Load Base' },
      { id: 'wht-d2', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#006666', lightColor: '#b3ffff' }, label: 'Duotone: Teal' },
      { id: 'wht-h2', type: 'transform', transformId: 'filter-halftone', params: { dotSpacing: 10, dotColor: '#000000', opacity: 35 }, label: 'Halftone' },
      { id: 'wht-s2', type: 'transform', transformId: 'flow-save',     params: { label: 'wht-panel-2' }, label: 'Save Panel 2' },
      // ── Panel 3: Orange + Halftone ──
      { id: 'wht-l3', type: 'transform', transformId: 'flow-load',     params: { label: 'wht-base' }, label: 'Load Base' },
      { id: 'wht-d3', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#c84b00', lightColor: '#ffd4b3' }, label: 'Duotone: Orange' },
      { id: 'wht-h3', type: 'transform', transformId: 'filter-halftone', params: { dotSpacing: 10, dotColor: '#000000', opacity: 35 }, label: 'Halftone' },
      { id: 'wht-s3', type: 'transform', transformId: 'flow-save',     params: { label: 'wht-panel-3' }, label: 'Save Panel 3' },
      // ── Panel 4: Purple + Halftone ──
      { id: 'wht-l4', type: 'transform', transformId: 'flow-load',     params: { label: 'wht-base' }, label: 'Load Base' },
      { id: 'wht-d4', type: 'transform', transformId: 'color-duotone', params: { darkColor: '#3300aa', lightColor: '#ffccff' }, label: 'Duotone: Purple' },
      { id: 'wht-h4', type: 'transform', transformId: 'filter-halftone', params: { dotSpacing: 10, dotColor: '#000000', opacity: 35 }, label: 'Halftone' },
      { id: 'wht-s4', type: 'transform', transformId: 'flow-save',     params: { label: 'wht-panel-4' }, label: 'Save Panel 4' },
      // ── Assemble & export ──
      { id: 'wht-grid',   type: 'transform', transformId: 'flow-compose-grid',
        params: { panels: 'wht-panel-1,wht-panel-2,wht-panel-3,wht-panel-4', columns: 2, gap: 8, bgColor: '#000000' },
        label: 'Assemble 2×2 Grid' },
      { id: 'wht-export', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_warhol_halftone', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Blueprint ─────────────────────────────────────────────
  {
    id: 'sys-blueprint', name: 'Blueprint',
    description: 'Technical drawing effect — Sobel edge detection with Blueprint Blue duotone and a faint engineering grid overlay.',
    isSystem: true, coverColor: '#003366',
    tags: ['creative', 'blueprint', 'edges', 'technical'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'bp-1', type: 'transform', transformId: 'color-tuning',
        params: { saturation: -100 }, label: 'Grayscale' },
      { id: 'bp-2', type: 'transform', transformId: 'filter-edge-detect',
        params: { threshold: 15, softEdges: false, blurBefore: 0 }, label: 'Sobel Edge Detect' },
      { id: 'bp-3', type: 'transform', transformId: 'color-duotone',
        params: { darkColor: '#003366', lightColor: '#ffffff' }, label: 'Blueprint Colourize' },
      { id: 'bp-4', type: 'transform', transformId: 'overlay-grid',
        params: { spacing: 50, color: '#ffffff', opacity: 50, lineWidth: 1 }, label: 'Engineering Grid' },
      { id: 'bp-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_blueprint', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Cyberpunk / Neon Night ────────────────────────────────
  {
    id: 'sys-cyberpunk', name: 'Cyberpunk / Neon Night',
    description: 'Vivid neon duotone with bloom glow, chromatic aberration and crushed contrast for a cyberpunk aesthetic.',
    isSystem: true, coverColor: '#0d0033',
    tags: ['creative', 'cyberpunk', 'neon', 'glow', 'cinematic'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'cp-1', type: 'transform', transformId: 'color-duotone',
        params: { darkColor: '#0d0033', lightColor: '#ff00cc' }, label: 'Neon Duotone' },
      { id: 'cp-2', type: 'transform', transformId: 'filter-bloom',
        params: { threshold: 75, blurRadius: 20, strength: 70 }, label: 'Neon Glow' },
      { id: 'cp-3', type: 'transform', transformId: 'filter-chromatic-aberration',
        params: { offset: 8, direction: 'horizontal' }, label: 'Chromatic Aberration' },
      { id: 'cp-4', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 70 }, label: 'Crush Contrast' },
      { id: 'cp-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_cyberpunk', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Classic Analog Film 1970s ──────────────────────────────
  {
    id: 'sys-analog-film', name: 'Classic Analog Film',
    description: '1970s analog film look — warm colour grade with grain, vignette and an orange light leak.',
    isSystem: true, coverColor: '#4a2800',
    tags: ['creative', 'film', 'analog', 'vintage', '1970s'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'af-1', type: 'transform', transformId: 'filter-color-grade',
        params: { lift: 18, shadowColor: '#1a5f5f', shadowStrength: 40, highlightColor: '#f5e842', highlightStrength: 30 }, label: 'Film Colour Grade' },
      { id: 'af-2', type: 'transform', transformId: 'filter-advanced',
        params: { noiseLevel: 15 }, label: 'Film Grain' },
      { id: 'af-3', type: 'transform', transformId: 'color-vignette',
        params: { amount: 45, radius: 60 }, label: 'Vignette' },
      { id: 'af-4', type: 'transform', transformId: 'overlay-light-leak',
        params: { edge: 'right', color: '#ff6600', opacity: 35, spread: 65, blendMode: 'screen' }, label: 'Light Leak' },
      { id: 'af-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_analog', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Impressionist Oil Painting ─────────────────────────────
  {
    id: 'sys-oil-painting', name: 'Impressionist Oil Painting',
    description: 'Painterly effect — Kuwahara filter for oil-paint smoothing, edge overlay, canvas texture and rich colours.',
    isSystem: true, coverColor: '#3d1a00',
    tags: ['creative', 'painting', 'impressionist', 'art', 'oil'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'op-1', type: 'transform', transformId: 'filter-kuwahara',
        params: { radius: 3, passes: 1 }, label: 'Oil Paint Smooth' },
      { id: 'op-2', type: 'transform', transformId: 'filter-edge-detect',
        params: { threshold: 8, softEdges: true, blurBefore: 1, blendMode: 'darken', edgeStrength: 35 }, label: 'Paint Edges' },
      { id: 'op-3', type: 'transform', transformId: 'overlay-canvas-texture',
        params: { intensity: 18, scale: 4, blendMode: 'overlay' }, label: 'Canvas Texture' },
      { id: 'op-4', type: 'transform', transformId: 'color-tuning',
        params: { saturation: 40, vibrance: 25 }, label: 'Rich Colours' },
      { id: 'op-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_oilpaint', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Film Noir ─────────────────────────────────────────────
  {
    id: 'sys-film-noir', name: 'Film Noir',
    description: 'Classic black-and-white film look — punchy contrast, grain, and deep vignette.',
    isSystem: true, coverColor: '#111111',
    tags: ['creative', 'noir', 'film', 'black-and-white', 'moody'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'fn-1', type: 'transform', transformId: 'color-tuning',
        params: { saturation: -100, contrast: 60 }, label: 'Grayscale + Punch' },
      { id: 'fn-2', type: 'transform', transformId: 'filter-advanced',
        params: { noiseLevel: 12 }, label: 'Film Grain' },
      { id: 'fn-3', type: 'transform', transformId: 'color-vignette',
        params: { amount: 60, radius: 50 }, label: 'Heavy Vignette' },
      { id: 'fn-4', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_noir', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Retrowave / Synthwave ─────────────────────────────────
  {
    id: 'sys-retrowave', name: 'Retrowave',
    description: 'Sunset duotone with a neon grid, chromatic fringe and bloom glow — 80s synthwave aesthetic.',
    isSystem: true, coverColor: '#1a0033',
    tags: ['creative', 'retrowave', 'synthwave', 'neon', '80s'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'rw-1', type: 'transform', transformId: 'color-duotone',
        params: { darkColor: '#1a0033', lightColor: '#ff6b35' }, label: 'Retrowave Colours' },
      { id: 'rw-2', type: 'transform', transformId: 'overlay-grid',
        params: { spacing: 40, color: '#ff00ff', opacity: 30, lineWidth: 1 }, label: 'Neon Grid' },
      { id: 'rw-3', type: 'transform', transformId: 'filter-chromatic-aberration',
        params: { offset: 5, direction: 'horizontal' }, label: 'Fringe' },
      { id: 'rw-4', type: 'transform', transformId: 'filter-bloom',
        params: { threshold: 70, blurRadius: 15, strength: 60 }, label: 'Glow' },
      { id: 'rw-5', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 40 }, label: 'Punch' },
      { id: 'rw-6', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_retrowave', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Lomo Camera ───────────────────────────────────────────
  {
    id: 'sys-lomo', name: 'Lomo Camera',
    description: 'Saturated, gritty lomo look — vivid colours, cool shadows, heavy vignette and a golden light leak.',
    isSystem: true, coverColor: '#1a0d00',
    tags: ['creative', 'lomo', 'film', 'vintage', 'analog'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'lo-1', type: 'transform', transformId: 'color-tuning',
        params: { saturation: 50, vibrance: 30 }, label: 'Vivid Colours' },
      { id: 'lo-2', type: 'transform', transformId: 'filter-color-grade',
        params: { lift: 0, shadowColor: '#0a2240', shadowStrength: 20, highlightColor: '#ffffff', highlightStrength: 0 }, label: 'Cool Shadows' },
      { id: 'lo-3', type: 'transform', transformId: 'color-vignette',
        params: { amount: 55, radius: 55 }, label: 'Lomo Vignette' },
      { id: 'lo-4', type: 'transform', transformId: 'filter-advanced',
        params: { noiseLevel: 10 }, label: 'Grain' },
      { id: 'lo-5', type: 'transform', transformId: 'overlay-light-leak',
        params: { edge: 'top', color: '#ffaa00', opacity: 25, spread: 50, blendMode: 'screen' }, label: 'Light Leak' },
      { id: 'lo-6', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_lomo', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Faded Matte ───────────────────────────────────────────
  {
    id: 'sys-faded-matte', name: 'Faded Matte',
    description: 'Clean faded-film matte — lifted blacks, split-tone teal/cream and a barely-there vignette.',
    isSystem: true, coverColor: '#c8b89a',
    tags: ['creative', 'matte', 'faded', 'portrait', 'minimal'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'fm-1', type: 'transform', transformId: 'filter-color-grade',
        params: { lift: 22, shadowColor: '#1a3040', shadowStrength: 15, highlightColor: '#fff5e0', highlightStrength: 20 }, label: 'Faded Tones' },
      { id: 'fm-2', type: 'transform', transformId: 'color-tuning',
        params: { saturation: -20 }, label: 'Desaturate' },
      { id: 'fm-3', type: 'transform', transformId: 'color-vignette',
        params: { amount: 20, radius: 70 }, label: 'Subtle Vignette' },
      { id: 'fm-4', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_matte', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Tilt-Shift Miniature ──────────────────────────────────
  {
    id: 'sys-tilt-shift', name: 'Tilt-Shift Miniature',
    description: 'Makes scenes look like tiny scale models — sharp horizontal band with blurred top and bottom.',
    isSystem: true, coverColor: '#2a5f2a',
    tags: ['creative', 'tilt-shift', 'miniature', 'landscape', 'blur'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'ts-1', type: 'transform', transformId: 'filter-tilt-shift',
        params: { centerY: 50, bandWidth: 25, blurAmount: 12, feather: 30 }, label: 'Miniature Blur' },
      { id: 'ts-2', type: 'transform', transformId: 'color-tuning',
        params: { saturation: 30, contrast: 20 }, label: 'Vivid & Punchy' },
      { id: 'ts-3', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_miniature', format: 'image/jpeg', quality: 92 }, label: 'Export' }
    ]
  },

  // ── Photo Stack Animation ─────────────────────────────────
  {
    id: 'sys-photo-stack', name: 'Photo Stack Animation',
    description: 'Polaroid-framed animated stack — each photo gets a white border and handwritten caption, then appears on a desk one by one. Outputs GIF or MP4.',
    isSystem: true, isOrdered: true, coverColor: '#3d2b1a',
    tags: ['animation', 'polaroid', 'stack', 'gif', 'video', 'creative'],
    createdAt: 0, updatedAt: 0,
    params: [
      { name: 'format',      label: 'Output Format',     type: 'select',
        options: [{ label: 'Animated GIF', value: 'gif' }, { label: 'MP4 Video', value: 'mp4' }],
        defaultValue: 'gif' },
      { name: 'width',       label: 'Canvas Width (px)',  type: 'number', min: 320, defaultValue: 1920 },
      { name: 'height',      label: 'Canvas Height (px)', type: 'number', min: 240, defaultValue: 1080 },
      { name: 'overlap',     label: 'Overlap %',          type: 'range',  min: 0, max: 90, defaultValue: 0 },
      { name: 'maxRotation', label: 'Max Rotation (°)',   type: 'range',  min: 0, max: 45, defaultValue: 35 },
      { name: 'frameDelay',  label: 'Frame Delay (ms)',   type: 'number', defaultValue: 800 },
    ],
    nodes: [
      { id: 'psa-1', type: 'transform', transformId: 'overlay-polaroid-frame',
        params: { borderColor: '#f5f5f0', borderSide: 20, borderBottom: 60, caption: '{{filename | sanitized}}' },
        label: 'Polaroid Frame' },
      { id: 'psa-2', type: 'transform', transformId: 'flow-animate-stack',
        params: { filename: 'photo-stack', format: 'gif', width: 1920, height: 1080,
                  deskColor: '#3d2b1a', frameDelay: 800, maxRotation: 35, overlap: 0 },
        label: 'Animate Stack' },
    ]
  },

  // ── Face Morph ───────────────────────────────────────────
  {
    id: 'sys-face-morph', name: 'Face Morph',
    description: 'Creates a smooth 4-second video morph between two faces using 478-point mesh warping. Requires exactly 2 input images.',
    isSystem: true, coverColor: '#ec4899',
    tags: ['face', 'morph', 'animation', 'video', 'creative'],
    createdAt: 0, updatedAt: 0,
    minItems: 2, maxItems: 2,
    nodes: [
      { id: 'fm-1', type: 'transform', transformId: 'geo-face-align',
        params: { standardizeEyes: true },
        label: 'Align Faces' },
      { id: 'fm-2', type: 'transform', transformId: 'flow-face-morph',
        params: { filename: 'face-morph.mp4', duration: 4, fps: 30 },
        label: 'Morph Video' }
    ]
  },

  // ── Aerochrome (Infrared Film) ────────────────────────────
  {
    id: 'sys-aerochrome', name: 'Aerochrome (Infrared)',
    description: 'Simulates Kodak Aerochrome infrared film — foliage turns vivid pink/red, skies stay deep blue.',
    isSystem: true, coverColor: '#c0392b',
    tags: ['film', 'infrared', 'aerochrome', 'creative', 'color'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'ac-1', type: 'transform', transformId: 'color-channel-swap',
        params: { redSource: 'G', greenSource: 'R', blueSource: 'B' },
        label: 'Swap R↔G (Infrared)' },
      { id: 'ac-2', type: 'transform', transformId: 'color-tuning',
        params: { saturation: 60, contrast: 20 },
        label: 'Boost Saturation & Contrast' },
      { id: 'ac-3', type: 'transform', transformId: 'filter-bloom',
        params: { threshold: 63, blurRadius: 8, strength: 40 },
        label: 'Halation Bloom' },
      { id: 'ac-4', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_aerochrome', format: 'image/jpeg', quality: 92 },
        label: 'Export JPEG' },
    ]
  },

  // ── Video Frame GIF ──────────────────────────────────────
  {
    id: 'sys-video-frame-gif', name: 'Video Frame GIF',
    description: 'Extract 5 still frames from a video (0%, 25%, 50%, 75%, 100%) and assemble them into an animated GIF thumbnail.',
    isSystem: true, coverColor: '#0891b2',
    tags: ['video', 'gif', 'thumbnail', 'frames', 'preview'],
    createdAt: 0, updatedAt: 0,
    minItems: 1, maxItems: 1,
    inputType: 'video',
    nodes: [
      // ── Frame 1: first frame (0%) ──
      { id: 'vfg-e1', type: 'transform', transformId: 'video-extract-frame',
        params: { atPercent: 0 }, label: 'Extract Frame 0%' },
      { id: 'vfg-c1', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'vfg-r1', type: 'transform', transformId: 'geo-resize',
        params: { width: '360', height: '', maintainAspect: true }, label: 'Resize 360px' },
      { id: 'vfg-s1', type: 'transform', transformId: 'flow-save',
        params: { label: 'frame-0' }, label: 'Save Frame 0%' },

      // ── Frame 2: 25% ──
      { id: 'vfg-e2', type: 'transform', transformId: 'video-extract-frame',
        params: { atPercent: 25 }, label: 'Extract Frame 25%' },
      { id: 'vfg-c2', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'vfg-r2', type: 'transform', transformId: 'geo-resize',
        params: { width: '360', height: '', maintainAspect: true }, label: 'Resize 360px' },
      { id: 'vfg-s2', type: 'transform', transformId: 'flow-save',
        params: { label: 'frame-25' }, label: 'Save Frame 25%' },

      // ── Frame 3: 50% ──
      { id: 'vfg-e3', type: 'transform', transformId: 'video-extract-frame',
        params: { atPercent: 50 }, label: 'Extract Frame 50%' },
      { id: 'vfg-c3', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'vfg-r3', type: 'transform', transformId: 'geo-resize',
        params: { width: '360', height: '', maintainAspect: true }, label: 'Resize 360px' },
      { id: 'vfg-s3', type: 'transform', transformId: 'flow-save',
        params: { label: 'frame-50' }, label: 'Save Frame 50%' },

      // ── Frame 4: 75% ──
      { id: 'vfg-e4', type: 'transform', transformId: 'video-extract-frame',
        params: { atPercent: 75 }, label: 'Extract Frame 75%' },
      { id: 'vfg-c4', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'vfg-r4', type: 'transform', transformId: 'geo-resize',
        params: { width: '360', height: '', maintainAspect: true }, label: 'Resize 360px' },
      { id: 'vfg-s4', type: 'transform', transformId: 'flow-save',
        params: { label: 'frame-75' }, label: 'Save Frame 75%' },

      // ── Frame 5: last frame (100%) ──
      { id: 'vfg-e5', type: 'transform', transformId: 'video-extract-frame',
        params: { atPercent: 100 }, label: 'Extract Frame 100%' },
      { id: 'vfg-c5', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '1:1', strategy: 'Entropy' }, label: 'Square Crop' },
      { id: 'vfg-r5', type: 'transform', transformId: 'geo-resize',
        params: { width: '360', height: '', maintainAspect: true }, label: 'Resize 360px' },
      { id: 'vfg-s5', type: 'transform', transformId: 'flow-save',
        params: { label: 'frame-100' }, label: 'Save Frame 100%' },

      // ── Assemble animated GIF ──
      { id: 'vfg-gif', type: 'transform', transformId: 'flow-gif-from-states',
        params: {
          panels: 'frame-0,frame-25,frame-50,frame-75,frame-100',
          delay:  500,
          loop:   true,
          suffix: '_preview',
        }, label: 'Assemble GIF' },
    ]
  },

  // ── Video Wall ────────────────────────────────────────────
  {
    id: 'sys-video-wall', name: 'Video Wall',
    description: 'Composite multiple video files into a single MP4 grid — security-camera wall style. Select your layout, set captions, and choose what to show when shorter clips end.',
    isSystem: true, coverColor: '#0f172a',
    tags: ['video', 'grid', 'composite', 'security', 'wall'],
    createdAt: 0, updatedAt: 0,
    minItems: 4, maxItems: 4,
    inputType: 'video',
    nodes: [
      {
        id: 'vw-1', type: 'transform', transformId: 'flow-video-wall',
        params: {
          filename:         'video-wall.mp4',
          layout:           'grid-2x2',
          outputWidth:      1920,
          outputHeight:     1080,
          fps:              30,
          bitrate:          8000000,
          endOfVideo:       'text',
          endText:          'No Signal Detected',
          fallbackImageUrl: '',
          captions:         'Camera 1,Camera 2,Camera 3,Camera 4',
        },
        label: 'Video Wall'
      }
    ]
  },

  // ── TV Room (perspective) ────────────────────────────────
  {
    id: 'sys-video-tv', name: 'TV Room',
    description: 'Place a single video onto a perspective TV screen in a darkened room. The bezel, stand, and ambient glow are drawn programmatically — no background image required.',
    isSystem: true, coverColor: '#1c1c2e',
    tags: ['video', 'tv', 'perspective', 'room', 'cinematic'],
    createdAt: 0, updatedAt: 0,
    minItems: 1, maxItems: 1,
    inputType: 'video',
    nodes: [
      {
        id: 'vt-1', type: 'transform', transformId: 'flow-video-wall',
        params: {
          filename:         'tv-room.mp4',
          layout:           'custom-tv',
          outputWidth:      1920,
          outputHeight:     1080,
          fps:              30,
          bitrate:          10000000,
          endOfVideo:       'black',
          endText:          '',
          fallbackImageUrl: '',
          captions:         '',
        },
        label: 'TV Room'
      }
    ]
  },

  // ── Digital Glitch ────────────────────────────────────────
  {
    id: 'sys-glitch', name: 'Digital Glitch',
    description: 'Chromatic aberration, pixel sorting, and CRT scanlines — lo-fi data-corruption aesthetic.',
    isSystem: true, coverColor: '#7c3aed',
    tags: ['glitch', 'digital', 'vaporwave', 'creative', 'crt'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'gl-1', type: 'transform', transformId: 'filter-chromatic-aberration',
        params: { offset: 4, direction: 'horizontal' },
        label: 'Chromatic Aberration' },
      { id: 'gl-2', type: 'transform', transformId: 'filter-pixel-sort',
        params: { threshold: 80, direction: 'light-to-dark', stripHeight: 1 },
        label: 'Pixel Sort' },
      { id: 'gl-3', type: 'transform', transformId: 'overlay-scanlines',
        params: { spacing: 3, opacity: 20, color: '#000000' },
        label: 'Scanlines' },
      { id: 'gl-4', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_glitch', format: 'image/jpeg', quality: 90 },
        label: 'Export JPEG' },
    ]
  },

  // ── Retro 8-Bit / Dithered ────────────────────────────────
  {
    id: 'sys-8bit', name: 'Retro 8-Bit',
    description: 'Pixelate with nearest-neighbour and dither to a CGA palette — classic 8-bit game aesthetic.',
    isSystem: true, coverColor: '#065f46',
    tags: ['8-bit', 'pixel art', 'retro', 'dither', 'creative', 'cga'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: '8b-1', type: 'transform', transformId: 'geo-pixelate',
        params: { blockSize: 6 },
        label: 'Pixelate' },
      { id: '8b-2', type: 'transform', transformId: 'filter-dither',
        params: { palette: 'cga', dithering: true },
        label: 'CGA Dither' },
      { id: '8b-3', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_8bit', format: 'image/png', quality: 100 },
        label: 'Export PNG' },
    ]
  },

  // ── 39. Comic Book Cell ────────────────────────────────
  {
    id: 'sys-comic-book', name: 'Comic Book Cell',
    description: 'Converts a photograph into a cel-shaded comic book panel with heavy ink outlines and halftone print textures.',
    isSystem: true, coverColor: '#eab308',
    inputType: 'image',
    tags: ['comic', 'graphic novel', 'cel shading', 'halftone', 'creative'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'cb-1', type: 'transform', transformId: 'color-tuning',
        params: { saturation: 40, contrast: 30, vibrance: 20 },
        label: 'Color Pop' },
      { id: 'cb-2', type: 'transform', transformId: 'filter-kuwahara',
        params: { radius: 4, passes: 2 },
        label: 'Paint Flattening' },
      { id: 'cb-3', type: 'transform', transformId: 'color-posterize',
        params: { levels: 4 },
        label: 'Cel Shading' },
      { id: 'cb-4', type: 'transform', transformId: 'filter-edge-detect',
        params: { blendMode: 'darken', edgeStrength: 75, threshold: 15 },
        label: 'Ink Outlines' },
      { id: 'cb-5', type: 'transform', transformId: 'filter-halftone',
        params: { dotSpacing: 4, opacity: 30, blendMode: 'multiply' },
        label: 'Print Texture' },
      { id: 'cb-6', type: 'transform', transformId: 'geo-padding',
        params: { top: 15, right: 15, bottom: 15, left: 15, color: '#000000' },
        label: 'Black Frame' },
      { id: 'cb-7', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_comic', format: 'image/jpeg', quality: 95 },
        label: 'Export JPEG' },
    ]
  },
  // ── 40. Geotemporal Timeline ─────────────────────────────
  {
    id: 'sys-geo-timeline', name: 'Geotemporal Timeline',
    description: 'Generates a split-screen video timeline that physically charts your GPS coordinates across a rolling map on one side, while crossfading through your historical photos on the other.',
    isSystem: true, coverColor: '#1e40af',
    inputType: 'image',
    tags: ['video', 'map', 'travel', 'timeline', 'gallery'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'geo-1', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '9:16', strategy: 'Attention' },
        label: 'Portrait Crop' },
      { id: 'geo-2', type: 'transform', transformId: 'meta-geocode',
        params: { template: '{city}, {country}', targetField: 'location' },
        label: 'Reverse Geocode' },
      { id: 'geo-3', type: 'transform', transformId: 'flow-geo-timeline',
        params: { width: 1920, height: 1080, fps: 30, durationPerPhoto: 3.5, transitionDuration: 1.0, filename: 'trip-timeline.mp4' },
        label: 'Build Map Videocast' }
    ]
  },
  // ── 41. Machina Face Swap ──────────────────────────────
  {
    id: 'sys-machina-swap', name: 'Machina-Swap',
    description: 'Natively swap faces across multiple portraits using 478-point mesh warping. Drop 2 photos to cross-swap both ways, or drop 3+ photos to paste the first face onto everyone else!',
    isSystem: true, isOrdered: true, coverColor: '#ec4899',
    inputType: 'image',
    tags: ['ai', 'creative', 'fun', 'swap', 'faces'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'swap-1', type: 'transform', transformId: 'flow-face-swap',
        params: { suffix: '_machinaswap', quality: 95 },
        label: 'Mesh Interlock' }
    ]
  },
  // ── 42. Talking Head PiP ──────────────────────────────────
  {
    id: 'sys-talking-head-pip', name: 'Talking Head PiP',
    description: 'Composites two videos: the first plays fullscreen as the background, the second is cropped circular and inset as a picture-in-picture talking head in the bottom-right corner.',
    isSystem: true, isOrdered: true, coverColor: '#7c3aed',
    inputType: 'video',
    tags: ['video', 'picture-in-picture', 'talking head', 'composite', 'circular'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'pip-cond', type: 'conditional',
        condition: { field: 'fileIndex', operator: 'gte', value: 1 },
        thenNodes: [
          {
            id: 'pip-resize', type: 'transform', transformId: 'geo-resize',
            params: { width: '', height: '540', maintainAspect: true },
            label: 'Resize Talking Head'
          },
          {
            id: 'pip-crop', type: 'transform', transformId: 'geo-smart-crop',
            params: { aspectRatio: '1:1', strategy: 'Attention' },
            label: 'Square Crop'
          },
          {
            id: 'pip-round', type: 'transform', transformId: 'geo-round',
            params: { radius: '50%', circular: true },
            label: 'Make Circular'
          },
        ],
        elseNodes: [],
      },
      {
        id: 'pip-wall', type: 'transform', transformId: 'flow-video-wall',
        params: {
          layout: 'pip-corner-br',
          fps: 30,
          outputWidth: 1920,
          outputHeight: 1080,
          bitrate: 8000000,
          endOfVideo: 'black',
          filename: 'talking-head-pip.mp4',
        },
        label: 'Composite PiP'
      }
    ]
  },

  // ── 43. Graphic Novel ─────────────────────────────────────
  {
    id: 'sys-graphic-novel', name: 'Graphic Novel',
    description: 'Turns a photo into a bold graphic-novel illustration — flat posterised colour, painterly smoothing, and crisp ink-line edges.',
    isSystem: true, coverColor: '#1e1b4b',
    inputType: 'image',
    tags: ['creative', 'comic', 'illustration', 'artistic', 'effect'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'gn-1', type: 'transform', transformId: 'filter-kuwahara',
        params: { radius: 2, passes: 1 },
        label: 'Painterly Smooth'
      },
      {
        id: 'gn-2', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 15, saturation: 20, vibrance: 10 },
        label: 'Boost Colour'
      },
      {
        id: 'gn-3', type: 'transform', transformId: 'filter-edge-detect',
        params: { threshold: 30, softEdges: true, blurBefore: 2, blendMode: 'multiply', invertEdges: true, edgeStrength: 65 },
        label: 'Ink Lines'
      },
      {
        id: 'gn-6', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_novel', format: 'image/jpeg', quality: 92 },
        label: 'Export'
      }
    ]
  },

  // ── 44. Graphic Novel — Bold ──────────────────────────────
  {
    id: 'sys-graphic-novel-bold', name: 'Graphic Novel — Bold',
    description: 'A bolder graphic-novel variant with stronger posterisation, heavier ink lines and more vivid colour — closer to a hand-inked comic-book panel.',
    isSystem: true, coverColor: '#312e81',
    inputType: 'image',
    tags: ['creative', 'comic', 'illustration', 'artistic', 'effect', 'bold'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'gnb-1', type: 'transform', transformId: 'filter-kuwahara',
        params: { radius: 2, passes: 2 },
        label: 'Painterly Smooth'
      },
      {
        id: 'gnb-2', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 20, saturation: 30, vibrance: 15 },
        label: 'Boost Colour'
      },
      {
        id: 'gnb-3', type: 'transform', transformId: 'color-posterize',
        params: { levels: 9 },
        label: 'Posterize'
      },
      {
        id: 'gnb-4', type: 'transform', transformId: 'filter-edge-detect',
        params: { threshold: 22, softEdges: true, blurBefore: 1.5, blendMode: 'multiply', invertEdges: true, edgeStrength: 80 },
        label: 'Ink Lines'
      },
      {
        id: 'gnb-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_novel_bold', format: 'image/jpeg', quality: 92 },
        label: 'Export'
      }
    ]
  },

  // ── 45. Vampire GFX ───────────────────────────────────────
  {
    id: 'sys-vampire-gfx', name: 'Vampire GFX',
    description: 'Drains colour from the skin, adds cold purple shadows, icy highlights and a crushing vignette for a cinematic vampire portrait look.',
    isSystem: true, coverColor: '#3b0764',
    inputType: 'image',
    tags: ['creative', 'portrait', 'fantasy', 'horror', 'effect'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'vmp-1', type: 'transform', transformId: 'filter-kuwahara',
        params: { radius: 2, passes: 1 },
        label: 'Smooth Skin'
      },
      {
        id: 'vmp-2', type: 'transform', transformId: 'color-tuning',
        params: { saturation: -92, contrast: 25, vibrance: 0 },
        label: 'Drain Colour'
      },
      {
        id: 'vmp-3', type: 'transform', transformId: 'filter-color-grade',
        params: { lift: 8, shadowColor: '#1a1a2e', shadowStrength: 20, highlightColor: '#f0f4ff', highlightStrength: 40 },
        label: 'Chalk Pallor'
      },
      {
        id: 'vmp-4', type: 'transform', transformId: 'color-vignette',
        params: { amount: 55, radius: 55 },
        label: 'Vignette'
      },
      {
        id: 'vmp-5b', type: 'transform', transformId: 'filter-bloom',
        params: { threshold: 55, blurRadius: 20, strength: 35 },
        label: 'Skin Glow'
      },
      {
        id: 'vmp-5c', type: 'transform', transformId: 'ai-glow-eyes',
        params: { color: '#ff2200', intensity: 88, irisScale: 105, glowSpread: 300, darkPupil: true, confidence: 50 },
        label: 'Glowing Eyes'
      },
    ]
  },

  // ── 46. Background Swap ───────────────────────────────────
  {
    id: 'sys-bg-swap', name: 'Background Swap',
    description: 'Select your SUBJECT (foreground) as image 1 first. Select background scenes as images 2, 3, 4… AI removes image 1\'s background then composites it onto each background scene, producing one output per background.',
    isSystem: true, coverColor: '#065f46',
    inputType: 'image',
    isOrdered: true,
    minItems: 2,
    tags: ['ai', 'composite', 'background', 'portrait', 'creative'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'bgs-1', type: 'conditional',
        label: 'Remove BG (subject only)',
        condition: { field: 'fileIndex', operator: 'eq', value: 0 },
        thenNodes: [
          {
            id: 'bgs-1a', type: 'transform', transformId: 'ai-remove-bg',
            params: { mode: 'Transparent', edgeSmoothing: true },
            label: 'Remove Background'
          }
        ],
        elseNodes: []
      },
      {
        id: 'bgs-2', type: 'transform', transformId: 'flow-bg-swap',
        params: { suffix: '_bgswap', format: 'image/jpeg', quality: 92, scale: 'fit' },
        label: 'Composite onto Background'
      }
    ]
  },

  // ── 47. PM Solutions ID Card ──────────────────────────────
  {
    id: 'sys-pm-solutions-id', name: 'PM Solutions ID Card',
    description: 'Generates a corporate ID card using the PM Solutions template. Crops the input photo, places it in the template hole, and injects name and title from EXIF data.',
    isSystem: true, coverColor: '#991b1b',
    inputType: 'image',
    tags: ['id', 'corporate', 'template', 'overlay'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      { id: 'pm-1', type: 'transform', transformId: 'geo-smart-crop',
        params: { aspectRatio: '3:4', strategy: 'Attention' }, label: 'Portrait Crop' },
      { id: 'pm-2', type: 'transform', transformId: 'geo-resize',
        params: { width: '480', height: '', maintainAspect: true }, label: 'Resize to Hole' },
      { id: 'pm-3', type: 'transform', transformId: 'geo-padding',
        params: { top: '200', bottom: '184', left: '272', right: '272', color: '#ffffff' }, label: 'Canvas Padding' },
      { id: 'pm-4', type: 'transform', transformId: 'overlay-watermark',
        params: { type: 'image', imageUrl: '/pm_solutions_template.png', size: 1024, opacity: 100, angle: 0, repeat: false }, label: 'Add Template Form' },
      { id: 'pm-5', type: 'transform', transformId: 'overlay-rich-text',
        params: { content: '{{exif.Artist}}', font: 'Inter', size: 48, color: '#000000', shadow: false, anchor: 'bottom-center', offsetX: 0, offsetY: 144, weight: '700' }, label: 'Name Slot' },
      { id: 'pm-6', type: 'transform', transformId: 'overlay-rich-text',
        params: { content: '{{exif.Title}}', font: 'Inter', size: 32, color: '#333333', shadow: false, anchor: 'bottom-center', offsetX: 0, offsetY: 84 }, label: 'Title Slot' },
      { id: 'pm-7', type: 'transform', transformId: 'flow-export',
        params: { suffix: '_ID', format: 'image/jpeg', quality: 95 }, label: 'Export ID Card' }
    ]
  },

  // ── 48. Organise by Location ─────────────────────────────
  {
    id: 'sys-organise-by-location', name: 'Organise by Location',
    description: 'Reverse-geocodes GPS coordinates and copies images into Country/City subfolders. Images without GPS go into "No Location". Geocode results are cached — repeat runs skip the API call.',
    isSystem: true, coverColor: '#0f766e',
    inputType: 'image',
    tags: ['organise', 'location', 'gps', 'geocode', 'folder'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'loc-1', type: 'conditional',
        label: 'Has GPS?',
        condition: { field: 'HasGPS' },
        thenNodes: [
          {
            id: 'loc-1a', type: 'transform', transformId: 'meta-geocode',
            params: { template: '{city}, {country}', targetField: 'location' },
            label: 'Reverse Geocode'
          },
          {
            id: 'loc-1b', type: 'transform', transformId: 'flow-export',
            params: {
              subfolder: '{{country}}/{{city}}',
              suffix: '', format: 'image/jpeg', quality: 100
            },
            label: 'Export to Country/City'
          }
        ],
        elseNodes: [
          {
            id: 'loc-1c', type: 'transform', transformId: 'flow-export',
            params: { subfolder: 'No Location', suffix: '', format: 'image/jpeg', quality: 100 },
            label: 'Export to No Location'
          }
        ]
      }
    ]
  },

  // ── 49. Organise by Date ──────────────────────────────────
  {
    id: 'sys-organise-by-date', name: 'Organise by Date',
    description: 'Copies images into date-based subfolders (YYYY/Month/Day) using the EXIF date taken. Images without EXIF dates go into an "Unknown Date" folder.',
    isSystem: true, coverColor: '#0369a1',
    inputType: 'image',
    tags: ['organise', 'date', 'sort', 'exif', 'folder'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'org-1', type: 'conditional',
        label: 'Has EXIF Date?',
        condition: { field: 'exif.date', operator: 'exists' },
        thenNodes: [
          {
            id: 'org-1a', type: 'transform', transformId: 'flow-export',
            params: {
              subfolder: '{{exif.date | date("YYYY")}}/{{exif.date | date("MMMM")}}/{{exif.date | date("D")}}',
              suffix: '',
              format: 'image/jpeg',
              quality: 100
            },
            label: 'Export to Date Folder'
          }
        ],
        elseNodes: [
          {
            id: 'org-1b', type: 'transform', transformId: 'flow-export',
            params: { subfolder: 'Unknown Date', suffix: '', format: 'image/jpeg', quality: 100 },
            label: 'Export to Unknown Date'
          }
        ]
      }
    ]
  },

  // ─── Cinematic Portrait ───────────────────────────────
  // Chains the new saliency-driven transforms (Phase 5) into a single
  // "photo studio" look: subject-aware bokeh + vignette + subtle grade.
  // Requires the InSPyReNet model (#mdl) — if missing, each AI node
  // no-ops with a warning and the image passes through unchanged.
  {
    id:          'sys-cinematic-portrait',
    name:        'Cinematic Portrait',
    description: 'Saliency-driven portrait look: background bokeh, subject vignette, warm subject / cool background grade, and a gentle contrast lift. Requires the InSPyReNet model (#mdl).',
    isSystem:    true,
    coverColor:  '#7c3aed',
    tags:        ['ai', 'portrait', 'cinematic', 'grade'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id: 'cp-1', type: 'transform', transformId: 'ai-portrait-bokeh',
        params: { blurRadius: 18, edgeFeather: 10, falloff: 'graduated' },
        label: 'Portrait Bokeh'
      },
      {
        id: 'cp-2', type: 'transform', transformId: 'ai-selective-grade',
        params: {
          subjectSaturation: 15, subjectTemperature: 15, subjectExposure: 5,
          backgroundSaturation: -25, backgroundTemperature: -10, backgroundExposure: -5,
          edgeFeather: 8
        },
        label: 'Warm Subject / Cool BG'
      },
      {
        id: 'cp-3', type: 'transform', transformId: 'ai-subject-vignette',
        params: { strength: 45, softness: 70, color: '#000000' },
        label: 'Subject Vignette'
      },
      {
        id: 'cp-4', type: 'transform', transformId: 'color-tuning',
        params: { contrast: 15, saturation: 0, vibrance: 0, invert: false },
        label: 'Contrast Lift'
      },
      {
        id: 'cp-5', type: 'transform', transformId: 'flow-export',
        params: { suffix: '-cinematic', format: 'image/jpeg', quality: 92 },
        label: 'Export JPEG 92%'
      }
    ]
  },

  // ── Find Blurry Images ────────────────────────────────────
  {
    id: 'sys-find-blurry', name: 'Find Blurry Images',
    description: 'Scores every image for sharpness and sorts them into two subfolders: "blurry/" for shots that fall below the threshold and "sharp/" for the rest. Adjust the threshold node to taste.',
    isSystem: true, coverColor: '#7c3aed',
    inputType: 'image',
    tags: ['blur', 'sharpness', 'organise', 'quality', 'triage', 'sort'],
    createdAt: 0, updatedAt: 0,
    nodes: [
      {
        id: 'fb-1', type: 'transform', transformId: 'meta-blur-detect',
        params: { sampleSize: 512, sharpThreshold: 60, blurryThreshold: 35 },
        label: 'Score Sharpness'
      },
      {
        id: 'fb-2', type: 'conditional',
        label: 'Blurry? (score < 35)',
        condition: { field: 'meta.sharpnessScore', operator: 'lt', value: 35 },
        thenNodes: [
          {
            id: 'fb-2a', type: 'transform', transformId: 'flow-export',
            params: { subfolder: 'blurry', suffix: '', format: 'image/jpeg', quality: 100 },
            label: 'Export → blurry/'
          }
        ],
        elseNodes: [
          {
            id: 'fb-2b', type: 'transform', transformId: 'flow-export',
            params: { subfolder: 'sharp', suffix: '', format: 'image/jpeg', quality: 100 },
            label: 'Export → sharp/'
          }
        ]
      }
    ]
  },

  // ── Oil Painting Face Swap ────────────────────────────────
  // Drop two images:
  //   [0] modern portrait (face donor)
  //   [1] target painting (e.g. Mona Lisa)
  //
  // Path 1 (Duotone-led pre-styling) didn't deliver — desaturating
  // the source then bolting on a sepia tint produced a flat, pale
  // result against the warm painting. Path 2: gradient-domain
  // seamless cloning ("Poisson") inside the mesh-swap step itself.
  //
  // Poisson cloning replaces the alpha-feather seam used by the
  // standard Machina-Swap recipe. Instead of pasting the warped
  // source onto the target with a soft alpha edge, the warped face
  // contributes only its *gradients* — boundary pixels are anchored
  // to the surrounding painting, and interior pixels are
  // reconstructed to match those boundaries. Effect: the face takes
  // on the painting's local skin tone, varnish hue, and lighting
  // automatically. Implemented in engine/face-swap.js via a
  // Gauss-Seidel / SOR solver over the mask region.
  //
  // Because Poisson handles colour and lighting transfer, we DON'T
  // pre-recolour the source any more — destroying its gradients
  // would actually fight the algorithm. We do leave a light
  // painterly pass on the source (Kuwahara + 1px blur) so the
  // result reads as paint-strokes rather than smooth photographic
  // skin once the colours land in the painting's range.
  {
    id:          'sys-oil-painting-face-swap',
    name:        'Oil Painting Face Swap',
    description: 'Swap a modern face onto a classical painting (e.g. Mona Lisa). Drop two images — the modern portrait first, the painting second. Uses Poisson seamless cloning (gradient-domain blending) so the swapped face automatically adopts the painting\'s skin tone, varnish hue, and lighting — no visible modern-photo seam.',
    isSystem:    true,
    isOrdered:   true,
    coverColor:  '#92400e',
    inputType:   'image',
    tags:        ['portrait', 'painting', 'oil', 'aged', 'face-swap', 'poisson', 'seamless'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      // Light painterly pass on the SOURCE only — gives the warped
      // face brush-stroke texture once Poisson lands its colours in
      // the target's range. Target painting is untouched so its
      // surface and landmarks stay authentic.
      {
        id: 'op-cond', type: 'conditional',
        label: 'Painterly source pass (image 0)',
        condition: { field: 'fileIndex', operator: 'eq', value: 0 },
        thenNodes: [
          { id: 'op-blur', type: 'transform', transformId: 'filter-blur',
            params: { radius: 1 },
            label: 'Sfumato softening' },
          { id: 'op-kuw', type: 'transform', transformId: 'filter-kuwahara',
            params: { radius: 2, passes: 1 },
            label: 'Painterly strokes' }
        ],
        elseNodes: []
      },
      // Aggregator: mesh-warp the source face into the target's
      // landmarks, then blend with mixed-gradient Poisson cloning.
      // Mixed mode preserves strong features from BOTH images: the
      // swapped face keeps its eyes / nose / cheek shading, and the
      // target painting keeps its lip line, jaw shadow, and any
      // strong edges where source happens to be smooth — fixing the
      // faint colour-cast streaks pure Poisson left at the boundary.
      {
        id: 'op-swap', type: 'transform', transformId: 'flow-face-swap',
        params: { suffix: '_oilswap', quality: 95, blendMode: 'poisson-mixed' },
        label: 'Face swap (mixed-gradient Poisson)'
      }
    ]
  }
];

