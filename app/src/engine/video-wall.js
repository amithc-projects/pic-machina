/**
 * PicMachina — Video Wall
 *
 * Composites multiple input video files into a single MP4 output using
 * configurable layout templates.
 *
 * Architecture:
 *   - mp4box.js    demux MP4 containers → EncodedVideoChunk[]
 *   - VideoStream  streaming WebCodecs decoder — decodes on-demand, releases past frames
 *   - Canvas 2D    compositing: rect cells + mesh-warp perspective for quad cells
 *   - VideoEncoder + mp4-muxer → output MP4 Blob
 *
 * Memory model: encoded chunks (compressed) are held for the full duration.
 * Decoded VideoFrames are released as the compositing cursor advances.
 * Peak memory ≈ LOOKAHEAD_US × N_streams (not total_duration × N_streams).
 */

import { loadHandwritingFont } from './compositor.js';
import { drawPerspectiveCell } from './utils/perspective.js';

// ─── Streaming VideoStream ─────────────────────────────────

class VideoStream {
  /**
   * @param {EncodedVideoChunk[]} encodedChunks
   * @param {string}              codecString
   * @param {Uint8Array|null}     description   — avcC / hvcC config record
   * @param {number}              durationUs
   */
  constructor(encodedChunks, codecString, description, durationUs) {
    this.encodedChunks = encodedChunks;
    this.durationUs    = durationUs;
    this.exhausted     = false;
    this._buffer       = [];   // decoded VideoFrames, sorted by timestamp
    this._chunkIdx     = 0;    // next chunk index to feed to the decoder
    this._decoder      = this._createDecoder(codecString, description);
  }

  _createDecoder(codec, description) {
    const dec = new VideoDecoder({
      output: (f) => this._buffer.push(f),
      error:  (e) => console.warn('[VideoStream decoder]', e),
    });
    const config = { codec, hardwareAcceleration: 'prefer-hardware' };
    if (description) config.description = description;
    dec.configure(config);
    // Skip any leading non-keyframes (decoder requires a keyframe first)
    while (this._chunkIdx < this.encodedChunks.length &&
           this.encodedChunks[this._chunkIdx].type !== 'key') {
      this._chunkIdx++;
    }
    return dec;
  }

  /**
   * Decode forward until the buffer contains a frame at or past targetTs.
   * Safe to call on every compositing frame — returns immediately if already buffered.
   */
  async ensureBufferedTo(targetTs) {
    if (this._chunkIdx >= this.encodedChunks.length) return;
    const last = this._buffer[this._buffer.length - 1];
    if (last && last.timestamp >= targetTs) return;

    while (
      this._chunkIdx < this.encodedChunks.length &&
      (this._buffer.length === 0 ||
       this._buffer[this._buffer.length - 1].timestamp < targetTs)
    ) {
      this._decoder.decode(this.encodedChunks[this._chunkIdx++]);
    }
    await this._decoder.flush();
  }

  /**
   * Return the VideoFrame most appropriate for targetTs.
   * Releases frames that are strictly before the chosen frame.
   * Returns null if this stream is exhausted.
   * Does NOT transfer frame ownership — do not close the returned frame.
   */
  getFrameAt(targetTs) {
    if (this.exhausted) return null;
    if (targetTs > this.durationUs) {
      this.exhausted = true;
      return null;
    }

    // Find index of last frame with timestamp ≤ targetTs
    let bestIdx = -1;
    for (let i = 0; i < this._buffer.length; i++) {
      if (this._buffer[i].timestamp <= targetTs) bestIdx = i;
      else break;
    }

    if (bestIdx < 0) return this._buffer[0] ?? null; // pre-roll: show first frame

    // Release everything before bestIdx (no longer reachable going forward)
    for (let i = 0; i < bestIdx; i++) try { this._buffer[i].close(); } catch {}
    this._buffer.splice(0, bestIdx);

    return this._buffer[0] ?? null;
  }

  close() {
    for (const f of this._buffer) try { f.close(); } catch {}
    this._buffer = [];
    if (this._decoder?.state !== 'closed') try { this._decoder.close(); } catch {}
  }

  reset() {
    this.exhausted = false;
    for (const f of this._buffer) try { f.close(); } catch {}
    this._buffer = [];
    this._chunkIdx = 0;
    if (this._decoder?.state !== 'closed') try { this._decoder.close(); } catch {}
    this._decoder = this._createDecoder(this.codecString, this.description);
  }
}

