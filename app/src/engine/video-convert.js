/**
 * PicMachina — Video Conversion Utilities
 *
 * Powered by Mediabunny (https://mediabunny.dev) for the format/codec
 * operations (convert, trim, compress, change-fps).
 *
 * Concatenation uses HTMLVideoElement frame extraction + mp4-muxer (the same
 * pattern as the existing video wall), because mediabunny's multi-input reading
 * API is not yet wired up. Audio passthrough can be added in a future pass once
 * mediabunny's VideoSampleSink / AudioSampleSink reading loop is implemented.
 */

const VIDEO_EXTS = new Set(['mp4', 'mov', 'webm', 'avi', 'mkv']);

/**
 * Return an H.264 codec string at the appropriate level for the given resolution.
 * AVC level max frame sizes:
 *   L3.1 → 921,600 px  (≤720p)
 *   L4.0 → 2,097,152 px (≤1080p)
 *   L5.1 → 9,437,184 px (≤4K)
 *   L5.2 → unlimited for our purposes
 */
export function avcCodec(width, height) {
  const px = width * height;
  if (px <= 921_600)   return 'avc1.42001f'; // Baseline L3.1 ≤720p
  if (px <= 2_097_152) return 'avc1.640028'; // High L4.0 ≤1080p
  if (px <= 9_437_184) return 'avc1.640033'; // High L5.1 ≤4K
  return 'avc1.640034';                       // High L5.2 >4K
}

// ─── Output format helpers ────────────────────────────────

function getInputExt(file) {
  return file.name.slice(file.name.lastIndexOf('.') + 1).toLowerCase();
}

/**
 * Map a format string to a mediabunny Output format class + file extension.
 * Falls back to MP4 for unknown values.
 */
async function resolveOutputFormat(format) {
  const {
    Mp4OutputFormat, WebMOutputFormat, MkvOutputFormat, OggOutputFormat, MovOutputFormat
  } = await import('mediabunny');

  switch ((format || 'mp4').toLowerCase()) {
    case 'webm': return { OutputFormat: WebMOutputFormat, ext: 'webm', mime: 'video/webm' };
    case 'mkv':  return { OutputFormat: MkvOutputFormat,  ext: 'mkv',  mime: 'video/x-matroska' };
    case 'ogg':  return { OutputFormat: OggOutputFormat,  ext: 'ogg',  mime: 'video/ogg' };
    case 'mov':  return { OutputFormat: MovOutputFormat,  ext: 'mov',  mime: 'video/quicktime' };
    default:     return { OutputFormat: Mp4OutputFormat,  ext: 'mp4',  mime: 'video/mp4' };
  }
}

/**
 * Create a mediabunny Input from a File, auto-detecting format from ALL_FORMATS.
 */
async function makeInput(file) {
  const { Input, BlobSource, ALL_FORMATS } = await import('mediabunny');
  return new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
}

/**
 * Run a Conversion.init() + execute() and return the output as a Blob.
 */
async function runConversion(input, outputFormat, OutputFormatClass, mime, conversionOpts = {}) {
  const { Conversion, Output, BufferTarget } = await import('mediabunny');
  const target = new BufferTarget();
  const output = new Output({ format: new OutputFormatClass(), target });
  const conversion = await Conversion.init({ input, output, ...conversionOpts });
  await conversion.execute();
  return new Blob([target.buffer], { type: mime });
}

// ─── Per-frame effect processing ─────────────────────────

/**
 * Apply a per-frame image effect to every video frame using mediabunny's
 * process callback. The applyFn receives the same (ctx, params, context)
 * signature as a normal Pic-Machina transform's apply() function.
 *
 * @param {File} file
 * @param {Function} applyFn - async (ctx, params, context) => void
 * @param {object} params
 * @param {{ bitrate?: number, onLog?: function }} options
 * @returns {Promise<Blob>}
 */
/**
 * Apply one or more canvas-based image transforms to every frame of a video.
 *
 * @param {File} file
 * @param {Function|Array<{fn:Function, params:object}>} applyFnOrSteps
 *   - Single function (legacy): called as fn(ctx, params, {}) per frame.
 *   - Array of steps: each step is { fn, params }; all applied in sequence per frame.
 * @param {object} params   Only used when applyFnOrSteps is a single function.
 * @param {{ bitrate?: number, onLog?: function }} options
 */
