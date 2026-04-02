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
    description: 'Create three size variants — Full (1920px), Medium (800px), Thumb (400px) — as JPEGs.',
    isSystem:    true,
    coverColor:  '#8b5cf6',
    tags:        ['thumbnails', 'variants', 'resize'],
    createdAt:   0,
    updatedAt:   0,
    nodes: [
      {
        id:   'branch-1', type: 'branch',
        label: 'Size Variants',
        branches: [
          {
            id: 'variant-full', label: 'Full',
            nodes: [
              { id: 'f-resize', type: 'transform', transformId: 'geo-resize', params: { width: '1920', maintainAspect: true } },
              { id: 'f-export', type: 'transform', transformId: 'flow-export', params: { suffix: '_full', format: 'image/jpeg', quality: 92 } }
            ]
          },
          {
            id: 'variant-med', label: 'Medium',
            nodes: [
              { id: 'm-resize', type: 'transform', transformId: 'geo-resize', params: { width: '800', maintainAspect: true } },
              { id: 'm-export', type: 'transform', transformId: 'flow-export', params: { suffix: '_med', format: 'image/jpeg', quality: 85 } }
            ]
          },
          {
            id: 'variant-thumb', label: 'Thumb',
            nodes: [
              { id: 't-resize', type: 'transform', transformId: 'geo-resize', params: { width: '400', maintainAspect: true } },
              { id: 't-export', type: 'transform', transformId: 'flow-export', params: { suffix: '_thumb', format: 'image/jpeg', quality: 80 } }
            ]
          }
        ]
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
  }

];
