/**
 * Pic-Machina — Shared Stock Media Downloader
 *
 * Operates on the provider-agnostic asset shape produced by the
 * registry in media-providers.js. Writes each asset into a user-selected
 * FileSystemDirectoryHandle, alongside a Pic-Machina sidecar JSON
 * (see docs/sidecar.schema.json) populated from the provider's metadata,
 * plus a single attribution.txt summarising the batch.
 */

import { getProvider } from './media-providers.js';
import { writeSidecar } from '../data/sidecar.js';

function slug(s) {
  return (s || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'unknown';
}

export function buildFilename(asset) {
  return `${asset.provider}-${asset.id}-${slug(asset.photographer)}.${asset.ext || (asset.kind === 'video' ? 'mp4' : 'jpg')}`;
}

async function fetchBlob(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}

async function writeBlob(dirHandle, filename, blob) {
  const fh = await dirHandle.getFileHandle(filename, { create: true });
  const ws = await fh.createWritable();
  await ws.write(blob);
  await ws.close();
}

async function writeAssetSidecar(dirHandle, mediaFilename, asset, sizeBytes) {
  let sidecar;
  try {
    sidecar = getProvider(asset.provider).toSidecar(asset, { filename: mediaFilename });
  } catch (e) {
    console.warn('[media-download] toSidecar failed', e);
    return;
  }
  if (!sidecar) return;
  if (sidecar.source) sidecar.source.sizeBytes = sizeBytes;
  // Delegate to the canonical writer so the file passes through
  // migrateSidecar() and stays consistent with sidecars produced
  // elsewhere in the app.
  await writeSidecar(dirHandle, mediaFilename, sidecar);
}

/**
 * Download many normalised assets in parallel into the chosen directory.
 * Each successfully downloaded asset gets a `<filename>.json` sidecar.
 *
 * @param {Array} assets
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {(p:{done:number,total:number,asset:object,error?:Error})=>void} onProgress
 */
export async function downloadMany(assets, dirHandle, onProgress) {
  const ok = [];
  const failed = [];
  let done = 0;
  const total = assets.length;
  const concurrency = 4;
  let i = 0;

  async function worker() {
    while (i < assets.length) {
      const asset = assets[i++];
      try {
        const url = asset.downloadUrl;
        if (!url) throw new Error('No downloadable URL');
        try { getProvider(asset.provider).registerDownload(asset); } catch {}
        const blob = await fetchBlob(url);
        const filename = buildFilename(asset);
        await writeBlob(dirHandle, filename, blob);
        try { await writeAssetSidecar(dirHandle, filename, asset, blob.size); } catch (e) { console.warn('[media-download] sidecar write failed', e); }
        ok.push({ asset, filename });
        done++;
        onProgress?.({ done, total, asset });
      } catch (error) {
        failed.push({ asset, error });
        done++;
        onProgress?.({ done, total, asset, error });
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));

  if (ok.length) {
    const lines = ok.map(({ asset, filename }) => {
      const provider = getProvider(asset.provider).label;
      const credit = asset.photographer || 'Unknown';
      const creditUrl = asset.photographerUrl || '';
      return `${filename}\n  ${asset.kind === 'video' ? 'Video' : 'Photo'} by ${credit}${creditUrl ? ' (' + creditUrl + ')' : ''}\n  Source: ${asset.pageUrl} (${provider})\n`;
    });
    const header =
      'Media downloaded via Pic-Machina from third-party stock providers.\n' +
      'Pexels License:   https://www.pexels.com/license/\n' +
      'Unsplash License: https://unsplash.com/license\n' +
      'Each file has a matching .json sidecar with provider metadata.\n' +
      'Please credit photographers when you can.\n\n';
    const blob = new Blob([header + lines.join('\n')], { type: 'text/plain' });
    try { await writeBlob(dirHandle, 'attribution.txt', blob); } catch { /* non-fatal */ }
  }

  return { ok, failed };
}