// ─── Template system ──────────────────────────────────────
//
// A template cell is one of:
//   { type: 'rect', x, y, w, h, fitMode }
//   { type: 'quad', quad: [TL, TR, BR, BL], fitMode, subdivisions }
//     where each corner is { x, y } in output-canvas pixels.

function makeGridCells(cols, rows, w, h, fitMode = 'cover') {
  const cw = Math.floor(w / cols);
  const ch = Math.floor(h / rows);
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ type: 'rect', x: c * cw, y: r * ch, w: cw, h: ch, fitMode });
    }
  }
  return cells;
}

/**
 * Template registry.
 *
 * getCells(w, h)                    → Cell[]
 * drawBackground(ctx, w, h, cells)  → void   (null = black canvas only)
 */
const TEMPLATES = {
  'grid-2x2': {
    name: '2×2 Grid',
    maxStreams: 4,
    getCells: (w, h) => makeGridCells(2, 2, w, h, 'cover'),
    drawBackground: null,
  },
  'grid-3x3': {
    name: '3×3 Grid',
    maxStreams: 9,
    getCells: (w, h) => makeGridCells(3, 3, w, h, 'cover'),
    drawBackground: null,
  },
  'grid-4x4': {
    name: '4×4 Grid',
    maxStreams: 16,
    getCells: (w, h) => makeGridCells(4, 4, w, h, 'cover'),
    drawBackground: null,
  },
  'split-1x2': {
    name: 'Side by Side',
    maxStreams: 2,
    getCells: (w, h) => makeGridCells(2, 1, w, h, 'contain'),
    drawBackground: null,
  },
  'custom-tv': {
    name: 'TV Room (Perspective)',
    maxStreams: 1,
    /**
     * A single widescreen panel viewed from slightly left:
     *   - Left edge closer → taller in screen space (670 px)
     *   - Right edge further → shorter (600 px)
     *   - Mild horizontal trapezoid gives convincing depth without WebGL
     */
    getCells: (w, h) => [{
      type: 'quad',
      quad: [
        { x: w * 0.24, y: h * 0.14 },   // TL — left / top  (closer)
        { x: w * 0.82, y: h * 0.19 },   // TR — right / top (further)
        { x: w * 0.80, y: h * 0.75 },   // BR — right / bottom
        { x: w * 0.22, y: h * 0.76 },   // BL — left / bottom
      ],
      fitMode: 'cover',
      subdivisions: 8,   // 8×8 = 128 triangles — visually indistinguishable from 12 for mild perspective
    }],
    drawBackground: drawTVRoomBackground,
  },
};

// ─── TV Room background painter ───────────────────────────