export async function processVideoEffect(file, applyFnOrSteps, params = {}, { bitrate = 8_000_000, onLog, fileContext = {} } = {}) {
  // Normalise to array of steps
  const steps = Array.isArray(applyFnOrSteps)
    ? applyFnOrSteps
    : [{ fn: applyFnOrSteps, params }];

  const log = (msg) => onLog?.('info', msg);
  const ext = getInputExt(file);
  const { OutputFormat, mime } = await resolveOutputFormat(['webm', 'ogg', 'mkv', 'mov'].includes(ext) ? ext : 'mp4');
  const input = await makeInput(file);

  // Pre-fetch video dimensions and duration before conversion starts
  const [videoTrack, totalDuration] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.computeDuration(),
  ]);
  const rawW = videoTrack.displayWidth;
  const rawH = videoTrack.displayHeight;

  // Determine OUTPUT dimensions via a dry-run: run all transforms on a blank canvas
  // at the video's natural dimensions so geo-resize/crop compute final size correctly.
  const dimCanvas = document.createElement('canvas');
  dimCanvas.width = rawW; dimCanvas.height = rawH;
  const dimCtx = dimCanvas.getContext('2d');
  for (const step of steps) {
    try { await step.fn(dimCtx, step.params || {}, fileContext); } catch { /* ignore */ }
  }
  // H.264 requires even dimensions — round up by 1px if needed
  const outW = dimCanvas.width  % 2 === 0 ? dimCanvas.width  : dimCanvas.width  + 1;
  const outH = dimCanvas.height % 2 === 0 ? dimCanvas.height : dimCanvas.height + 1;

  // Working canvas (reused across all frames — reset to rawW×rawH before each frame)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  let estimatedTotal = 0;
  let frameCount     = 0;
  let lastLoggedPct  = -1;
  let startTime      = null;

  const { Conversion, Output, BufferTarget } = await import('mediabunny');
  const target = new BufferTarget();
  const output = new Output({ format: new OutputFormat(), target });

  const conversion = await Conversion.init({
    input,
    output,
    video: {
      bitrate: parseInt(bitrate) || 8_000_000,
      processedWidth:  outW,
      processedHeight: outH,
      process: async (sample) => {
        if (frameCount === 0) {
          startTime = Date.now();
          if (sample.duration > 0) estimatedTotal = Math.round(totalDuration / sample.duration);
          const dimStr = outW !== rawW || outH !== rawH
            ? `${rawW}×${rawH}→${outW}×${outH}`
            : `${rawW}×${rawH}`;
          log(`Processing ${dimStr} video (${totalDuration.toFixed(1)}s, ~${estimatedTotal} frames)`);
        }

        // Reset to input dimensions so transforms that resize start from the video frame size
        canvas.width  = rawW;
        canvas.height = rawH;
        sample.draw(ctx, 0, 0, rawW, rawH);

        // Apply all transforms in sequence
        for (const step of steps) {
          await step.fn(ctx, step.params || {}, fileContext);
        }

        frameCount++;

        if (estimatedTotal > 0) {
          const pct    = Math.min(99, (frameCount / estimatedTotal) * 100);
          const bucket = Math.floor(pct / 5) * 5;
          if (bucket > lastLoggedPct && bucket > 0) {
            lastLoggedPct = bucket;
            const elapsed = (Date.now() - startTime) / 1000;
            const etaSec  = Math.round((elapsed / pct) * (100 - pct));
            log(`  ${bucket}% — ETA ${etaSec}s`);
          }
        }

        return canvas;
      },
    },
  });

  await conversion.execute();
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  log(`Done — ${frameCount} frames in ${elapsed}s`);
  return new Blob([target.buffer], { type: mime });
}

// ─── Per-file video transforms ────────────────────────────

/**
 * Re-encode a video file to a different container format and/or codec.
 *
 * @param {File} file
 * @param {{ format?: string, codec?: string, audioCodec?: string }} options
 * @returns {Promise<Blob>}
 */
export async function convertVideo(file, { format = 'mp4', codec, audioCodec } = {}) {
  const { OutputFormat, ext, mime } = await resolveOutputFormat(format);

  const input = await makeInput(file);

  const videoOpts = codec && codec !== 'auto' ? { codec } : undefined;
  const audioOpts = audioCodec && audioCodec !== 'auto' ? { codec: audioCodec } : undefined;

  return runConversion(input, format, OutputFormat, mime, {
    ...(videoOpts && { video: videoOpts }),
    ...(audioOpts && { audio: audioOpts }),
  });
}

/**
 * Trim a video file to a specific time range (in seconds).
 *
 * @param {File} file
 * @param {{ start?: number, end?: number, suffix?: string }} options
 * @returns {Promise<Blob>}
 */
