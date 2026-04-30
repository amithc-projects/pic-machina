/**
 * ImageChef — Global Settings Manager
 * 
 * Handles serialization/deserialization of user preferences and dynamic 
 * injection of CSS variables to customize the UI.
 */

const STORAGE_KEY = 'ic-global-settings';

const DEFAULT_SETTINGS = {
  license: 'Free',
  batch: {
    useInputForOutput: true // Output directly inside Input directory
  },
  thumbnails: {
    // Opt-in content-aware thumbnails. When true + the InSPyReNet model is
    // downloaded, recipe/showcase covers are cropped around the detected
    // subject instead of the image centre. Falls back to centre-crop if the
    // model is missing or no subject is found. See utils/thumbnails.js.
    smart: false
  },
  ai: {
    // URL of the AI Image Describer endpoint.
    // Receives a multipart/form-data POST with an `image` file field and an
    // optional `filename` text field. Must return JSON matching (or mappable
    // to) the Pic-Machina sidecar schema — either the full sidecar format
    // (with a top-level `analysis` key) or the raw AI analysis format
    // (with top-level keys: scene, subjects, composition, lighting, etc.).
    describerEndpoint: ''
  },
  masterFonts: [
    { id: 'font-inter', label: 'Inter', value: 'Inter' },
    { id: 'font-outfit', label: 'Outfit', value: 'Outfit' },
    { id: 'font-mono', label: 'Monospace', value: 'monospace' },
    { id: 'font-serif', label: 'Serif', value: 'serif' },
    { id: 'font-arial', label: 'Arial', value: 'Arial' },
    { id: 'font-times', label: 'Times New Roman', value: '"Times New Roman"' },
    { id: 'font-courier', label: 'Courier New', value: '"Courier New"' },
    { id: 'font-georgia', label: 'Georgia', value: 'Georgia' },
    { id: 'font-verdana', label: 'Verdana', value: 'Verdana' },
    { id: 'font-trebuchet', label: 'Trebuchet MS', value: '"Trebuchet MS"' },
    { id: 'font-impact', label: 'Impact', value: 'Impact' },
    { id: 'font-comic', label: 'Comic Sans MS', value: '"Comic Sans MS"' },
    { id: 'font-dancing', label: 'Dancing Script', value: '"Dancing Script"' }
  ],
  palette: [
    { label: 'Black',  color: '#000000' },
    { label: 'White',  color: '#ffffff' },
    { label: 'Pink',   color: '#f472b6' },
    { label: 'Blue',   color: '#3b82f6' }
  ],
  textStyles: [
    {
      id: 'style-subtitles',
      name: 'Subtitles',
      fontFamily: 'Inter',
      sizeMode: 'px',
      size: 42,
      color: '#ffffff',
      weight: '700',
      bgBox: 'wrap',
      bgColor: '#000000',
      bgOpacity: 60,
      bgPadding: 8,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.8)'
    },
    {
      id: 'style-main-heading',
      name: 'Main Heading',
      fontFamily: 'Outfit',
      sizeMode: 'pct-width',
      size: 8,
      color: '#ffffff',
      weight: '700',
      bgBox: 'none',
      bgColor: '#000000',
      bgOpacity: 60,
      bgPadding: 8,
      shadow: true,
      shadowColor: 'rgba(0,0,0,0.8)'
    },
    {
      id: 'style-footnote',
      name: 'Footnote',
      fontFamily: 'Inter',
      sizeMode: 'px',
      size: 24,
      color: '#aaaaaa',
      weight: '400',
      bgBox: 'none',
      bgColor: '#000000',
      bgOpacity: 60,
      bgPadding: 8,
      shadow: false,
      shadowColor: 'rgba(0,0,0,0.8)'
    }
  ]
};

/**
 * Perform a deep merge of generic objects
 */
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Object && key in target) {
      Object.assign(source[key], deepMerge(target[key], source[key]));
    }
  }
  Object.assign(target || {}, source);
  return target;
}

/**
 * Returns strongly-typed configuration applying defaults over user overrides
 */
export function getSettings() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? JSON.parse(raw) : {};
  return deepMerge(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), parsed);
}

/**
 * Save configuration to local storage
 */
export function saveSettings(partial) {
  const current = getSettings();
  const next = deepMerge(current, partial);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  applyThemeColors();
  return next;
}

/**
 * Reads user category colors and injects them as active CSS variables
 */
export function applyThemeColors() {
  // Purposefully blank: we no longer inject category properties
  // This satisfies main.js's bootloader without failing.
}
