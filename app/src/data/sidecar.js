/**
 * ImageChef — Sidecar metadata module
 *
 * Reads and writes `.json` sidecar files stored alongside images
 * (e.g. `photo.jpg` → `photo.jpg.json`) using the File System Access API.
 *
 * Schema v1:
 *   $version  — always 1
 *   source    — filename, sha256, sizeBytes (set on first write, read-only)
 *   exif      — mirror of EXIF fields (read-only, from image file)
 *   geo       — city/country derived from GPS, user-editable
 *   annotation — rating (1-5|null), flag ('pick'|'reject'|null), tags[], caption
 *   computed  — sharpness scores, AI processing results (written by transforms)
 *   processing — append-only log of batch runs
 */

const SIDECAR_EXT = '.json';

// Nominatim reverse-geocode — free, no key, 1 req/s limit
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/reverse';

// Simple in-memory rate-limit queue: one request per second
let _geocodeLastAt = 0;
async function _throttledFetch(url) {
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - _geocodeLastAt));
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _geocodeLastAt = Date.now();
  return fetch(url, { headers: { 'Accept-Language': 'en' } });
}

// ─── Schema version + migration ────────────────────────────
//
// Bump CURRENT_SIDECAR_VERSION whenever the saved shape changes. On read
// we migrate in-memory (non-destructive) so callers always see a complete
// object. On write we migrate again and stamp the current version so the
// file on disk heals itself the next time the user saves anything.
//
// v1 → v2: added `annotation.usageScenarios`, `asset.title`, `asset.contentRating`.

export const CURRENT_SIDECAR_VERSION = 2;

/**
 * Factory: produces a fully-populated sidecar object with sensible defaults.
 * Safe to deep-merge against — every section exists.
 */
export function createEmptySidecar() {
  return {
    $version: CURRENT_SIDECAR_VERSION,
    source: {
      filename:  '',
      sizeBytes: 0,
    },
    exif: {
      cameraMake:   null,
      cameraModel:  null,
      focalLength:  null,
      aperture:     null,
      iso:          null,
      shutterSpeed: null,
      dateTaken:    null,
      gpsLat:       null,
      gpsLng:       null,
      gpsAltitude:  null,
    },
    geo: {
      city:        '',
      region:      '',
      country:     '',
      countryCode: '',
    },
    annotation: {
      rating:         null,
      flag:           null,
      tags:           [],
      caption:        '',
      usageScenarios: [],
    },
    asset: {
      title:         '',
      contentRating: 'general',
    },
    computed:   {},
    processing: [],
  };
}

/**
 * Upgrade an arbitrary sidecar object to the current schema. Missing
 * sections/fields are filled from the empty template; unknown keys are
 * preserved (we never want to silently drop user data). Idempotent.
 */
export function migrateSidecar(data) {
  if (!data || typeof data !== 'object') return createEmptySidecar();
  const empty = createEmptySidecar();
  const out = {};

  // Merge each known section, preserving existing values where present.
  for (const section of Object.keys(empty)) {
    if (section === '$version') continue;
    const defaults = empty[section];
    const existing = data[section];
    if (Array.isArray(defaults)) {
      out[section] = Array.isArray(existing) ? existing : defaults;
    } else if (defaults && typeof defaults === 'object') {
      out[section] = {
        ...defaults,
        ...(existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {}),
      };
    } else {
      out[section] = existing !== undefined ? existing : defaults;
    }
  }

  // Preserve any unknown top-level keys so we don't drop data on round-trip.
  for (const k of Object.keys(data)) {
    if (!(k in empty) && k !== '$version') out[k] = data[k];
  }

  out.$version = CURRENT_SIDECAR_VERSION;
  return out;
}

// ─── Read / Write ─────────────────────────────────────────

/**
 * Read sidecar for `filename` from `dirHandle`.
 * Returns a schema-complete object (migrated in-memory) or null if the
 * sidecar doesn't exist / is malformed. The file on disk is NOT modified
 * here — the next writeSidecar() call persists the upgraded shape.
 */
export async function readSidecar(dirHandle, filename) {
  if (!dirHandle) return null;
  try {
    const fh   = await dirHandle.getFileHandle(`${filename}${SIDECAR_EXT}`);
    const file  = await fh.getFile();
    const text  = await file.text();
    const parsed = JSON.parse(text);
    return migrateSidecar(parsed);
  } catch {
    return null;
  }
}

