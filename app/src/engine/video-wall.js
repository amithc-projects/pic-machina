/**
 * PicMachina — Video Wall
 *
 * Composites multiple input video files into a single MP4 output arranged in a
 * grid layout (security-camera wall style). Uses:
 *   - mp4box.js   for demuxing input MP4 containers
 *   - WebCodecs VideoDecoder for hardware-accelerated frame decoding
 *   - Canvas 2D for compositing frames into the grid
 *   - WebCodecs VideoEncoder + mp4-muxer for output
 */

import { loadHandwritingFont } from './compositor.js';

// ─── Layout geometry ──────────────────────────────────────

const LAYOUTS = {
  'grid-2x2':  { cols: 2, rows: 2 },
  'grid-3x3':  { cols: 3, rows: 3 },
  'grid-4x4':  { cols: 4, rows: 4 },
  'split-1x2': { cols: 2, rows: 1 },
};

function getGridGeometry(layout, outputWidth, outputHeight) {
  const { cols, rows } = LAYOUTS[layout] || LAYOUTS['grid-2x2'];
  const cellW = Math.floor(outputWidth  / cols);
  const cellH = Math.floor(outputHeight / rows);
  // grid layouts crop to square; split-1x2 letterboxes to preserve AR
  const fitMode = layout === 'split-1x2' ? 'contain' : 'cover';
  return { cols, rows, cellW, cellH, fitMode };
}

// ─── Cell drawing ─────────────────────────────────────────

/**
 * Draw a video frame (or ImageBitmap) into a cell on the canvas.
 * cover  — center-crop to fill the cell exactly (1:1 for square cells)
 * contain — letterbox (black bars) to fit without cropping
 */
function drawCell(ctx, source, cellX, cellY, cellW, cellH, fitMode) {
  const sw = source.displayWidth ?? source.codedWidth  ?? source.width;
  const sh = source.displayHeight ?? source.codedHeight ?? source.height;

  if (fitMode === 'cover') {
    const scale = Math.max(cellW / sw, cellH / sh);
    const dw = sw * scale, dh = sh * scale;
    const ox = (dw - cellW) / 2, oy = (dh - cellH) / 2;
    ctx.drawImage(source, ox / scale, oy / scale, cellW / scale, cellH / scale,
                  cellX, cellY, cellW, cellH);
  } else {
    // contain
    const scale = Math.min(cellW / sw, cellH / sh);
    const dw = sw * scale, dh = sh * scale;
    const ox = cellX + (cellW - dw) / 2, oy = cellY + (cellH - dh) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(cellX, cellY, cellW, cellH);
    ctx.drawImage(source, 0, 0, sw, sh, ox, oy, dw, dh);
  }
}

// ─── End-of-video fallback ────────────────────────────────

