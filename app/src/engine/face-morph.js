import { avcCodec } from './video-convert.js';
import { getFaceMeshTriangles } from './utils/delaunay.js';
import { drawAffineTriangle } from './utils/perspective.js';
import { extractHeadLandmarks } from './face-swap.js';

export async function createFaceMorphVideo(blob1, blob2, options = {}) {
  const fps = options.fps || 30;
  const duration = options.duration || 4;
  const totalFrames = Math.round(fps * duration);

  const [bmp1, bmp2] = await Promise.all([
    createImageBitmap(blob1),
    createImageBitmap(blob2)
  ]);

  const [marks1, marks2] = await Promise.all([
    extractHeadLandmarks(bmp1),
    extractHeadLandmarks(bmp2)
  ]);

  if (!marks1) throw new Error('No face detected in the first image.');
  if (!marks2) throw new Error('No face detected in the second image.');

  // Use the dimensions of the first image as the output video size
  const w = options.width || bmp1.width;
  const h = options.height || bmp1.height;
  const cw = w % 2 === 0 ? w : w - 1;
  const ch = h % 2 === 0 ? h : h - 1;

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: cw, height: ch },
    fastStart: 'in-memory',
  });

  const canvas1 = document.createElement('canvas');
  canvas1.width = cw;
  canvas1.height = ch;
  const ctx1 = canvas1.getContext('2d', { willReadFrequently: true });

  const canvas2 = document.createElement('canvas');
  canvas2.width = cw;
  canvas2.height = ch;
  const ctx2 = canvas2.getContext('2d', { willReadFrequently: true });

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = cw;
  finalCanvas.height = ch;
  const finalCtx = finalCanvas.getContext('2d');

  const triangles = await getFaceMeshTriangles();

  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: err => reject(new Error(`VideoEncoder error: ${err.message}`)),
    });

    encoder.configure({
      codec: avcCodec(cw, ch),
      width: cw,
      height: ch,
      bitrate: 8_000_000,
      framerate: fps,
    });

    (async () => {
      try {
        for (let f = 0; f < totalFrames; f++) {
          const alpha = f / (totalFrames - 1);

          // Interpolate landmarks
          const interpMarks = marks1.map((m1, idx) => {
            const m2 = marks2[idx];
            return {
              x: (1 - alpha) * m1.x + alpha * m2.x,
              y: (1 - alpha) * m1.y + alpha * m2.y,
              z: (1 - alpha) * m1.z + alpha * m2.z
            };
          });

          // Draw warped image 1
          ctx1.clearRect(0, 0, cw, ch);
          ctx1.drawImage(bmp1, 0, 0, cw, ch); // Draw background
          for (const [i, j, k] of triangles) {
            const s0 = marks1[i], s1 = marks1[j], s2 = marks1[k];
            const t0 = interpMarks[i], t1 = interpMarks[j], t2 = interpMarks[k];
            drawAffineTriangle(
              ctx1, bmp1, bmp1.width, bmp1.height,
              { x: s0.x * bmp1.width, y: s0.y * bmp1.height },
              { x: s1.x * bmp1.width, y: s1.y * bmp1.height },
              { x: s2.x * bmp1.width, y: s2.y * bmp1.height },
              { x: t0.x * cw, y: t0.y * ch },
              { x: t1.x * cw, y: t1.y * ch },
              { x: t2.x * cw, y: t2.y * ch }
            );
          }

          // Draw warped image 2
          ctx2.clearRect(0, 0, cw, ch);
          ctx2.drawImage(bmp2, 0, 0, cw, ch); // Draw background
          for (const [i, j, k] of triangles) {
            const s0 = marks2[i], s1 = marks2[j], s2 = marks2[k];
            const t0 = interpMarks[i], t1 = interpMarks[j], t2 = interpMarks[k];
            drawAffineTriangle(
              ctx2, bmp2, bmp2.width, bmp2.height,
              { x: s0.x * bmp2.width, y: s0.y * bmp2.height },
              { x: s1.x * bmp2.width, y: s1.y * bmp2.height },
              { x: s2.x * bmp2.width, y: s2.y * bmp2.height },
              { x: t0.x * cw, y: t0.y * ch },
              { x: t1.x * cw, y: t1.y * ch },
              { x: t2.x * cw, y: t2.y * ch }
            );
          }

          // Crossfade
          finalCtx.globalAlpha = 1.0;
          finalCtx.clearRect(0, 0, cw, ch);
          finalCtx.drawImage(canvas1, 0, 0);
          finalCtx.globalAlpha = alpha;
          finalCtx.drawImage(canvas2, 0, 0);

          if (options.onProgress) {
            options.onProgress(f, totalFrames);
          }

          const bmpFrame = await createImageBitmap(finalCanvas);
          const ts = f * (1_000_000 / fps);
          const vf = new VideoFrame(bmpFrame, { timestamp: ts });
          encoder.encode(vf, { keyFrame: f === 0 || f % fps === 0 });
          vf.close();
          bmpFrame.close();
        }

        await encoder.flush();
        encoder.close();
        bmp1.close();
        bmp2.close();
        resolve();
      } catch (err) {
        reject(err);
      }
    })();
  });

  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