/**
 * Write sidecar for `filename` to `dirHandle`.
 * Always migrates + stamps $version before serialising, so files saved by
 * an older build get healed on the next edit.
 */
export async function writeSidecar(dirHandle, filename, data) {
  if (!dirHandle) throw new Error('No directory handle');
  const migrated = migrateSidecar(data);
  const fh       = await dirHandle.getFileHandle(`${filename}${SIDECAR_EXT}`, { create: true });
  const writable  = await fh.createWritable();
  await writable.write(JSON.stringify(migrated, null, 2));
  await writable.close();
}

// ─── Tag scanning ──────────────────────────────────────────

/**
 * Scan all `.json` files in `dirHandle` and return a sorted, deduped list
 * of tags used across all sidecars (for autocomplete hints).
 */
export async function listSidecarTags(dirHandle) {
  if (!dirHandle) return [];
  const tags = new Set();
  try {
    for await (const [name, handle] of dirHandle.entries()) {
      if (handle.kind !== 'file' || !name.endsWith(SIDECAR_EXT)) continue;
      try {
        const file = await handle.getFile();
        const data = JSON.parse(await file.text());
        (data.annotation?.tags || []).forEach(t => tags.add(t));
      } catch { /* skip malformed */ }
    }
  } catch { /* dirHandle may have been revoked */ }
  return [...tags].sort();
}

// ─── Geo reverse-geocoding ─────────────────────────────────

/**
 * Look up city/country for a GPS coordinate via Nominatim.
 * Respects the 1 req/s rate limit via internal throttle.
 * Returns { city, region, country, countryCode } or throws on failure.
 */
