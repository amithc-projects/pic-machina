/**
 * Pic-Machina — Pixabay API Client
 *
 * Wraps the Pixabay public API and normalises results into the
 * provider-agnostic asset shape used by the Get Media screen.
 *
 * Pixabay differs from Pexels/Unsplash in two ways:
 *  1. Auth is via a `key` query parameter, not a header.
 *  2. There are no user-curated collections. Pixabay does have a fixed
 *     set of categories ("Collections" mode maps to those).
 *
 * Docs: https://pixabay.com/api/docs/
 */

import { getSettings } from './settings.js';

const PHOTO_API = 'https://pixabay.com/api/';
const VIDEO_API = 'https://pixabay.com/api/videos/';

export const PROVIDER = 'pixabay';
export const PROVIDER_LABEL = 'Pixabay';
export const SUPPORTS_VIDEOS = true;

// Predefined categories from the Pixabay API. These power Collections mode
// since Pixabay has no user-curated collection concept.
const CATEGORIES = [
  'backgrounds', 'fashion', 'nature', 'science', 'education', 'feelings',
  'health', 'people', 'religion', 'places', 'animals', 'industry',
  'computer', 'food', 'sports', 'transportation', 'travel', 'buildings',
  'business', 'music'
];

function getKey() {
  return (getSettings().pixabay?.apiKey || '').trim();
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
  return usp.toString();
}

async function request(baseUrl, params) {
  const key = getKey();
  if (!key) return { unauthenticated: true };
  const qs = buildQuery({ key, ...params });
  const res = await fetch(`${baseUrl}?${qs}`);
  const rate = {
    limit:     Number(res.headers.get('X-RateLimit-Limit'))     || null,
    remaining: Number(res.headers.get('X-RateLimit-Remaining')) || null,
    reset:     Number(res.headers.get('X-RateLimit-Reset'))     || null
  };
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Pixabay API ${res.status}: ${body || res.statusText}`);
  }
  return { data: await res.json(), rate };
}

function pickBestVideoFile(videos) {
  if (!videos) return null;
  // Pixabay video tiers: large > medium > small > tiny. Prefer large.
  return videos.large || videos.medium || videos.small || videos.tiny || null;
}

function photoToAsset(p) {
  return {
    provider: PROVIDER,
    kind: 'photo',
    id: String(p.id),
    thumb: p.previewURL || p.webformatURL,
    previewUrl: p.largeImageURL || p.webformatURL,
    // largeImageURL is the highest-quality URL available without a paid
    // account. fullHDURL/imageURL are gated behind the "Full API" plan.
    downloadUrl: p.largeImageURL || p.webformatURL,
    videoUrl: null,
    width: p.imageWidth,
    height: p.imageHeight,
    duration: 0,
    photographer: p.user || 'Pixabay',
    photographerUrl: p.user_id ? `https://pixabay.com/users/${encodeURIComponent(p.user || '')}-${p.user_id}/` : '',
    pageUrl: p.pageURL || '',
    ext: (p.largeImageURL?.split('.').pop() || 'jpg').split('?')[0].slice(0, 5),
    raw: p
  };
}

function videoToAsset(v) {
  const file = pickBestVideoFile(v.videos);
  return {
    provider: PROVIDER,
    kind: 'video',
    id: String(v.id),
    thumb: v.videos?.tiny?.thumbnail || v.videos?.small?.thumbnail || (v.picture_id ? `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg` : ''),
    previewUrl: v.videos?.medium?.thumbnail || v.videos?.tiny?.thumbnail || '',
    downloadUrl: file?.url || null,
    videoUrl: file?.url || null,
    width: file?.width || 0,
    height: file?.height || 0,
    duration: v.duration || 0,
    photographer: v.user || 'Pixabay',
    photographerUrl: v.user_id ? `https://pixabay.com/users/${encodeURIComponent(v.user || '')}-${v.user_id}/` : '',
    pageUrl: v.pageURL || '',
    ext: 'mp4',
    raw: v
  };
}

