/**
 * Pic-Machina — Stock Media Provider Registry
 *
 * Central registry of stock media sources used by the Get Media screen.
 * Adding a new provider: create src/utils/<name>.js exporting the
 * documented interface (see Provider type below), then add an entry to
 * the PROVIDERS map. No other code in the app needs to change.
 *
 * Provider interface (each module must export):
 *   PROVIDER         {string}   stable identifier ('pexels', 'unsplash', …)
 *   PROVIDER_LABEL   {string}   human-readable name shown in UI
 *   SUPPORTS_VIDEOS  {boolean}  whether the source returns video assets
 *   hasKey()         {boolean}  whether the user has configured credentials
 *   search(opts)     -> { assets, rate } | { unauthenticated:true }
 *   listCollections(opts)    -> { collections, rate } | { unauthenticated:true }
 *   getCollectionMedia(opts) -> { assets, rate } | { unauthenticated:true }
 *   toSidecar(asset, {filename}) -> partial sidecar object
 *   registerDownload?(asset) (optional, no-op if absent — Unsplash needs it)
 *
 * Normalised asset shape (returned by every provider):
 *   { provider, kind: 'photo'|'video', id, thumb, previewUrl, downloadUrl,
 *     videoUrl, width, height, duration, photographer, photographerUrl,
 *     pageUrl, ext, raw }
 *
 * Normalised collection shape:
 *   { provider, id, title, description, coverUrl, photosCount, videosCount, totalCount }
 */

import * as pexels from './pexels.js';
import * as unsplash from './unsplash.js';
import * as pixabay from './pixabay.js';

const REGISTRY = {
  [pexels.PROVIDER]:   pexels,
  [unsplash.PROVIDER]: unsplash,
  [pixabay.PROVIDER]:  pixabay,
};

const PROVIDER_META = {
  [pexels.PROVIDER]:   { configHint: 'Pexels API key',     siteUrl: 'https://www.pexels.com' },
  [unsplash.PROVIDER]: { configHint: 'Unsplash Access Key', siteUrl: 'https://unsplash.com'   },
  [pixabay.PROVIDER]:  { configHint: 'Pixabay API key',    siteUrl: 'https://pixabay.com'    },
};

export function listProviders() {
  return Object.values(REGISTRY).map(mod => ({
    id: mod.PROVIDER,
    label: mod.PROVIDER_LABEL,
    supportsVideos: mod.SUPPORTS_VIDEOS,
    configHint: PROVIDER_META[mod.PROVIDER]?.configHint || 'API credentials',
    siteUrl: PROVIDER_META[mod.PROVIDER]?.siteUrl || ''
  }));
}

export function getProvider(id) {
  const mod = REGISTRY[id];
  if (!mod) throw new Error(`Unknown media provider: ${id}`);
  return {
    id: mod.PROVIDER,
    label: mod.PROVIDER_LABEL,
    supportsVideos: mod.SUPPORTS_VIDEOS,
    isUrlProvider: !!mod.IS_URL_PROVIDER,
    configHint: PROVIDER_META[mod.PROVIDER]?.configHint || 'API credentials',
    siteUrl: PROVIDER_META[mod.PROVIDER]?.siteUrl || '',
    hasKey:             () => mod.hasKey(),
    search:             (o) => mod.search(o),
    listCollections:    (o) => mod.listCollections(o),
    getCollectionMedia: (o) => mod.getCollectionMedia(o),
    toSidecar:          (a, opts) => mod.toSidecar(a, opts),
    registerDownload:   (a) => mod.registerDownload ? mod.registerDownload(a) : null,
    fetchUrl:           (url, quality, mediaType) => mod.fetchUrl ? mod.fetchUrl(url, quality, mediaType) : Promise.reject(new Error('fetchUrl not supported')),
  };
}
