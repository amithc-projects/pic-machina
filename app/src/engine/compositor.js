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

/**
 * Create an animated photo-stack — photos appear one by one as polaroid prints on a desk.
 * Outputs either an animated GIF or an MP4 video.
 *
 * @param {Blob[]}  blobs        — one blob per photo (already processed)
 * @param {object}  opts
 * @param {number}  opts.width          — output canvas width  (default 1920)
 * @param {number}  opts.height         — output canvas height (default 1080)
 * @param {string}  opts.deskColor      — desk background colour (default '#3d2b1a')
 * @param {number}  opts.frameDelay     — ms between each photo appearing (default 800)
 * @param {number}  opts.maxRotation    — max rotation ± degrees (default 35)
 * @param {string}  opts.borderColor    — polaroid frame colour (default '#f5f5f0')
 * @param {number}  opts.borderBottom   — thick caption border height px (default 60)
 * @param {string}  opts.format         — 'gif' | 'mp4' (default 'gif')
 * @param {number}  opts.fps            — video fps, mp4 only (default 30)
 * @returns {Promise<Blob>}
 */
/**
 * Generic animated stack — frames appear one by one on a desk surface.
 * No polaroid framing — use overlay-polaroid-frame upstream if desired.
 */
export async function createAnimatedStack(blobs, {
  width       = 1920,
  height      = 1080,
  deskColor   = '#3d2b1a',
  frameDelay  = 800,
  maxRotation = 35,
  overlap     = 0,
  format      = 'gif',
  fps         = 30,
} = {}) {
  const bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
  const N = bitmaps.length;
  if (N === 0) throw new Error('[createAnimatedStack] No frames to compose');

  function rand(seed) {
    let s = (seed + 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  }

  const aspect    = width / height;
  const cols      = Math.max(1, Math.round(Math.sqrt(N * aspect)));
  const rows      = Math.ceil(N / cols);
  const cellW     = width  / cols;
  const cellH     = height / rows;
  const cellScale = 0.70 + (Math.min(90, Math.max(0, overlap)) / 100) * 0.80;

  const layout = bitmaps.map((bmp, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const scale = Math.min((cellW * cellScale) / bmp.width, (cellH * cellScale) / bmp.height, 1);
    const fw = Math.round(bmp.width * scale), fh = Math.round(bmp.height * scale);
    const cx  = cellW * (col + 0.5) + (rand(i * 3 + 0) * 2 - 1) * cellW * 0.14;
    const cy  = cellH * (row + 0.5) + (rand(i * 3 + 1) * 2 - 1) * cellH * 0.14;
    const rot = (rand(i * 3 + 2) * 2 - 1) * maxRotation;
    return { bmp, cx, cy, rot, fw, fh };
  });

  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  function drawDesk() {
    ctx.fillStyle = deskColor;
    ctx.fillRect(0, 0, width, height);
    ctx.save(); ctx.globalAlpha = 0.04; ctx.fillStyle = '#000';
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    ctx.restore();
  }

  function drawFrame(item, dropShadow) {
    const { bmp, cx, cy, rot, fw, fh } = item;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * Math.PI / 180);
    if (dropShadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 22;
      ctx.shadowOffsetX = 5; ctx.shadowOffsetY = 9;
    }
    ctx.drawImage(bmp, -fw / 2, -fh / 2, fw, fh);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.restore();
  }

  if (format !== 'mp4') {
    const GIF = (await import('gif.js')).default;
    return new Promise((resolve, reject) => {
      const gif = new GIF({ workers: 2, quality: 8, workerScript: '/gif.worker.js', repeat: 0 });
      drawDesk();
      gif.addFrame(canvas, { delay: Math.round(frameDelay * 0.6), copy: true });
      for (let k = 0; k < N; k++) {
        drawDesk();
        for (let j = 0; j <= k; j++) drawFrame(layout[j], j === k);
        gif.addFrame(canvas, { delay: k === N - 1 ? frameDelay * 4 : frameDelay, copy: true });
      }
      gif.on('finished', resolve);
      gif.on('error',    reject);
      gif.render();
    });
  }

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const w = width  % 2 === 0 ? width  : width  - 1;
  const h = height % 2 === 0 ? height : height - 1;
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });

  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  err => reject(new Error(`VideoEncoder: ${err.message}`)),
    });
    encoder.configure({ codec: 'avc1.42001f', width: w, height: h, bitrate: 6_000_000, framerate: fps });
    const framesPerScene = Math.max(1, Math.round(fps * frameDelay / 1000));
    let fi = 0;

    async function encodeCanvas(hold) {
      const bmp   = await createImageBitmap(canvas, { resizeWidth: w, resizeHeight: h });
      const count = hold ? framesPerScene * 4 : framesPerScene;
      for (let f = 0; f < count; f++) {
        const vf = new VideoFrame(bmp, { timestamp: fi * (1_000_000 / fps) });
        encoder.encode(vf, { keyFrame: f === 0 }); vf.close(); fi++;
      }
      bmp.close();
    }

    (async () => {
      try {
        drawDesk(); await encodeCanvas(false);
        for (let k = 0; k < N; k++) {
          drawDesk();
          for (let j = 0; j <= k; j++) drawFrame(layout[j], j === k);
          await encodeCanvas(k === N - 1);
        }
        await encoder.flush(); encoder.close(); resolve();
      } catch (err) { reject(err); }
    })();
  });

  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}

