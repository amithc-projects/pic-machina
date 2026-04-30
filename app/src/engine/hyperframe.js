import { avcCodec } from './video-convert.js';

export async function createStandaloneHyperframe(htmlContent, { fps = 30, width = 1920, height = 1080, durationFallback = 5, onProgress } = {}) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');

  // Ensure GSAP is globally available (in case it's not injected yet)
  if (!window.gsap) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Failed to load GSAP'));
      document.head.appendChild(script);
    });
  }

  // Reset the timelines registry so we don't accidentally grab an old animation
  window.__timelines = {};
  
  const w = width % 2 === 0 ? width : width - 1;
  const h = height % 2 === 0 ? height : height - 1;

  // To use native drawElement, the canvas must be in the DOM (to have a layout subtree),
  // and the HTML container must be an immediate child of the canvas.
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.style.position = 'fixed';
  // Use off-screen positioning rather than opacity, because opacity affects drawElement and creates transparent (black) videos
  canvas.style.top = '-9999px';
  canvas.style.left = '-9999px';
  canvas.style.pointerEvents = 'none';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // Set up an invisible container attached inside the canvas
  const container = document.createElement('div');
  container.style.width = w + 'px';
  container.style.height = h + 'px';
  container.style.overflow = 'hidden';
  container.innerHTML = htmlContent || '';
  canvas.appendChild(container);

  // Execute scripts found in the injected HTML template manually,
  // since innerHTML does not execute scripts automatically.
  const scripts = container.querySelectorAll('script');
  for (const s of scripts) {
      if (s.src && !s.src.includes('gsap.min.js')) {
         await new Promise((res) => {
             const extScript = document.createElement('script');
             extScript.src = s.src;
             extScript.onload = res;
             extScript.onerror = res;
             document.body.appendChild(extScript);
         });
      } else if (!s.src) {
         try {
             // Execute inline GSAP timeline definition
             const func = new Function(s.textContent);
             func.call(window);
         } catch (e) {
             console.warn('[Hyperframe] Inline script error:', e);
         }
      }
  }

  // Force layout flush so the browser paints the DOM nodes
  await new Promise(r => requestAnimationFrame(r));
  canvas.offsetHeight; 

  let duration = durationFallback;
  let tl = null;
  if (window.__timelines) {
      const tlKey = Object.keys(window.__timelines)[0];
      tl = window.__timelines[tlKey];
      if (tl) {
          duration = tl.duration();
          tl.pause();
      }
  }

  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, video: { codec: 'avc', width: w, height: h }, fastStart: 'in-memory' });

  let useDrawElement = false;
  if (ctx.drawElement) {
      try {
          ctx.drawElement(container, 0, 0);
          useDrawElement = true;
      } catch(e) {}
  }

  await new Promise((resolve, reject) => {
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: err => reject(new Error(`VideoEncoder Error: ${err.message}`)),
    });
    
    encoder.configure({ codec: avcCodec(w, h), width: w, height: h, bitrate: 8_000_000, framerate: fps });

    const totalFrames = Math.max(1, Math.ceil(duration * fps));
    let fi = 0;

    async function encodeNextFrame() {
      if (fi >= totalFrames) {
        await encoder.flush();
        encoder.close();
        resolve();
        return;
      }

      const ts = fi / fps;
      if (tl) {
          tl.seek(ts);
      }

      ctx.clearRect(0, 0, w, h);

      let drawnNatively = false;
      if (useDrawElement) {
          try {
             ctx.drawElement(container, 0, 0);
             drawnNatively = true;
          } catch(e) {
             useDrawElement = false; // layout error, fallback gracefully
          }
      }
      
      if (!drawnNatively) {
         // SVG foreignObject Fallback
         const serializer = new XMLSerializer();
         let safeHtml = serializer.serializeToString(container);
         if (!safeHtml.includes('xmlns=')) {
             safeHtml = safeHtml.replace(/^<div/, '<div xmlns="http://www.w3.org/1999/xhtml"');
         }
         const svg = `
           <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
             <foreignObject width="100%" height="100%">
               ${safeHtml}
             </foreignObject>
           </svg>
         `;
         const dataUri = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg.trim())));
         await new Promise((res) => {
             const img = new Image();
             img.onload = () => { ctx.drawImage(img, 0, 0); res(); };
             img.onerror = () => res();
             img.src = dataUri;
         });
      }

      const bmp = await createImageBitmap(canvas);
      const vf = new VideoFrame(bmp, { timestamp: fi * (1_000_000 / fps) });
      encoder.encode(vf, { keyFrame: fi % (fps * 2) === 0 });
      vf.close();
      bmp.close();

      if (fi % Math.max(1, Math.floor(fps)) === 0 && onProgress) {
         onProgress(Math.floor((fi / totalFrames) * 100));
      }

      fi++;
      // Yield to the event loop occasionally so the UI doesn't completely freeze
      setTimeout(encodeNextFrame, 0);
    }

    encodeNextFrame();
  });

  document.body.removeChild(canvas);
  muxer.finalize();
  
  return new Blob([target.buffer], { type: 'video/mp4' });
}