export async function trimVideo(file, { start = 0, end } = {}) {
  const ext = getInputExt(file);
  const { OutputFormat, mime } = await resolveOutputFormat(['webm', 'ogg', 'mkv', 'mov'].includes(ext) ? ext : 'mp4');

  const input = await makeInput(file);

  const trim = { start: parseFloat(start) || 0 };
  if (end !== undefined && end !== '') trim.end = parseFloat(end);

  return runConversion(input, ext, OutputFormat, mime, { trim });
}

/**
 * Compress a video by reducing its bitrate.
 *
 * @param {File} file
 * @param {{ quality?: 'low'|'medium'|'high', bitrate?: number }} options
 * @returns {Promise<Blob>}
 */
export async function compressVideo(file, { quality = 'medium', bitrate } = {}) {
  const { QUALITY_LOW, QUALITY_MEDIUM, QUALITY_HIGH } = await import('mediabunny');

  const qualityMap = { low: QUALITY_LOW, medium: QUALITY_MEDIUM, high: QUALITY_HIGH };
  const videoBitrate = quality === 'custom'
    ? (parseFloat(bitrate) * 1_000_000 || 4_000_000)
    : (qualityMap[quality] ?? QUALITY_MEDIUM);

  const ext = getInputExt(file);
  const { OutputFormat, mime } = await resolveOutputFormat(['webm', 'ogg', 'mkv', 'mov'].includes(ext) ? ext : 'mp4');

  const input = await makeInput(file);
  return runConversion(input, ext, OutputFormat, mime, { video: { bitrate: videoBitrate } });
}

/**
 * Change the frame rate of a video.
 *
 * @param {File} file
 * @param {{ fps?: number }} options
 * @returns {Promise<Blob>}
 */
export async function changeFPS(file, { fps = 30 } = {}) {
  const ext = getInputExt(file);
  const { OutputFormat, mime } = await resolveOutputFormat(['webm', 'ogg', 'mkv', 'mov'].includes(ext) ? ext : 'mp4');

  const input = await makeInput(file);
  return runConversion(input, ext, OutputFormat, mime, { video: { frameRate: parseFloat(fps) || 30 } });
}

// ─── Audio operations ─────────────────────────────────────

/**
 * Map an audio format name to a mediabunny Output format class + extension.
 */
async function resolveAudioOutputFormat(format) {
  const { Mp3OutputFormat, FlacOutputFormat, WavOutputFormat, OggOutputFormat, Mp4OutputFormat } = await import('mediabunny');
  switch ((format || 'mp3').toLowerCase()) {
    case 'flac': return { OutputFormat: FlacOutputFormat, ext: 'flac', mime: 'audio/flac'  };
    case 'wav':  return { OutputFormat: WavOutputFormat,  ext: 'wav',  mime: 'audio/wav'   };
    case 'ogg':  return { OutputFormat: OggOutputFormat,  ext: 'ogg',  mime: 'audio/ogg'   };
    case 'aac':  return { OutputFormat: Mp4OutputFormat,  ext: 'm4a',  mime: 'audio/mp4'   };
    default:     return { OutputFormat: Mp3OutputFormat,  ext: 'mp3',  mime: 'audio/mpeg'  };
  }
}

/**
 * Remove all audio tracks from a video file.
 *
 * @param {File} file
 * @param {{ suffix?: string }} options
 * @returns {Promise<Blob>}
 */
export async function stripAudio(file, {} = {}) {
  const ext = getInputExt(file);
  const { OutputFormat, mime } = await resolveOutputFormat(['webm', 'ogg', 'mkv', 'mov'].includes(ext) ? ext : 'mp4');
  const input = await makeInput(file);
  return runConversion(input, ext, OutputFormat, mime, { audio: { discard: true } });
}

/**
 * Extract the audio track from a video as a standalone audio file.
 *
 * @param {File} file
 * @param {{ format?: string }} options
 * @returns {Promise<Blob>}
 */
export async function extractAudio(file, { format = 'mp3' } = {}) {
  const { OutputFormat, mime } = await resolveAudioOutputFormat(format);
  const input = await makeInput(file);
  return runConversion(input, format, OutputFormat, mime, { video: { discard: true } });
}

/**
 * Adjust audio channel count and/or sample rate of a video file.
 *
 * @param {File} file
 * @param {{ channels?: string, sampleRate?: string }} options
 * @returns {Promise<Blob>}
 */
export async function remixAudio(file, { channels, sampleRate } = {}) {
  const ext = getInputExt(file);
  const { OutputFormat, mime } = await resolveOutputFormat(['webm', 'ogg', 'mkv', 'mov'].includes(ext) ? ext : 'mp4');
  const input = await makeInput(file);

  const audioOpts = {};
  if (channels && channels !== 'keep') audioOpts.numberOfChannels = parseInt(channels);
  if (sampleRate && sampleRate !== 'keep') audioOpts.sampleRate = parseInt(sampleRate);

  return runConversion(input, ext, OutputFormat, mime, { audio: audioOpts });
}