async function drawEndOfVideo(ctx, endOfVideo, cellX, cellY, cellW, cellH, endText, fallbackBitmap) {
  if (endOfVideo === 'image' && fallbackBitmap) {
    drawCell(ctx, fallbackBitmap, cellX, cellY, cellW, cellH, 'contain');
    return;
  }
  // black or text
  ctx.fillStyle = '#000';
  ctx.fillRect(cellX, cellY, cellW, cellH);
  if (endOfVideo === 'text') {
    const text = endText || 'No Signal Detected';
    const size = Math.max(10, Math.round(cellH * 0.06));
    ctx.save();
    ctx.fillStyle    = '#00ff41';
    ctx.font         = `bold ${size}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cellX + cellW / 2, cellY + cellH / 2);
    ctx.restore();
  }
}

// ─── Caption drawing ──────────────────────────────────────

function drawCellCaption(ctx, text, cellX, cellY, cellW, cellH, fontName) {
  if (!text) return;
  const stripH = Math.max(16, Math.round(cellH * 0.08));
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(cellX, cellY + cellH - stripH, cellW, stripH);

  ctx.save();
  ctx.fillStyle    = '#fff';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.round(stripH * 0.55);
  while (size >= 8) {
    ctx.font = `600 ${size}px "${fontName}", cursive`;
    if (ctx.measureText(text).width <= cellW - 16) break;
    size--;
  }
  ctx.fillText(text, cellX + cellW / 2, cellY + cellH - stripH / 2);
  ctx.restore();
}

// ─── MP4 demuxer (mp4box.js) ──────────────────────────────

/**
 * Demux a video File using mp4box.js.
 * Returns { encodedChunks, codecString, durationUs }
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
    const encodedChunks = [];

    function checkDone() {
      if (allDataFed && totalSamples > 0 && receivedSamples >= totalSamples) {
        resolve({ encodedChunks, codecString, durationUs, description });
      }
    }

    let description = null;

    mp4.onReady = (info) => {
      const track = info.videoTracks[0];
      if (!track) { reject(new Error(`[video-wall] No video track in "${file.name}"`)); return; }
      codecString  = track.codec;
      durationUs   = (track.duration / track.timescale) * 1_000_000;
      totalSamples = track.nb_samples;

      // Extract the AVCDecoderConfigurationRecord (avcC box) needed by VideoDecoder
      try {
        const trak  = mp4.getTrackById(track.id);
        const entry = trak.mdia.minf.stbl.stsd.entries[0];
        const box   = entry.avcC || entry.hvcC || entry.vpcC;
        if (box) {
          const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
          box.write(stream);
          // Skip the 8-byte box header (4 size + 4 type)
          description = new Uint8Array(stream.buffer, 8);
        }
      } catch (e) {
        console.warn('[video-wall] Could not extract codec description:', e);
      }

      // Extract all samples in one batch
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

// ─── WebCodecs decoder ────────────────────────────────────

/**
 * Decode all EncodedVideoChunks into sorted VideoFrame[].
 * Caller must close each frame after use.
 */
async function decodeAllFrames(encodedChunks, codecString, description) {
  const frames = [];
  await new Promise((resolve, reject) => {
    const decoder = new VideoDecoder({
      output: (frame) => frames.push(frame),
      error:  (e)     => reject(e),
    });

    const config = { codec: codecString, hardwareAcceleration: 'prefer-hardware' };
    if (description) config.description = description;
    decoder.configure(config);

    // Skip leading non-keyframes — decoder requires a keyframe first
    let seenKeyframe = false;
    for (const chunk of encodedChunks) {
      if (!seenKeyframe) {
        if (chunk.type !== 'key') continue;
        seenKeyframe = true;
      }
      decoder.decode(chunk);
    }

    decoder.flush().then(() => { decoder.close(); resolve(); }).catch(reject);
  });
  frames.sort((a, b) => a.timestamp - b.timestamp);
  return frames;
}

// ─── Per-stream state ─────────────────────────────────────

class VideoStream {
  constructor(frames, durationUs) {
    this.frames     = frames;      // VideoFrame[], sorted by timestamp
    this.durationUs = durationUs;
    this.cursor     = 0;
    this.exhausted  = false;
  }

  /**
   * Return the VideoFrame closest to targetTs without exceeding it,
   * or null if the stream is exhausted.
   * Does NOT close frames — caller is responsible.
   */
  getFrameAt(targetTs) {
    if (this.exhausted) return null;
    if (targetTs > this.durationUs) {
      this.exhausted = true;
      return null;
    }
    // Advance cursor to the last frame whose timestamp <= targetTs
    while (
      this.cursor + 1 < this.frames.length &&
      this.frames[this.cursor + 1].timestamp <= targetTs
    ) {
      this.cursor++;
    }
    return this.frames[this.cursor] ?? null;
  }

  closeAll() {
    for (const f of this.frames) try { f.close(); } catch {}
    this.frames = [];
  }
}

// ─── Main export ──────────────────────────────────────────

/**
 * Create a video wall MP4 from N input video Files.
 *
 * @param {File[]}  videoFiles
 * @param {object}  opts
 * @param {string}  opts.layout            — 'grid-2x2'|'grid-3x3'|'grid-4x4'|'split-1x2'
 * @param {number}  opts.fps
 * @param {number}  opts.outputWidth
 * @param {number}  opts.outputHeight
 * @param {string[]} opts.captions         — one per sorted file, shown at bottom of each cell
 * @param {string}  opts.endOfVideo        — 'black'|'image'|'text'
 * @param {string}  [opts.fallbackImageUrl]
 * @param {string}  opts.endText
 * @param {number}  opts.bitrate
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
  onProgress       = null,   // (pct: number, label: string) => void
} = {}) {
  if (!videoFiles || videoFiles.length === 0) throw new Error('[video-wall] No video files provided');

  // Sort alphabetically by filename
  const sorted = [...videoFiles].sort((a, b) => a.name.localeCompare(b.name));

  const { cols, rows, cellW, cellH, fitMode } = getGridGeometry(layout, outputWidth, outputHeight);

  // Ensure even dimensions for H.264
  const w = outputWidth  % 2 === 0 ? outputWidth  : outputWidth  - 1;
  const h = outputHeight % 2 === 0 ? outputHeight : outputHeight - 1;

  // Load fallback image if needed
  let fallbackBitmap = null;
  if (endOfVideo === 'image' && fallbackImageUrl) {
    try {
      const resp = await fetch(fallbackImageUrl);
      const blob = await resp.blob();
      fallbackBitmap = await createImageBitmap(blob);
    } catch (err) {
      console.warn('[video-wall] Could not load fallback image:', err);
    }
  }

  // Load font for captions
  const fontName = await loadHandwritingFont();

  // Demux + decode all streams in parallel
  // Process sequentially — parallel decode of many large videos exhausts memory
  const streamData = [];
  for (let i = 0; i < sorted.length; i++) {
    const file = sorted[i];
    onProgress?.(null, `Demuxing ${file.name} (${i + 1}/${sorted.length})…`);
    const { encodedChunks, codecString, durationUs, description } = await demuxVideoFile(file);
    onProgress?.(null, `Decoding ${file.name} (${i + 1}/${sorted.length})…`);
    const frames = await decodeAllFrames(encodedChunks, codecString, description);
    streamData.push(new VideoStream(frames, durationUs));
  }

  const totalDurationUs = Math.max(...streamData.map(s => s.durationUs));
  const totalFrames     = Math.ceil(totalDurationUs / (1_000_000 / fps));

  onProgress?.(0, `Encoding ${totalFrames} frames (${(totalDurationUs / 1_000_000).toFixed(1)}s @ ${fps}fps)…`);

  // Set up canvas for compositing
  const canvas = document.createElement('canvas');
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  // Set up encoder + muxer
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });

  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error:  (e) => reject(new Error(`[video-wall] VideoEncoder error: ${e.message}`)),
    });
    encoder.configure({ codec: 'avc1.42001f', width: w, height: h, bitrate, framerate: fps });

    (async () => {
      try {
        for (let fi = 0; fi < totalFrames; fi++) {
          const ts = fi * (1_000_000 / fps);

          // Black background
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);

          for (let i = 0; i < cols * rows; i++) {
            const col   = i % cols;
            const row   = Math.floor(i / cols);
            const cellX = col * cellW;
            const cellY = row * cellH;
            const stream = streamData[i];

            if (!stream) {
              // More cells than streams — black
              ctx.fillStyle = '#000';
              ctx.fillRect(cellX, cellY, cellW, cellH);
              continue;
            }

            const frame = stream.getFrameAt(ts);
            if (frame) {
              drawCell(ctx, frame, cellX, cellY, cellW, cellH, fitMode);
            } else {
              await drawEndOfVideo(ctx, endOfVideo, cellX, cellY, cellW, cellH, endText, fallbackBitmap);
            }

            drawCellCaption(ctx, captions[i] || '', cellX, cellY, cellW, cellH, fontName);
          }

          const vf = new VideoFrame(canvas, { timestamp: ts });
          encoder.encode(vf, { keyFrame: fi % (fps * 2) === 0 });
          vf.close();

          // Yield + progress report every 30 frames
          if (fi % 30 === 0) {
            const pct = Math.round((fi / totalFrames) * 100);
            onProgress?.(pct, `Encoding… ${pct}% complete`);
            await new Promise(r => setTimeout(r, 0));
          }
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

  // Clean up decoded frames
  for (const stream of streamData) stream.closeAll();
  if (fallbackBitmap) fallbackBitmap.close();

  return new Blob([target.buffer], { type: 'video/mp4' });
}
