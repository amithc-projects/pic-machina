/**
 * Matte & image-blur helpers used by saliency-consuming transforms across
 * different categories (ai.js, color.js). Kept in one place so we have a
 * single Photon init path and a single implementation of these primitives.
 */

import initPhoton, * as photon from '../vendor/photon/photon_rs.js';
import photonWasmUrl from '../vendor/photon/photon_rs_bg.wasm?url';

let _photonReady = null;

export async function ensurePhoton() {
  if (!_photonReady) {
    _photonReady = initPhoton(photonWasmUrl).then(() => photon);
  }
  return _photonReady;
}

/**
 * Blur a single-channel mask using Photon's gaussian_blur. Staged through an
 * RGBA buffer because Photon operates on RGBA images; the red channel of the
 * result is read back as the new mask.
 *
 * @param {Uint8ClampedArray} mask
 * @param {number} W
 * @param {number} H
 * @param {number} radius  blur radius in pixels (0 returns a copy)
 * @returns {Promise<Uint8ClampedArray>}
 */
export async function featherMaskChannel(mask, W, H, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return mask.slice();
  const ph = await ensurePhoton();
  const rgba = new Uint8Array(W * H * 4);
  for (let i = 0, j = 0; i < mask.length; i++, j += 4) {
    rgba[j]     = mask[i];
    rgba[j + 1] = mask[i];
    rgba[j + 2] = mask[i];
    rgba[j + 3] = 255;
  }
  const img = new ph.PhotonImage(rgba, W, H);
  ph.gaussian_blur(img, r);
  const out = img.get_raw_pixels();
  img.free();
  const result = new Uint8ClampedArray(W * H);
  for (let i = 0, j = 0; i < result.length; i++, j += 4) {
    result[i] = out[j];
  }
  return result;
}

/**
 * Gaussian-blur the entire RGBA buffer of an ImageData and return the raw
 * pixel bytes. Caller owns the returned Uint8Array.
 *
 * @param {ImageData} imageData
 * @param {number} radius
 * @returns {Promise<Uint8Array>}
 */
export async function blurImageDataPixels(imageData, radius) {
  const r = Math.max(0, Math.round(radius));
  if (r === 0) return new Uint8Array(imageData.data);
  const ph = await ensurePhoton();
  const img = new ph.PhotonImage(new Uint8Array(imageData.data), imageData.width, imageData.height);
  ph.gaussian_blur(img, r);
  const out = img.get_raw_pixels();
  img.free();
  return out;
}