// ── Handwriting font loader ────────────────────────────────
export async function loadHandwritingFont() {
  if (typeof document === 'undefined' || !document.fonts) return 'cursive';
  const name = 'Dancing Script';
  if (document.fonts.check(`600 16px "${name}"`)) return name;
  try {
    if (!document.querySelector('link[data-gfont="dancing-script"]')) {
      const link = document.createElement('link');
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600&display=swap';
      link.dataset.gfont = 'dancing-script';
      document.head.appendChild(link);
    }
    await document.fonts.load(`600 16px "${name}"`);
    return name;
  } catch {
    return 'cursive';
  }
}

// ── Caption drawing ────────────────────────────────────────
export function drawCaption(ctx, text, fw, fh, ph, borderTop, borderBottom, borderSide, fontName) {
  if (!text) return;
  const cx   = 0;
  const cy   = -fh / 2 + borderTop + ph + borderBottom / 2;
  const maxW = fw - borderSide;  // generous — just avoid hard edges

  let size = Math.round(Math.min(borderBottom * 0.42, (borderBottom - 8) * 0.8));
  ctx.save();
  ctx.fillStyle    = '#2a2a2a';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  while (size >= 8) {
    ctx.font = `600 ${size}px "${fontName}", cursive`;
    if (ctx.measureText(text).width <= maxW) break;
    size--;
  }
  // No maxWidth arg — the shrink loop above already ensures it fits
  ctx.fillText(text, cx, cy);
  ctx.restore();
}

