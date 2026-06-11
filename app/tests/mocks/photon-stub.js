/**
 * Stub for photon_rs WASM — returns identity operations so canvas tests
 * can exercise transform registration and no-crash paths without loading WASM.
 */

export class Rgb {
  constructor(r, g, b) { this.r = r; this.g = g; this.b = b; }
}

export class PhotonImage {
  constructor(data, width, height) {
    this._data   = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.width   = width;
    this.height  = height;
  }
  get_raw_pixels() { return this._data; }
  free() {}
}

export function invert()              {}
export function adjust_contrast()     {}
export function saturate_hsl()        {}
export function desaturate_hsl()      {}
export function hsl()                 {}
export function vibrance()            {}
export function brighten_two()        {}
export function inc_brightness()      {}
export function adjust_hue()          {}
export function colorize()            {}
export function sepia()               {}
export function grayscale()           {}
export function grayscale_human_corrected() {}
export function decompose_min()       {}
export function decompose_max()       {}
export function tint()                {}
export function duotone()             {}
export function posterize()           {}
export function solarize()            {}
export function box_blur()            {}
export function gaussian_blur()       {}
export function sharpen()             {}
export function edge_detection()      {}
export function sobel_horizontal()    {}
export function sobel_vertical()      {}
export function emboss()              {}
export function noise_reduction()     {}
export function halftone()            {}
export function threshold()           {}
export function erode()               {}
export function dilate()              {}
export function swap_channels(pimg, channelA, channelB) {
  const data = pimg._data;
  for (let i = 0; i < data.length; i += 4) {
    const tmp = data[i + channelA];
    data[i + channelA] = data[i + channelB];
    data[i + channelB] = tmp;
  }
}
export function alter_channel()          {}
export function alter_red_channel()      {}
export function alter_blue_channel()     {}
export function remove_red_channel()     {}
export function remove_green_channel()   {}
export function remove_blue_channel()    {}
export function oil()                    {}
export function adjust_brightness()      {}
export function apply_watermark()        {}
export function blend()                  {}
export function channel_to_grayscale()   {}

export default async function init() { return {}; }
