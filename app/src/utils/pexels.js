/**
 * Pic-Machina — Pexels API Client
 *
 * Wraps the Pexels public API and normalises results into the
 * provider-agnostic asset shape used by the Get Media screen and
 * shared download utilities.
 *
 * Docs: https://www.pexels.com/api/documentation/
 */

import { getSettings } from './settings.js';

const PHOTO_API = 'https://api.pexels.com/v1';
const VIDEO_API = 'https://api.pexels.com/videos';

export const PROVIDER = 'pexels';
export const PROVIDER_LABEL = 'Pexels';
export const SUPPORTS_VIDEOS = true;

function getKey() {
  return (getSettings().pexels?.apiKey || '').trim();
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
  const res = await fetch(url, { headers: { Authorization: key } });
  const rate = {
    limit:     Number(res.headers.get('X-Ratelimit-Limit'))     || null,
    remaining: Number(res.headers.get('X-Ratelimit-Remaining')) || null,
    reset:     Number(res.headers.get('X-Ratelimit-Reset'))     || null
  };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pexels API ${res.status}: ${body || res.statusText}`);
  }
  return { data: await res.json(), rate };
}

function pickBestVideoFile(video) {
  const files = (video.video_files || [])
    .filter(f => (f.file_type || '').includes('mp4'))
    .sort((a, b) => (b.width * b.height) - (a.width * a.height));
  return files[0] || video.video_files?.[0] || null;
}

function photoToAsset(p) {
  return {
    provider: PROVIDER,
    kind: 'photo',
    id: String(p.id),
    thumb: p.src?.medium || p.src?.small || p.src?.tiny,
    previewUrl: p.src?.large2x || p.src?.large || p.src?.original,
    downloadUrl: p.src?.original,
    videoUrl: null,
    width: p.width,
    height: p.height,
    duration: 0,
    photographer: p.photographer || 'Pexels',
    photographerUrl: p.photographer_url || '',
    pageUrl: p.url || '',
    ext: (p.src?.original?.split('.').pop() || 'jpg').split('?')[0].slice(0, 5),
    raw: p
  };
}

function videoToAsset(v) {
  const file = pickBestVideoFile(v);
  return {
    provider: PROVIDER,
    kind: 'video',
    id: String(v.id),
    thumb: v.image,
    previewUrl: v.image,
    downloadUrl: file?.link || null,
    videoUrl: file?.link || null,
    width: v.width,
    height: v.height,
    duration: v.duration || 0,
    photographer: v.user?.name || 'Pexels',
    photographerUrl: v.user?.url || '',
    pageUrl: v.url || '',
    ext: 'mp4',
    raw: v
  };
}

/**
 * Map a Pexels asset onto a partial Pic-Machina sidecar (schema v2).
 * Caller fills in `source.sizeBytes` after the blob is fetched.
 * See docs/sidecar.schema.json.
 */
export function toSidecar(asset, { filename } = {}) {
  const r = asset.raw || {};
  const aspect = (asset.width && asset.height) ? gcdRatio(asset.width, asset.height) : '';
  const orientation = asset.width === asset.height ? 'square'
                    : asset.width  >  asset.height ? 'landscape' : 'portrait';
  const title = (asset.kind === 'photo' ? r.alt : null) || `Pexels ${asset.kind} ${asset.id} by ${asset.photographer}`;

  const sidecar = {
    $version: 2,
    source: { filename: filename || '', sizeBytes: 0 },
    asset: {
      title,
      assetType: asset.kind === 'video' ? 'Stock Video' : 'Stock Photo',
      format: asset.kind === 'video' ? 'MP4' : (asset.ext || '').toUpperCase() || 'JPEG',
      widthPx: asset.width || undefined,
      heightPx: asset.height || undefined,
      aspectRatio: aspect || undefined,
      orientation,
      rightsNotes: 'Free to use under the Pexels License (https://www.pexels.com/license/). Attribution appreciated.'
    },
    annotation: {
      tags: ['pexels', asset.kind, asset.photographer].filter(Boolean),
      caption: asset.kind === 'photo' ? (r.alt || '') : ''
    },
    analysis: {
      generatedBy: 'pexels-api',
      generatedAt: new Date().toISOString(),
      tags: []
    },
    pmStockSource: {
      provider: 'pexels',
      id: asset.id,
      pageUrl: asset.pageUrl,
      photographer: asset.photographer,
      photographerUrl: asset.photographerUrl,
      avgColor: r.avg_color || undefined,
      downloadUrl: asset.downloadUrl,
      durationSec: asset.duration || undefined
    }
  };
  if (asset.kind === 'video') {
    sidecar.asset.durationSec = asset.duration;
    delete sidecar.analysis;
  }
  return sidecar;
}

function gcdRatio(w, h) {
  const g = (function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); })(w, h);
  return `${w / g}:${h / g}`;
}

export async function search({ query, kind = 'both', page = 1, perPage = 24, orientation, size }) {
  const calls = [];
  let rate = null;
  if (kind === 'photo' || kind === 'both') {
    calls.push(request(`${PHOTO_API}/search${buildQuery({ query, page, per_page: perPage, orientation, size })}`)
      .then(r => { rate = r.rate || rate; return (r.data?.photos || []).map(photoToAsset); }));
  }
  if (kind === 'video' || kind === 'both') {
    calls.push(request(`${VIDEO_API}/search${buildQuery({ query, page, per_page: perPage, orientation, size })}`)
      .then(r => { rate = r.rate || rate; return (r.data?.videos || []).map(videoToAsset); }));
  }
  const groups = await Promise.all(calls);
  return { assets: groups.flat(), rate };
}

export async function listCollections({ page = 1, perPage = 20 } = {}) {
  const r = await request(`${PHOTO_API}/collections/featured${buildQuery({ page, per_page: perPage })}`);
  if (r.unauthenticated) return { unauthenticated: true };
  const collections = (r.data?.collections || []).map(c => ({
    provider: PROVIDER,
    id: c.id,
    title: c.title || 'Untitled',
    description: c.description || '',
    coverUrl: null,
    photosCount: c.photos_count || 0,
    videosCount: c.videos_count || 0,
    totalCount: (c.photos_count || 0) + (c.videos_count || 0)
  }));
  return { collections, rate: r.rate };
}

export async function getCollectionMedia({ id, page = 1, perPage = 24 } = {}) {
  const r = await request(`${PHOTO_API}/collections/${encodeURIComponent(id)}${buildQuery({ page, per_page: perPage })}`);
  if (r.unauthenticated) return { unauthenticated: true };
  const items = r.data?.media || [];
  const assets = items.map(item => item.type === 'Video' ? videoToAsset(item) : photoToAsset(item));
  return { assets, rate: r.rate };
}