export async function createPhotoStack(blobs, {
  width        = 1920,
  height       = 1080,
  deskColor    = '#3d2b1a',
  frameDelay   = 800,
  maxRotation  = 35,
  borderColor  = '#f5f5f0',
  borderBottom = 60,
  format       = 'gif',
  fps          = 30,
  captions     = [],
  overlap      = 0,
} = {}) {
  const bitmaps = await Promise.all(blobs.map(b => createImageBitmap(b)));
  const N = bitmaps.length;
  if (N === 0) throw new Error('[createPhotoStack] No frames to compose');

  // ── Deterministic pseudo-random (seeded, no Math.random) ──
  function rand(seed) {
    let s = (seed + 0x9e3779b9) >>> 0;
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    s = Math.imul(s ^ (s >>> 16), 0x45d9f3b);
    return ((s ^ (s >>> 16)) >>> 0) / 0xffffffff;
  }

  // ── Aspect-ratio-aware grid layout ────────────────────────
  const aspect = width / height;
  const cols   = Math.max(1, Math.round(Math.sqrt(N * aspect)));
  const rows   = Math.ceil(N / cols);
  const cellW  = width  / cols;
  const cellH  = height / rows;

  const borderSide = Math.max(10, Math.round(borderBottom / 3));
  const borderTop  = borderSide;

  // overlap (0–90) controls how much polaroids extend beyond their grid cell.
  // 0 = ~70% of cell (clear separation); 90 = ~150% (heavy stacking).
  const cellScale = 0.70 + (Math.min(90, Math.max(0, overlap)) / 100) * 0.80;

  // Pre-compute position, rotation, and frame size for each photo
  const layout = bitmaps.map((bmp, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Scale photo to fill cell with room for the polaroid frame and padding
    const maxPhotoW = cellW * cellScale - borderSide * 2;
    const maxPhotoH = cellH * cellScale - borderTop - borderBottom;
    const scale     = Math.min(maxPhotoW / bmp.width, maxPhotoH / bmp.height, 1);
    const pw = Math.round(bmp.width  * scale);
    const ph = Math.round(bmp.height * scale);
    const fw = pw + borderSide * 2;
    const fh = ph + borderTop + borderBottom;

    // Cell-centre + bounded jitter
    const cx  = cellW * (col + 0.5) + (rand(i * 3 + 0) * 2 - 1) * cellW * 0.14;
    const cy  = cellH * (row + 0.5) + (rand(i * 3 + 1) * 2 - 1) * cellH * 0.14;
    const rot = (rand(i * 3 + 2) * 2 - 1) * maxRotation;

    return { bmp, cx, cy, rot, pw, ph, fw, fh, caption: captions[i] ?? '' };
  });

  // Load handwriting font before drawing any frames
  const fontName = await loadHandwritingFont();

  // ── Canvas helpers ─────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  function drawDesk() {
    ctx.fillStyle = deskColor;
    ctx.fillRect(0, 0, width, height);
    // Subtle wood grain lines
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#000';
    for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);
    ctx.restore();
  }

  /**
   * Draw a single polaroid onto the shared canvas.
   * @param {object}  item        — layout entry
   * @param {boolean} dropShadow — true for the most-recently-placed photo
   */
  function drawPolaroid(item, dropShadow) {
    const { bmp, cx, cy, rot, pw, ph, fw, fh, caption } = item;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot * Math.PI / 180);

    if (dropShadow) {
      ctx.shadowColor   = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur    = 22;
      ctx.shadowOffsetX = 5;
      ctx.shadowOffsetY = 9;
    }
    // Polaroid frame (white card)
    ctx.fillStyle = borderColor;
    ctx.fillRect(-fw / 2, -fh / 2, fw, fh);

    // Clear shadow before drawing photo and text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;

    // Photo sits at the top of the frame, centred horizontally
    ctx.drawImage(bmp, -pw / 2, -fh / 2 + borderTop, pw, ph);

    // Handwritten caption in the bottom white border
    drawCaption(ctx, caption, fw, fh, ph, borderTop, borderBottom, borderSide, fontName);

    ctx.restore();
  }

  // ── GIF output ────────────────────────────────────────────
  if (format !== 'mp4') {
    const GIF = (await import('gif.js')).default;

    return new Promise((resolve, reject) => {
      const gif = new GIF({ workers: 2, quality: 8, workerScript: '/gif.worker.js', repeat: 0 });

      // Frame 0: empty desk (slightly shorter hold)
      drawDesk();
      gif.addFrame(canvas, { delay: Math.round(frameDelay * 0.6), copy: true });

      for (let k = 0; k < N; k++) {
        drawDesk();
        for (let j = 0; j <= k; j++) drawPolaroid(layout[j], j === k);
        // Hold the final frame longer so viewers can take it in
        gif.addFrame(canvas, { delay: k === N - 1 ? frameDelay * 4 : frameDelay, copy: true });
      }

      gif.on('finished', resolve);
      gif.on('error',    reject);
      gif.render();
    });
  }

  // ── MP4 output ────────────────────────────────────────────
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const w = width  % 2 === 0 ? width  : width  - 1;
  const h = height % 2 === 0 ? height : height - 1;

  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });

  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  err => reject(new Error(`VideoEncoder: ${err.message}`)),
    });
    encoder.configure({ codec: 'avc1.42001f', width: w, height: h, bitrate: 6_000_000, framerate: fps });

    const framesPerScene = Math.max(1, Math.round(fps * frameDelay / 1000));
    let fi = 0;

    async function encodeCurrentCanvas(hold) {
      const bmp   = await createImageBitmap(canvas, { resizeWidth: w, resizeHeight: h });
      const count = hold ? framesPerScene * 4 : framesPerScene;
      for (let f = 0; f < count; f++) {
        const vf = new VideoFrame(bmp, { timestamp: fi * (1_000_000 / fps) });
        encoder.encode(vf, { keyFrame: f === 0 });
        vf.close();
        fi++;
      }
      bmp.close();
    }

    (async () => {
      try {
        drawDesk();
        await encodeCurrentCanvas(false);

        for (let k = 0; k < N; k++) {
          drawDesk();
          for (let j = 0; j <= k; j++) drawPolaroid(layout[j], j === k);
          await encodeCurrentCanvas(k === N - 1);
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