function drawTVRoomBackground(ctx, w, h, cells) {
  const quad = cells[0]?.quad;

  // ── Wall ──
  ctx.fillStyle = '#1c1c2e';
  ctx.fillRect(0, 0, w, h);

  // Subtle vignette gradient
  const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.1, w / 2, h / 2, h * 0.9);
  vignette.addColorStop(0, 'rgba(40,40,80,0.2)');
  vignette.addColorStop(1, 'rgba(5,5,15,0.6)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);

  // ── Floor ──
  const floorY = Math.round(h * 0.87);
  ctx.fillStyle = '#12121e';
  ctx.fillRect(0, floorY, w, h - floorY);

  // Floor edge highlight
  ctx.fillStyle = '#2a2a40';
  ctx.fillRect(0, floorY, w, 3);

  if (!quad) return;

  const [TL, TR, BR, BL] = quad;
  const cx = (TL.x + TR.x + BR.x + BL.x) / 4;
  const cy = (TL.y + TR.y + BR.y + BL.y) / 4;

  // ── Ambient screen glow (drawn before bezel so bezel occludes it) ──
  const glowR = Math.hypot(TR.x - TL.x, TR.y - TL.y) * 0.9;
  const glow  = ctx.createRadialGradient(cx, cy, glowR * 0.1, cx, cy, glowR);
  glow.addColorStop(0, 'rgba(50, 70, 180, 0.18)');
  glow.addColorStop(1, 'rgba(50, 70, 180, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h);

  // ── TV bezel — expand each corner outward from centroid ──
  const BEZEL = Math.round(w * 0.016);  // ~31 px at 1920
  function expandPt(pt, px) {
    const dx = pt.x - cx, dy = pt.y - cy;
    const d  = Math.hypot(dx, dy);
    return { x: pt.x + (dx / d) * px, y: pt.y + (dy / d) * px };
  }
  const eTL = expandPt(TL, BEZEL), eTR = expandPt(TR, BEZEL);
  const eBR = expandPt(BR, BEZEL), eBL = expandPt(BL, BEZEL);

  // Outer bezel body
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.moveTo(eTL.x, eTL.y);
  ctx.lineTo(eTR.x, eTR.y);
  ctx.lineTo(eBR.x, eBR.y);
  ctx.lineTo(eBL.x, eBL.y);
  ctx.closePath();
  ctx.fill();

  // Bezel top-edge highlight (simulates studio light catching the rim)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(eTL.x + 3, eTL.y + 2);
  ctx.lineTo(eTR.x - 3, eTR.y + 2);
  ctx.stroke();

  // Inner screen border (hair-line, very dark)
  ctx.strokeStyle = '#080808';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(TL.x, TL.y);
  ctx.lineTo(TR.x, TR.y);
  ctx.lineTo(BR.x, BR.y);
  ctx.lineTo(BL.x, BL.y);
  ctx.closePath();
  ctx.stroke();

  // ── TV stand ──
  const standCX   = Math.round((BL.x + BR.x) / 2);
  const standTopY = Math.round(Math.max(eBL.y, eBR.y));
  const standW    = Math.round(w * 0.055);
  const standH    = floorY - standTopY;

  if (standH > 4) {
    // Neck
    ctx.fillStyle = '#111';
    ctx.fillRect(standCX - Math.round(standW / 2), standTopY, standW, standH);
    // Base
    const baseW = Math.round(standW * 2.2);
    ctx.fillStyle = '#0d0d0d';
    ctx.fillRect(standCX - Math.round(baseW / 2), floorY - 5, baseW, 8);
  }
}

// ─── Cell drawing — rectangular ───────────────────────────

/**
 * Draw a VideoFrame (or ImageBitmap) into a rectangular cell.
 * cover  — center-crop to fill the cell exactly
 * contain — letterbox with black bars
 */
function drawRectCell(ctx, source, x, y, w, h, fitMode) {
  const sw = source.displayWidth  ?? source.codedWidth  ?? source.width;
  const sh = source.displayHeight ?? source.codedHeight ?? source.height;

  if (fitMode === 'cover') {
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    const ox = (dw - w) / 2, oy = (dh - h) / 2;
    ctx.drawImage(source, ox / scale, oy / scale, w / scale, h / scale, x, y, w, h);
  } else {
    const scale = Math.min(w / sw, h / sh);
    const dw = sw * scale, dh = sh * scale;
    const ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.drawImage(source, 0, 0, sw, sh, ox, oy, dw, dh);
  }
}

// ─── Cell drawing — perspective (mesh warp) ───────────────
// Extracted to src/engine/utils/perspective.js

/** Dispatch rendering to the appropriate draw function for the cell type. */
function drawCellContent(ctx, source, cell) {
  if (cell.type === 'quad') {
    drawPerspectiveCell(ctx, source, cell.quad, cell.subdivisions ?? 12);
  } else {
    drawRectCell(ctx, source, cell.x, cell.y, cell.w, cell.h, cell.fitMode ?? 'cover');
  }
}

// ─── Bounding-box helper ──────────────────────────────────

function cellBounds(cell) {
  if (cell.type === 'quad') {
    const xs = cell.quad.map(p => p.x), ys = cell.quad.map(p => p.y);
    const x = Math.min(...xs), y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }
  return { x: cell.x, y: cell.y, w: cell.w, h: cell.h };
}

// ─── End-of-video fallback ────────────────────────────────

function drawEndOfVideo(ctx, cell, endOfVideo, endText, fallbackBitmap) {
  if (endOfVideo === 'image' && fallbackBitmap) {
    drawCellContent(ctx, fallbackBitmap, cell);
    return;
  }

  // Fill the cell area with black — use exact quad shape for perspective cells
  if (cell.type === 'quad') {
    const [TL, TR, BR, BL] = cell.quad;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(TL.x, TL.y);
    ctx.lineTo(TR.x, TR.y);
    ctx.lineTo(BR.x, BR.y);
    ctx.lineTo(BL.x, BL.y);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#000';
    ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
  }

  if (endOfVideo === 'text') {
    const { x, y, w, h } = cellBounds(cell);
    const text = endText || 'No Signal Detected';
    const size = Math.max(10, Math.round(h * 0.06));
    ctx.save();
    ctx.fillStyle    = '#00ff41';
    ctx.font         = `bold ${size}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + h / 2);
    ctx.restore();
  }
}

// ─── Caption drawing ──────────────────────────────────────

function drawCellCaption(ctx, text, cell, fontName) {
  if (!text) return;
  // Quad cells: skip caption (perspective-corrected caption text is a future enhancement)
  if (cell.type === 'quad') return;

  const { x, y, w, h } = cellBounds(cell);
  const stripH = Math.max(16, Math.round(h * 0.08));
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(x, y + h - stripH, w, stripH);

  ctx.save();
  ctx.fillStyle    = '#fff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.round(stripH * 0.55);
  while (size >= 8) {
    ctx.font = `600 ${size}px "${fontName}", cursive`;
    if (ctx.measureText(text).width <= w - 16) break;
    size--;
  }
  ctx.fillText(text, x + w / 2, y + h - stripH / 2);
  ctx.restore();
}

// ─── MP4 demuxer (mp4box.js) ──────────────────────────────

/**
 * Demux a video File using mp4box.js.
 * Returns encoded chunks + codec metadata — does NOT decode frames.
 *
 * @returns {Promise<{ encodedChunks, codecString, description, durationUs }>}
 */
async function demuxVideoFile(file) {
  const MP4Box = (await import('mp4box')).default;

  return new Promise((resolve, reject) => {
    const mp4 = MP4Box.createFile();
    let codecString     = null;
    let durationUs      = 0;
    let totalSamples    = 0;
    let receivedSamples = 0;
    let allDataFed      = false;
    let description     = null;
    const encodedChunks = [];

    function checkDone() {
      if (allDataFed && totalSamples > 0 && receivedSamples >= totalSamples) {
        resolve({ encodedChunks, codecString, durationUs, description });
      }
    }

    mp4.onReady = (info) => {
      const track = info.videoTracks[0];
      if (!track) { reject(new Error(`[video-wall] No video track in "${file.name}"`)); return; }
      codecString  = track.codec;
      durationUs   = (track.duration / track.timescale) * 1_000_000;
      totalSamples = track.nb_samples;

      // Extract AVCDecoderConfigurationRecord (avcC) needed by VideoDecoder for H.264
      try {
        const trak  = mp4.getTrackById(track.id);
        const entry = trak.mdia.minf.stbl.stsd.entries[0];
        const box   = entry.avcC || entry.hvcC || entry.vpcC;
        if (box) {
          const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
          box.write(stream);
          description = new Uint8Array(stream.buffer, 8); // skip 8-byte box header
        }
      } catch (e) {
        console.warn('[video-wall] Could not extract codec description:', e);
      }

      mp4.setExtractionOptions(track.id, null, { nbSamples: totalSamples });
      mp4.start();
    };

    mp4.onSamples = (_id, _user, samples) => {
      for (const s of samples) {
        encodedChunks.push(new EncodedVideoChunk({
          type:      s.is_sync ? 'key' : 'delta',
          timestamp: (s.cts      / s.timescale) * 1_000_000,
          duration:  (s.duration / s.timescale) * 1_000_000,
          data:      s.data.buffer,
        }));
        receivedSamples++;
      }
      checkDone();
    };

    mp4.onError = (e) => reject(new Error(`[video-wall] mp4box error in "${file.name}": ${e}`));

    // Feed file in 4 MB chunks
    (async () => {
      const CHUNK = 4 * 1024 * 1024;
      let offset = 0;
      while (offset < file.size) {
        const buf = await file.slice(offset, offset + CHUNK).arrayBuffer();
        buf.fileStart = offset;
        mp4.appendBuffer(buf);
        offset += buf.byteLength;
      }
      mp4.flush();
      allDataFed = true;
      checkDone();
    })().catch(reject);
  });
}

// ─── Main export ──────────────────────────────────────────

/**
 * Create a video wall MP4 from N input video Files.
 *
 * @param {File[]}   videoFiles
 * @param {object}   opts
 * @param {string}   opts.layout           — template ID (see TEMPLATES)
 * @param {number}   opts.fps
 * @param {number}   opts.outputWidth
 * @param {number}   opts.outputHeight
 * @param {string[]} opts.captions         — one per sorted file
 * @param {string}   opts.endOfVideo       — 'black' | 'image' | 'text'
 * @param {string}   [opts.fallbackImageUrl]
 * @param {string}   opts.endText
 * @param {number}   opts.bitrate
 * @param {function} [opts.onProgress]     — (pct: number|null, label: string) => void
 * @returns {Promise<Blob>}
 */
export async function createVideoWall(videoFiles, {
  layout           = 'grid-2x2',
  fps              = 30,
  outputWidth      = 1920,
  outputHeight     = 1080,
  captions         = [],
  endOfVideo       = 'black',
  fallbackImageUrl = null,
  endText          = 'No Signal Detected',
  bitrate          = 8_000_000,
  onProgress       = null,
} = {}) {
  if (!videoFiles?.length) throw new Error('[video-wall] No video files provided');

  // Sort alphabetically by filename so grid order is predictable
  const sorted = [...videoFiles].sort((a, b) => a.name.localeCompare(b.name));

  // Ensure even dimensions (H.264 requirement)
  const w = outputWidth  % 2 === 0 ? outputWidth  : outputWidth  - 1;
  const h = outputHeight % 2 === 0 ? outputHeight : outputHeight - 1;

  let tpl = TEMPLATES[layout];
  let fallbackBitmap = null;
  let cells = [];
  let bgBitmap = null;

  if (tpl) {
      cells = tpl.getCells(w, h);
  } else {
      // Dynamic Layout via Template ID
      const { getTemplate } = await import('../data/templates.js');
      const storedTpl = await getTemplate(layout);
      if (!storedTpl) throw new Error(`[video-wall] Unknown layout or template: ${layout}`);

      const sortedPhs = [...(storedTpl.placeholders || [])].sort((a,b) => (a.zIndex||0) - (b.zIndex||0));

      let bgVideoStream = null;
      if (storedTpl.backgroundVideoHandle) {
          const handle = storedTpl.backgroundVideoHandle;
          const permission = await handle.queryPermission({ mode: 'read' });
          if (permission !== 'granted') {
              const request = await handle.requestPermission({ mode: 'read' });
              if (request !== 'granted') {
                  throw new Error(`[video-wall] Permission denied for background video file`);
              }
          }
          try {
              const bgFile = await handle.getFile();
              const bgDemux = await demuxVideoFile(bgFile);
              bgVideoStream = new VideoStream(bgDemux.encodedChunks, bgDemux.codecString, bgDemux.description, bgDemux.durationUs);
          } catch (err) {
              throw new Error(`[video-wall] Background video file is missing or inaccessible: ${err.message}`);
          }
      } else if (storedTpl.backgroundBlob) {
          bgBitmap = await createImageBitmap(storedTpl.backgroundBlob);
      }

      cells = sortedPhs.map(ph => ({
           type: 'quad',
           quad: ph.points.map(pt => ({
               x: pt.x * w,
               y: pt.y * h
           })),
           fitMode: ph.fitMode || 'stretch',
           subdivisions: 12
      }));

      tpl = {
          name: storedTpl.name,
          maxStreams: cells.length,
          drawBackground: (ctx, w, h, bgFrame) => {
              if (bgFrame) {
                  ctx.drawImage(bgFrame, 0, 0, w, h);
              } else if (bgBitmap) {
                  ctx.drawImage(bgBitmap, 0, 0, w, h);
              }
          },
          bgVideoStream
      };
      
      // If the template has no cells, fall back gracefully
      if (cells.length === 0) {
          cells = [{ type: 'rect', x: 0, y: 0, w, h, fitMode: 'contain' }];
      }
  }

  // Optional fallback image for end-of-video cells
  if (endOfVideo === 'image' && fallbackImageUrl) {
    try {
      const resp = await fetch(fallbackImageUrl);
      fallbackBitmap = await createImageBitmap(await resp.blob());
    } catch (e) { console.warn('[video-wall] Could not load fallback image:', e); }
  }

  const fontName = await loadHandwritingFont();

  // ── Demux all streams (encoded chunks only — decode happens on demand) ──
  const streamData = [];
  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    onProgress?.(null, `Demuxing ${file.name} (${i + 1}/${sorted.length})…`);
    const { encodedChunks, codecString, description, durationUs } = await demuxVideoFile(file);
    streamData.push(new VideoStream(encodedChunks, codecString, description, durationUs));
  }

  const totalDurationUs  = Math.max(...streamData.map(s => s.durationUs));
  const totalFrames      = Math.ceil(totalDurationUs / (1_000_000 / fps));
  const LOOKAHEAD_US     = 2_000_000; // pre-decode 2 s ahead per stream
  // Report every 5 % — at least every frame, at most every 30 frames
  const PROGRESS_FRAMES  = Math.min(30, Math.max(1, Math.floor(totalFrames * 0.05)));
  // Yield to browser every N frames to keep the UI responsive
  const YIELD_FRAMES     = Math.max(1, Math.floor(fps / 10)); // ~3 frames at 30fps

  onProgress?.(0, `Encoding ${totalFrames} frames (${(totalDurationUs / 1e6).toFixed(1)}s @ ${fps}fps)…`);

  // ── Compositing canvas ──
  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // ── Encoder + muxer ──
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });

  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => reject(new Error(`[video-wall] VideoEncoder: ${e.message}`)),
    });
    // High Profile (64), Level 4.2 (2a) to support up to 1080p@60fps
    encoder.configure({ codec: 'avc1.64002a', width: w, height: h, bitrate, framerate: fps });

    (async () => {
      try {
        const encodeStart = Date.now();

        let bgStreamLoops = 0;

        for (let fi = 0; fi < totalFrames; fi++) {
          const ts = fi * (1_000_000 / fps);

          let localBgTs = 0;
          if (tpl.bgVideoStream) {
              if (ts >= (bgStreamLoops + 1) * tpl.bgVideoStream.durationUs) {
                  bgStreamLoops++;
                  tpl.bgVideoStream.reset();
              }
              localBgTs = ts - (bgStreamLoops * tpl.bgVideoStream.durationUs);
          }

          // Top up decode buffers every 30 frames (parallel across streams).
          // Bounds peak memory to LOOKAHEAD_US × N_streams regardless of clip length.
          if (fi % 30 === 0) {
            const promises = streamData.map(s => s.ensureBufferedTo(ts + LOOKAHEAD_US));
            if (tpl.bgVideoStream) promises.push(tpl.bgVideoStream.ensureBufferedTo(localBgTs + LOOKAHEAD_US));
            await Promise.all(promises);
          }

          // ── Composite frame ──
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);

          let bgFrame = null;
          if (tpl.bgVideoStream) {
              bgFrame = tpl.bgVideoStream.getFrameAt(localBgTs);
          }

          if (tpl.drawBackground) tpl.drawBackground(ctx, w, h, bgFrame);

          for (let i = 0; i < cells.length; i++) {
            const stream = streamData[i];

            if (!stream) {
              const b = cellBounds(cells[i]);
              ctx.fillStyle = '#000';
              ctx.fillRect(b.x, b.y, b.w, b.h);
              continue;
            }

            const frame = stream.getFrameAt(ts);
            if (frame) {
              drawCellContent(ctx, frame, cells[i]);
            } else {
              drawEndOfVideo(ctx, cells[i], endOfVideo, endText, fallbackBitmap);
            }

            drawCellCaption(ctx, captions[i] ?? '', cells[i], fontName);
          }

          // ── Encode composited frame ──
          const vf = new VideoFrame(canvas, { timestamp: ts });
          encoder.encode(vf, { keyFrame: fi % (fps * 2) === 0 });
          vf.close();

          // ── Backpressure: yield until the encoder queue is manageable ──
          // Without this, all frames are queued instantly and encoder.flush()
          // hangs for minutes at the end as the hardware catches up.
          while (encoder.encodeQueueSize > 6) {
            await new Promise(r => setTimeout(r, 8));
          }

          // ── Yield to browser every YIELD_FRAMES to prevent UI hang ──
          if (fi % YIELD_FRAMES === 0) {
            await new Promise(r => setTimeout(r, 0));
          }

          // ── Progress report every PROGRESS_FRAMES (~5%) ──
          if (fi % PROGRESS_FRAMES === 0) {
            const pct     = Math.round((fi / totalFrames) * 100);
            const elapsed = (Date.now() - encodeStart) / 1000;

            let msg = `Encoding… ${pct}%`;
            if (pct >= 20 && fi > 0) {
              const totalEst  = elapsed * (totalFrames / fi);
              const remaining = Math.max(0, totalEst - elapsed);
              msg += ` — ~${Math.round(remaining)}s remaining`;
            }
            onProgress?.(pct, msg);
          }
        }

        onProgress?.(99, 'Finalising… flushing encoder and writing MP4 container');
        await encoder.flush();
        encoder.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    })();
  });

  muxer.finalize();

  for (const s of streamData) s.close();
  if (tpl?.bgVideoStream) tpl.bgVideoStream.close();
  if (fallbackBitmap) fallbackBitmap.close();
  if (bgBitmap) bgBitmap.close();

  return new Blob([target.buffer], { type: 'video/mp4' });
}