// ─── Concatenation (HTMLVideoElement + mp4-muxer) ─────────

/**
 * Get duration and dimensions of a video file via HTMLVideoElement.
 */
async function getVideoInfo(file) {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  try {
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = () => reject(new Error(`Could not load video metadata: ${file.name}`));
      video.src = url;
      video.load();
    });
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Concatenate multiple video files end-to-end into a single MP4.
 *
 * Uses HTMLVideoElement seek-based frame extraction and mp4-muxer for encoding.
 * This produces a silent video — audio support will be added in a future pass
 * once mediabunny's multi-input reading API is wired up.
 *
 * @param {File[]} files       — videos in order
 * @param {{ fps?: number, width?: number, height?: number, bitrate?: number, onLog?: function }} options
 * @returns {Promise<Blob>}
 */
export async function concatVideos(files, { fps = 30, width, height, bitrate = 8_000_000, onLog } = {}) {
  const log = (msg) => onLog?.('info', msg);
  if (!files.length) throw new Error('concatVideos: no files provided');

  const infos  = await Promise.all(files.map(getVideoInfo));
  const outW   = parseInt(width)   || infos[0].width;
  const outH   = parseInt(height)  || infos[0].height;
  const outFPS = parseFloat(fps)   || 30;

  if (!outW || !outH) throw new Error(`Could not determine output dimensions (got ${outW}×${outH})`);

  // H.264 requires dimensions to be multiples of 2
  const encW = outW % 2 === 0 ? outW : outW + 1;
  const encH = outH % 2 === 0 ? outH : outH + 1;

  const codecConfig = {
    codec: avcCodec(encW, encH),
    width: encW,
    height: encH,
    bitrate: parseInt(bitrate) || 8_000_000,
  };

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({
    target,
    video: { codec: 'avc', width: encW, height: encH },
    fastStart: 'in-memory',
  });

  // Surface VideoEncoder errors into our async chain via a rejection promise
  let encoderReject;
  const encoderError = new Promise((_, reject) => { encoderReject = reject; });

  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => encoderReject(new Error(`VideoEncoder error: ${e.message ?? e}`)),
  });
  encoder.configure(codecConfig);

  const canvas = document.createElement('canvas');
  canvas.width  = encW;
  canvas.height = encH;
  const ctx = canvas.getContext('2d');
  let frameIndex = 0;

  const encodeWork = async () => {
    for (let fi = 0; fi < files.length; fi++) {
      const file  = files[fi];
      const info  = infos[fi];
      const total = Math.ceil(info.duration * outFPS);

      const url   = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.muted    = true;
      video.style.cssText = 'position:fixed;opacity:0;pointer-events:none;width:1px;height:1px';
      document.body.appendChild(video);

      try {
        await new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(new Error(`Failed to load: ${file.name}`));
          video.src = url;
          video.load();
        });

        const dur = info.duration.toFixed(1);
        log(`File ${fi + 1}/${files.length}: ${file.name} (${dur}s)`);

        let lastLoggedPct = -1;

        for (let f = 0; f < total; f++) {
          const time = f / outFPS;
          if (time >= info.duration) break;

          await new Promise((resolve, reject) => {
            video.onseeked = resolve;
            video.onerror  = () => reject(new Error(`Seek failed in: ${file.name}`));
            video.currentTime = time;
          });

          ctx.clearRect(0, 0, outW, outH);
          ctx.drawImage(video, 0, 0, outW, outH);

          // Throttle if the encoder queue is backing up
          while (encoder.encodeQueueSize > 10) {
            await new Promise(r => setTimeout(r, 0));
          }

          const ts = frameIndex * (1_000_000 / outFPS);
          const vf = new VideoFrame(canvas, { timestamp: ts });
          encoder.encode(vf, { keyFrame: f === 0 });
          vf.close();
          frameIndex++;

          // Log progress every 10%
          const pct = Math.floor((f / total) * 10) * 10;
          if (pct > lastLoggedPct) {
            lastLoggedPct = pct;
            log(`  ${pct}% — ${time.toFixed(1)}s / ${dur}s`);
          }
        }

        // Flush after each clip to ensure clean keyframe boundaries
        await encoder.flush();
      } finally {
        document.body.removeChild(video);
        URL.revokeObjectURL(url);
      }
    }

    await encoder.flush();
    encoder.close();
    muxer.finalize();
  };

  // Race encoding work against any VideoEncoder error
  await Promise.race([encodeWork(), encoderError]);

  return new Blob([target.buffer], { type: 'video/mp4' });
}
