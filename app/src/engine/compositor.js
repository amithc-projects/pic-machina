/**
 * ImageChef — Compositor
 * Combines multiple processed image blobs into GIF, MP4, or contact sheets.
 */

/**
 * Create an animated GIF from an array of image Blobs.
 * @param {Blob[]}  frames
 * @param {number}  delay    — ms per frame
 * @param {boolean} loop
 * @returns {Promise<Blob>}
 */
export async function createGIF(frames, { delay = 200, loop = true } = {}) {
  const GIF = (await import('gif.js')).default;

  return new Promise(async (resolve, reject) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: '/gif.worker.js',
      repeat: loop ? 0 : -1,
    });

    for (const blob of frames) {
      const url = URL.createObjectURL(blob);
      await new Promise((imgResolve, imgReject) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          canvas.getContext('2d').drawImage(img, 0, 0);
          gif.addFrame(canvas, { delay });
          URL.revokeObjectURL(url);
          imgResolve();
        };
        img.onerror = () => { URL.revokeObjectURL(url); imgReject(new Error('Image load failed')); };
        img.src = url;
      });
    }

    gif.on('finished', blob => resolve(blob));
    gif.on('error',    err  => reject(err));
    gif.render();
  });
}

/**
 * Create an MP4 video slideshow using the VideoEncoder API.
 * @param {Blob[]}  frames
 * @param {number}  durationPerSlide — seconds per frame
 * @param {number}  fps
 * @returns {Promise<Blob>}
 */
export async function createVideo(frames, { durationPerSlide = 2, fps = 30 } = {}) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');

  // Load first frame to get dimensions (createImageBitmap works in Web Workers)
  const firstBmp = await createImageBitmap(frames[0]);
  const { width, height } = { width: firstBmp.width, height: firstBmp.height };
  firstBmp.close?.();

  // Ensure even dimensions (required by H.264)
  const w = width  % 2 === 0 ? width  : width  - 1;
  const h = height % 2 === 0 ? height : height - 1;

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: 'avc', width: w, height: h },
    fastStart: 'in-memory',
  });

  // Wrap encoding in a promise so encoder errors are catchable
  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  err => reject(new Error(`VideoEncoder error: ${err.message}`)),
    });

    encoder.configure({
      codec:     'avc1.42001f',
      width:      w,
      height:     h,
      bitrate:    5_000_000,
      framerate:  fps,
    });

    const framesPerSlide = Math.round(fps * durationPerSlide);
    let frameIndex = 0;

    // Encode each blob using ImageBitmap directly — avoids OffscreenCanvas polyfill issues in workers
    (async () => {
      try {
        for (const blob of frames) {
          // Resize to target dimensions at decode time
          const bmp = await createImageBitmap(blob, { resizeWidth: w, resizeHeight: h, resizeQuality: 'medium' });

          for (let f = 0; f < framesPerSlide; f++) {
            if (encoder.state === 'closed') throw new Error('VideoEncoder was closed unexpectedly');
            const ts = frameIndex * (1_000_000 / fps); // microseconds
            const vf = new VideoFrame(bmp, { timestamp: ts });
            encoder.encode(vf, { keyFrame: f === 0 });
            vf.close();
            frameIndex++;
          }
          bmp.close();
        }
        await encoder.flush();
        encoder.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    })();
  });

  muxer.finalize();

  return new Blob([target.buffer], { type: 'video/mp4' });
}

/**
 * Create a contact sheet (grid of thumbnails) from an array of image Blobs.
 * @param {Blob[]}  images
 * @param {number}  columns
 * @param {number}  gap       — px between cells
 * @param {number}  cellSize  — thumbnail size (auto if 0)
 * @returns {Promise<Blob>}
 */
export async function createContactSheet(images, { columns = 4, gap = 8, cellSize = 0 } = {}) {
  // createImageBitmap works in both main thread and Web Workers (no new Image() needed)
  const loaded = await Promise.all(images.map(blob => createImageBitmap(blob)));

  const cols = Math.min(columns, loaded.length);
  const rows = Math.ceil(loaded.length / cols);

  // Auto cell size based on first image
  const cs = cellSize || Math.round(1200 / cols);
  const canvasW = cols * cs + (cols - 1) * gap;
  const canvasH = rows * cs + (rows - 1) * gap;

  const canvas = document.createElement('canvas');
  canvas.width = canvasW; canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(0, 0, canvasW, canvasH);

  for (let i = 0; i < loaded.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x   = col * (cs + gap);
    const y   = row * (cs + gap);
    const bmp = loaded[i];

    // Cover-fit into cell (ImageBitmap uses .width/.height)
    const scale = Math.max(cs / bmp.width, cs / bmp.height);
    const sw = Math.round(bmp.width  * scale);
    const sh = Math.round(bmp.height * scale);
    const sx = Math.round((sw - cs) / 2);
    const sy = Math.round((sh - cs) / 2);

    const tmp = document.createElement('canvas'); tmp.width = sw; tmp.height = sh;
    tmp.getContext('2d').drawImage(bmp, 0, 0, sw, sh);
    ctx.drawImage(tmp, sx, sy, cs, cs, x, y, cs, cs);

    bmp.close?.(); // free memory
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.9);
  });
}