export async function search({ query, kind = 'both', page = 1, perPage = 24, orientation } = {}) {
  // Pixabay orientation values: all | horizontal | vertical
  const orient = orientation === 'landscape' ? 'horizontal'
              : orientation === 'portrait'  ? 'vertical'
              : '';
  // Pixabay has no "square" filter; ignore that case.
  const baseParams = { q: query, page, per_page: perPage, orientation: orient };

  const calls = [];
  let rate = null;
  if (kind === 'photo' || kind === 'both') {
    calls.push(request(PHOTO_API, baseParams).then(r => {
      if (r.unauthenticated) return { unauthenticated: true };
      rate = r.rate || rate;
      return (r.data?.hits || []).map(photoToAsset);
    }));
  }
  if (kind === 'video' || kind === 'both') {
    // Pixabay's video endpoint ignores `orientation`; pass query+pagination only.
    calls.push(request(VIDEO_API, { q: query, page, per_page: perPage }).then(r => {
      if (r.unauthenticated) return { unauthenticated: true };
      rate = r.rate || rate;
      return (r.data?.hits || []).map(videoToAsset);
    }));
  }
  const groups = await Promise.all(calls);
  if (groups.some(g => g && g.unauthenticated)) return { unauthenticated: true };
  return { assets: groups.flat(), rate };
}

/**
 * Pixabay has no user-curated collections endpoint. Surface the fixed
 * category list so the UI's Collections mode still has something useful
 * to browse. Each "collection" id is a category slug; getCollectionMedia
 * resolves it via the standard search endpoint with `category=...`.
 */
export async function listCollections() {
  if (!hasKey()) return { unauthenticated: true };
  const collections = CATEGORIES.map(slug => ({
    provider: PROVIDER,
    id: slug,
    title: slug.charAt(0).toUpperCase() + slug.slice(1),
    description: `Pixabay "${slug}" category`,
    coverUrl: null,
    photosCount: 0,
    videosCount: 0,
    totalCount: 0
  }));
  return { collections, rate: null };
}

export async function getCollectionMedia({ id, page = 1, perPage = 24 } = {}) {
  if (!CATEGORIES.includes(id)) {
    throw new Error(`Unknown Pixabay category: ${id}`);
  }
  // Fetch photos AND videos from the category in parallel — same shape
  // as the search endpoint does for `kind: 'both'`.
  const [photoR, videoR] = await Promise.all([
    request(PHOTO_API, { category: id, page, per_page: perPage }),
    request(VIDEO_API, { category: id, page, per_page: perPage })
  ]);
  if (photoR.unauthenticated || videoR.unauthenticated) return { unauthenticated: true };
  const assets = [
    ...(photoR.data?.hits || []).map(photoToAsset),
    ...(videoR.data?.hits || []).map(videoToAsset)
  ];
  return { assets, rate: photoR.rate || videoR.rate };
}

/**
 * Map a Pixabay asset onto a partial Pic-Machina sidecar (schema v2).
 * Pixabay's `tags` field is a comma-separated string — split on save.
 */
export function toSidecar(asset, { filename } = {}) {
  const r = asset.raw || {};
  const aspect = (asset.width && asset.height) ? gcdRatio(asset.width, asset.height) : '';
  const orientation = !asset.width || !asset.height ? undefined
                    : asset.width === asset.height ? 'square'
                    : asset.width  >  asset.height ? 'landscape'
                    : 'portrait';
  const pixabayTags = (r.tags || '').split(',').map(s => s.trim()).filter(Boolean);
  const title = pixabayTags.length
    ? `${pixabayTags.slice(0, 3).join(', ')} — by ${asset.photographer}`
    : `Pixabay ${asset.kind} ${asset.id} by ${asset.photographer}`;

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
      rightsNotes: 'Free to use under the Pixabay Content License (https://pixabay.com/service/license-summary/). Attribution appreciated but not required.'
    },
    annotation: {
      tags: ['pixabay', asset.photographer, ...pixabayTags.slice(0, 8)].filter(Boolean),
      caption: ''
    },
    analysis: {
      generatedBy: 'pixabay-api',
      generatedAt: new Date().toISOString(),
      tags: pixabayTags
    },
    pmStockSource: {
      provider: 'pixabay',
      id: asset.id,
      pageUrl: asset.pageUrl,
      photographer: asset.photographer,
      photographerUrl: asset.photographerUrl,
      type: r.type || undefined,
      views: r.views || undefined,
      downloads: r.downloads || undefined,
      likes: r.likes || undefined,
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
