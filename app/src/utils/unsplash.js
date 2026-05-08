/**
 * Pic-Machina — Unsplash API Client
 *
 * Wraps the Unsplash public API (photos only — Unsplash has no video
 * endpoint) and normalises results into the provider-agnostic asset
 * shape used by the Get Media screen.
 *
 * Docs: https://unsplash.com/documentation
 *
 * Per Unsplash API guidelines, when a user downloads a photo we must
 * trigger the photo's `download_location` endpoint to register the
 * download. The response is ignored; only the side-effect matters.
 * See: https://help.unsplash.com/en/articles/2511258-guideline-triggering-a-download
 */

import { getSettings } from './settings.js';

const API = 'https://api.unsplash.com';

export const PROVIDER = 'unsplash';
export const PROVIDER_LABEL = 'Unsplash';
export const SUPPORTS_VIDEOS = false;

function getKey() {
  return (getSettings().unsplash?.accessKey || '').trim();
}

export function hasKey() {
  return getKey().length > 0;
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : '';
}

async function request(url) {
  const key = getKey();
  if (!key) return { unauthenticated: true };
  const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  const rate = {
    limit:     Number(res.headers.get('X-Ratelimit-Limit'))     || null,
    remaining: Number(res.headers.get('X-Ratelimit-Remaining')) || null,
    reset:     null
  };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Unsplash API ${res.status}: ${body || res.statusText}`);
  }
  return { data: await res.json(), rate };
}

function photoToAsset(p) {
  return {
    provider: PROVIDER,
    kind: 'photo',
    id: String(p.id),
    thumb: p.urls?.small || p.urls?.thumb,
    previewUrl: p.urls?.regular,
    downloadUrl: p.urls?.full || p.urls?.raw,
    videoUrl: null,
    width: p.width,
    height: p.height,
    duration: 0,
    photographer: p.user?.name || 'Unsplash',
    photographerUrl: p.user?.links?.html || '',
    pageUrl: p.links?.html || '',
    ext: 'jpg',
    raw: p,
    // Unsplash-specific: must ping this when the user actually downloads.
    _downloadLocation: p.links?.download_location || null
  };
}

/**
 * Map an Unsplash asset onto a partial Pic-Machina sidecar (schema v2).
 * Unsplash exposes richer metadata than Pexels — tags, EXIF, location —
 * so we populate more sections.
 */
export function toSidecar(asset, { filename } = {}) {
  const r = asset.raw || {};
  const aspect = (asset.width && asset.height) ? gcdRatio(asset.width, asset.height) : '';
  const orientation = asset.width === asset.height ? 'square'
                    : asset.width  >  asset.height ? 'landscape' : 'portrait';
  const title = r.description || r.alt_description || `Unsplash photo ${asset.id} by ${asset.photographer}`;
  const tags = (r.tags || []).map(t => t.title).filter(Boolean);

  const sidecar = {
    $version: 2,
    source: { filename: filename || '', sizeBytes: 0 },
    asset: {
      title,
      assetType: 'Stock Photo',
      format: 'JPEG',
      widthPx: asset.width || undefined,
      heightPx: asset.height || undefined,
      aspectRatio: aspect || undefined,
      orientation,
      captureDate: r.created_at ? r.created_at.slice(0, 10) : undefined,
      rightsNotes: 'Free to use under the Unsplash License (https://unsplash.com/license). Crediting the photographer is appreciated.'
    },
    annotation: {
      tags: ['unsplash', asset.photographer, ...tags.slice(0, 8)].filter(Boolean),
      caption: r.alt_description || r.description || ''
    },
    analysis: {
      generatedBy: 'unsplash-api',
      generatedAt: new Date().toISOString(),
      tags
    },
    pmStockSource: {
      provider: 'unsplash',
      id: asset.id,
      pageUrl: asset.pageUrl,
      photographer: asset.photographer,
      photographerUrl: asset.photographerUrl,
      color: r.color || undefined,
      blurHash: r.blur_hash || undefined,
      downloadUrl: asset.downloadUrl,
      likes: r.likes || undefined
    }
  };

  // Unsplash sometimes provides EXIF
  if (r.exif) {
    sidecar.exif = {};
    if (r.exif.make)          sidecar.exif.cameraMake     = r.exif.make;
    if (r.exif.model)         sidecar.exif.cameraModel    = r.exif.model;
    if (r.exif.focal_length)  sidecar.exif.focalLength    = String(r.exif.focal_length) + 'mm';
    if (r.exif.aperture)      sidecar.exif.aperture       = `f/${r.exif.aperture}`;
    if (r.exif.exposure_time) sidecar.exif.shutterSpeed   = String(r.exif.exposure_time);
    if (r.exif.iso)           sidecar.exif.iso            = r.exif.iso;
    if (Object.keys(sidecar.exif).length === 0) delete sidecar.exif;
  }

  // Unsplash sometimes provides location
  if (r.location) {
    sidecar.geo = {};
    if (r.location.city)    sidecar.geo.city    = r.location.city;
    if (r.location.country) sidecar.geo.country = r.location.country;
    if (r.location.position?.latitude  != null) sidecar.exif = { ...(sidecar.exif || {}), gpsLat: r.location.position.latitude };
    if (r.location.position?.longitude != null) sidecar.exif = { ...(sidecar.exif || {}), gpsLng: r.location.position.longitude };
    if (Object.keys(sidecar.geo).length === 0) delete sidecar.geo;
  }

  return sidecar;
}

function gcdRatio(w, h) {
  const g = (function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); })(w, h);
  return `${w / g}:${h / g}`;
}

export async function search({ query, page = 1, perPage = 24, orientation }) {
  // Unsplash orientations: landscape | portrait | squarish
  const orient = orientation === 'square' ? 'squarish' : orientation;
  const r = await request(`${API}/search/photos${buildQuery({ query, page, per_page: perPage, orientation: orient })}`);
  if (r.unauthenticated) return { unauthenticated: true };
  return { assets: (r.data?.results || []).map(photoToAsset), rate: r.rate };
}

export async function listCollections({ page = 1, perPage = 20 } = {}) {
  const r = await request(`${API}/collections${buildQuery({ page, per_page: perPage })}`);
  if (r.unauthenticated) return { unauthenticated: true };
  const collections = (r.data || []).map(c => ({
    provider: PROVIDER,
    id: c.id,
    title: c.title || 'Untitled',
    description: c.description || '',
    coverUrl: c.cover_photo?.urls?.small || null,
    photosCount: c.total_photos || 0,
    videosCount: 0,
    totalCount: c.total_photos || 0
  }));
  return { collections, rate: r.rate };
}

export async function getCollectionMedia({ id, page = 1, perPage = 24 } = {}) {
  const r = await request(`${API}/collections/${encodeURIComponent(id)}/photos${buildQuery({ page, per_page: perPage })}`);
  if (r.unauthenticated) return { unauthenticated: true };
  return { assets: (r.data || []).map(photoToAsset), rate: r.rate };
}

/**
 * Trigger an Unsplash download registration. Required by the API guidelines.
 * Failures are non-fatal — the actual download proceeds regardless.
 */
export async function registerDownload(asset) {
  if (!asset?._downloadLocation) return;
  const key = getKey();
  if (!key) return;
  try {
    await fetch(asset._downloadLocation, { headers: { Authorization: `Client-ID ${key}` } });
  } catch { /* non-fatal */ }
}