export async function reverseGeocode(lat, lng) {
  const url  = `${NOMINATIM_URL}?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
  const resp = await _throttledFetch(url);
  if (!resp.ok) throw new Error(`Geocode failed: ${resp.status}`);
  const data = await resp.json();
  const a    = data.address || {};
  return {
    city:        a.city || a.town || a.village || a.hamlet || a.municipality || '',
    region:      a.state || a.county || '',
    country:     a.country || '',
    countryCode: (a.country_code || '').toUpperCase(),
  };
}

// ─── Variable flattening ───────────────────────────────────

/**
 * Flatten a sidecar object into a Map keyed as `sidecar.section.field`.
 * Used to populate {{sidecar.*}} variables in the processor.
 */
export function flattenSidecarVars(sidecar) {
  const vars = new Map();
  if (!sidecar || typeof sidecar !== 'object') return vars;

  function walk(obj, prefix) {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$')) continue; // skip meta fields like $version
      const key = prefix ? `${prefix}.${k}` : k;
      if (Array.isArray(v)) {
        vars.set(`sidecar.${key}`, v.join(', '));
      } else if (v !== null && typeof v === 'object') {
        walk(v, key);
      } else if (v !== null && v !== undefined) {
        vars.set(`sidecar.${key}`, String(v));
      }
    }
  }
  walk(sidecar, '');
  return vars;
}

// ─── Patch builder ────────────────────────────────────────

/**
 * Merge user form values onto an existing sidecar object.
 * formValues shape: { rating, flag, tags, caption, city, region, country, countryCode }
 * Returns a complete sidecar object ready to write.
 */
export function buildSidecarPatch(existing, formValues) {
  return {
    $version:   1,
    source:     existing?.source     || {},
    exif:       existing?.exif       || {},
    geo: {
      city:        formValues.city        ?? existing?.geo?.city        ?? '',
      region:      formValues.region      ?? existing?.geo?.region      ?? '',
      country:     formValues.country     ?? existing?.geo?.country     ?? '',
      countryCode: formValues.countryCode ?? existing?.geo?.countryCode ?? '',
    },
    annotation: {
      rating:  formValues.rating  ?? existing?.annotation?.rating  ?? null,
      flag:    formValues.flag    ?? existing?.annotation?.flag    ?? null,
      tags:    formValues.tags    ?? existing?.annotation?.tags    ?? [],
      caption: formValues.caption ?? existing?.annotation?.caption ?? '',
    },
    computed:   existing?.computed   || {},
    processing: existing?.processing || [],
  };
}

// ─── Sidecar schema — static key paths for autocomplete ───

/**
 * All known dotted key paths in the sidecar schema.
 * Used to populate the {{sidecar.}} autocomplete dropdown.
 */
export const SIDECAR_SCHEMA_KEYS = [
  'sidecar.annotation.rating',
  'sidecar.annotation.flag',
  'sidecar.annotation.tags',
  'sidecar.annotation.caption',
  'sidecar.annotation.usageScenarios',
  'sidecar.asset.title',
  'sidecar.asset.contentRating',
  'sidecar.geo.city',
  'sidecar.geo.region',
  'sidecar.geo.country',
  'sidecar.geo.countryCode',
  'sidecar.exif.cameraMake',
  'sidecar.exif.cameraModel',
  'sidecar.exif.focalLength',
  'sidecar.exif.aperture',
  'sidecar.exif.iso',
  'sidecar.exif.shutterSpeed',
  'sidecar.exif.dateTaken',
  'sidecar.exif.gpsLat',
  'sidecar.exif.gpsLng',
  'sidecar.exif.gpsAltitude',
  'sidecar.computed.sharpnessScore',
  'sidecar.computed.blurLabel',
  'sidecar.source.filename',
  'sidecar.source.sizeBytes',
];

/**
 * Structured view of the sidecar schema — mirrors the section layout of
 * the sidecar drawer (src/components/sidecar-drawer.js) so other UIs (the
 * variable picker, autocomplete help, etc.) can render a matching
 * hierarchy with the same group names and expand/collapse defaults.
 *
 * `defaultOpen` matches the drawer: Annotation is always expanded;
 * Location is expanded by default; Camera & EXIF / Computed / Source
 * collapse by default.
 */
export const SIDECAR_SCHEMA_GROUPS = [
  {
    title: 'Annotation',
    defaultOpen: true,
    keys: [
      { key: 'sidecar.annotation.rating',         label: 'Rating'          },
      { key: 'sidecar.annotation.flag',           label: 'Flag'            },
      { key: 'sidecar.annotation.tags',           label: 'Tags'            },
      { key: 'sidecar.annotation.caption',        label: 'Caption'         },
      { key: 'sidecar.annotation.usageScenarios', label: 'Usage Scenarios' },
    ],
  },
  {
    title: 'Asset',
    defaultOpen: true,
    keys: [
      { key: 'sidecar.asset.title',         label: 'Title'          },
      { key: 'sidecar.asset.contentRating', label: 'Content Rating' },
    ],
  },
  {
    title: 'Location',
    defaultOpen: true,
    keys: [
      { key: 'sidecar.geo.city',        label: 'City'         },
      { key: 'sidecar.geo.region',      label: 'Region'       },
      { key: 'sidecar.geo.country',     label: 'Country'      },
      { key: 'sidecar.geo.countryCode', label: 'Country Code' },
    ],
  },
  {
    title: 'Camera & EXIF',
    defaultOpen: false,
    keys: [
      { key: 'sidecar.exif.cameraMake',   label: 'Camera Make'   },
      { key: 'sidecar.exif.cameraModel',  label: 'Camera Model'  },
      { key: 'sidecar.exif.focalLength',  label: 'Focal Length'  },
      { key: 'sidecar.exif.aperture',     label: 'Aperture'      },
      { key: 'sidecar.exif.iso',          label: 'ISO'           },
      { key: 'sidecar.exif.shutterSpeed', label: 'Shutter Speed' },
      { key: 'sidecar.exif.dateTaken',    label: 'Date Taken'    },
      { key: 'sidecar.exif.gpsLat',       label: 'GPS Latitude'  },
      { key: 'sidecar.exif.gpsLng',       label: 'GPS Longitude' },
      { key: 'sidecar.exif.gpsAltitude',  label: 'GPS Altitude'  },
    ],
  },
  {
    title: 'Computed',
    defaultOpen: false,
    keys: [
      { key: 'sidecar.computed.sharpnessScore', label: 'Sharpness Score' },
      { key: 'sidecar.computed.blurLabel',      label: 'Blur Label'      },
    ],
  },
  {
    title: 'Source',
    defaultOpen: false,
    keys: [
      { key: 'sidecar.source.filename',  label: 'Filename'  },
      { key: 'sidecar.source.sizeBytes', label: 'Size (bytes)' },
    ],
  },
];
