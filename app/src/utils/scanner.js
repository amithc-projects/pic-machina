/**
 * PicMachina — Computer Vision Scanner Delegate
 * 
 * Offloads OpenCV execution into a dedicated Web Worker to prevent
 * massive script parsing from permanently locking the UI thread.
 */

import { uuid } from './misc.js';

let _worker = null;
let _msgId = 0;
const _callbacks = {};

function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('./scanner.worker.js', import.meta.url));
    _worker.onmessage = (e) => {
      const { id, results, error } = e.data;
      if (_callbacks[id]) {
        if (error) _callbacks[id].reject(new Error(error));
        else _callbacks[id].resolve(results);
        delete _callbacks[id];
      }
    };
    _worker.onerror = (err) => {
      console.error('[scanner] Worker error:', err);
    };
  }
  return _worker;
}

export async function detectQuadrilaterals(imageBlob) {
  // Extract pixels on the main thread
  const bmp = await createImageBitmap(imageBlob);
  const W = bmp.width;
  const H = bmp.height;
  
  const maxDim = 800;
  const scale = (W > maxDim || H > maxDim) ? (maxDim / Math.max(W, H)) : 1;
  const processW = Math.round(W * scale);
  const processH = Math.round(H * scale);
  
  const cvs = document.createElement('canvas');
  cvs.width = processW;
  cvs.height = processH;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(bmp, 0, 0, processW, processH);
  
  // Get raw pixel buffer
  const imageData = ctx.getImageData(0, 0, processW, processH);
  bmp.close();

  return new Promise((resolve, reject) => {
    const id = ++_msgId;
    _callbacks[id] = { 
       resolve: (rawResults) => {
          resolve(rawResults.map(r => ({
             id: uuid(),
             fitMode: 'cover',
             points: r.points
          })));
       }, 
       reject 
    };

    // Send array buffer over to worker
    getWorker().postMessage({
       id,
       imageData: imageData.data,
       width: processW,
       height: processH
    }, [imageData.data.buffer]);
  });
}
