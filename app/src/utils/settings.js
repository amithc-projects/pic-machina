/**
 * ImageChef — Global Settings Manager
 * 
 * Handles serialization/deserialization of user preferences and dynamic 
 * injection of CSS variables to customize the UI.
 */

const STORAGE_KEY = 'ic-global-settings';

const DEFAULT_SETTINGS = {
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
  palette: [
    { label: 'Black',  color: '#000000' },
    { label: 'White',  color: '#ffffff' },
    { label: 'Pink',   color: '#f472b6' },
    { label: 'Blue',   color: '#3b82f6' }
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
