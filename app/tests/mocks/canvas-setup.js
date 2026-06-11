/**
 * Polyfill document.createElement('canvas') using @napi-rs/canvas
 * so transform apply() functions that call ctx.getImageData / putImageData
 * work in Node without a browser.
 */
import { createCanvas, Canvas, Image } from '@napi-rs/canvas';

global.document = global.document || {};

const _origCreate = global.document.createElement?.bind(global.document);
global.document.createElement = (tag) => {
  if (tag === 'canvas') return createCanvas(1, 1);
  return _origCreate?.(tag) ?? { style: {} };
};

global.Image = Image;
global.createCanvas = createCanvas;

// Minimal ImageData shim (Node's canvas provides real ImageData but some
// code imports it from the global scope).
if (!global.ImageData) {
  global.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data   = dataOrWidth;
        this.width  = widthOrHeight;
        this.height = height;
      } else {
        this.width  = dataOrWidth;
        this.height = widthOrHeight;
        this.data   = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}
