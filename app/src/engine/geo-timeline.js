import { fetchRenderedMap } from './utils/map-tiles.js';

function lerp(start, end, amt) {
  return (1 - amt) * start + amt * end;
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export async function createGeoTimeline(blobs, metadata, originalNames, {
  width = 1920,
  height = 1080,
  fps = 30,
  durationPerPhoto = 3.0,
  transitionDuration = 1.0,
  onProgress,
  onLog
} = {}) {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer');
  
  // 1. Extract GPS coords
  const missingFiles = [];
  const points = metadata.map((m, i) => {
    let lat = null, lon = null;
    let city = '', country = '';
    
    // Extract coords from EXIF
    if (m.exif && m.exif.gps && m.exif.gps.lat !== undefined) {
      lat = parseFloat(m.exif.gps.lat);
      lon = parseFloat(m.exif.gps.lng);
    }

    // Extract reverse-geocoded labels from Sidecar/Geo
    if (m.sidecar) {
      city = m.sidecar.city || '';
      country = m.sidecar.country || '';
    }
    
    // Add date formatting
    let dateStr = '';
    if (m.exif && m.exif.date) {
      let d = m.exif.date;
      if (typeof d === 'string') d = d.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
      const parsed = new Date(d);
      if (!isNaN(parsed.getTime())) {
        dateStr = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      }
    }
    
    return { lat, lon, city, country, dateStr, index: i };
  }).filter((p, i) => {
    if (p.lat === null || isNaN(p.lat) || p.lon === null || isNaN(p.lon)) {
      missingFiles.push(originalNames[i] || `Image ${i+1}`);
      return false;
    }
    return true;
  });

  if (missingFiles.length > 0 && onLog) {
    onLog('warn', `Geo-Timeline: ${missingFiles.length} image(s) skipped due to missing GPS metadata: ${missingFiles.slice(0, 5).join(', ')}${missingFiles.length > 5 ? '...' : ''}`);
  }

  if (points.length === 0) {
    if (onLog) onLog('error', 'Skipping Geo-Timeline: No GPS location data found in any of the provided images.');
    throw new Error('Geo-Timeline requires images with GPS Exif data. None was found.');
  }

  // 2. Fetch Base Map
  const { canvas: mapCanvas, getPixelCoordsForLonLat } = await fetchRenderedMap(points, 200, onLog);
  const mapCtx = mapCanvas.getContext('2d');

  // 3. (Path drawing removed from static base map; now handled progressively in video frame loop)
  
  // Map has the path drawn. We do NOT draw nodes here, because we want 
  // to scale and highlight them on the video frame dynamically.

  // 4. Setup Video Encoder
  const target = new ArrayBufferTarget();
  const muxer  = new Muxer({ target, video: { codec: 'avc', width, height }, fastStart: 'in-memory' });

  let doneFrames = 0;
  const totalFrames = Math.ceil(blobs.length * durationPerPhoto * fps);
  
  await new Promise((resolve, reject) => {
    const encoder = new globalThis.VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta);
        doneFrames++;
        onProgress?.(doneFrames, totalFrames);
      },
      error: reject
    });
    
    encoder.configure({
      codec: 'avc1.640028',
      width: width, height: height,
      bitrate: 8_000_000,
      framerate: fps
    });

    const c = document.createElement('canvas');
    c.width = width; c.height = height;
    const ctx = c.getContext('2d');

    const encodeFrame = async () => {
      onLog?.(`Decoding all ${blobs.length} images...`);
      const bmps = [];
      for (let i=0; i<blobs.length; i++) {
         const bmp = await createImageBitmap(blobs[i]);
         bmps.push(bmp);
      }
      
      const framesPerSlide = fps * durationPerPhoto;
      const transFrames = fps * transitionDuration;
      
      for (let f = 0; f < totalFrames; f++) {
        const slideIdx = Math.floor(f / framesPerSlide);
        const subFrame = f % framesPerSlide;
        
        const currentBmp = bmps[slideIdx];
        const nextBmp = slideIdx + 1 < bmps.length ? bmps[slideIdx + 1] : null;
        
        const pStage = Math.min(1.0, subFrame / transFrames); // 0 to 1 during transition, then 1.0 (holds)
        let pAmt = easeInOutCubic(pStage);
        
        const ptIdx = Math.min(slideIdx, points.length - 1);
        const prevPtIdx = Math.max(0, ptIdx - 1);
        const prevPt = points[prevPtIdx];
        const currPt = points[ptIdx];
        
        // Map Target Camera coords (Interpolate from previous location to current location during crossfade)
        const c1 = getPixelCoordsForLonLat(prevPt?.lon, prevPt?.lat);
        const c2 = getPixelCoordsForLonLat(currPt?.lon, currPt?.lat);
        const curMapX = lerp(c1.x, c2.x, pAmt);
        const curMapY = lerp(c1.y, c2.y, pAmt);
        
        // Draw Layout (Left 40% Map, Right 60% Photo)
        const mapW = width * 0.4;
        const photoW = width * 0.6;
        
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
        
        // Calculate Map Zoom (baseZoom is zoomed IN, maxZoomOut is zoomed OUT mid-flight)
        const distance = Math.hypot(c2.x - c1.x, c2.y - c1.y);
        const zoomArc = Math.sin(pAmt * Math.PI); // parabolic jump (0 -> 1 -> 0)
        // Only zoom out if the destination is actually far enough away to warrant it (e.g. not just GPS jitter at the same spot)
        const maxZoomOut = distance > 500 ? 1.0 : (distance > 20 ? 0.6 : 0.3);
        const baseZoom = 0.3; // 0.3x means tight crop zoom on the point!
        const currentZoomScale = baseZoom + (maxZoomOut - baseZoom) * zoomArc;
        
        // Draw Map Viewport (Center map cam at curMapX/Y)
        const srcW = mapW * currentZoomScale;
        const srcH = height * currentZoomScale;
        const mcX = curMapX - srcW/2;
        const mcY = curMapY - srcH/2;
        ctx.drawImage(mapCanvas, mcX, mcY, srcW, srcH, 0, 0, mapW, height);
        
        // Draw Progressive Map Lines
        ctx.beginPath();
        ctx.lineWidth = 6;
        ctx.strokeStyle = 'rgba(30, 144, 255, 0.7)'; // dodgerblue
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        let hasLine = false;
        
        // Draw fully completed lines up to slideIdx - 1
        const maxCompletedLine = Math.min(slideIdx, points.length - 1);
        for (let i = 0; i < maxCompletedLine; i++) {
          const ptA = getPixelCoordsForLonLat(points[i]?.lon, points[i]?.lat);
          const ptB = getPixelCoordsForLonLat(points[i+1]?.lon, points[i+1]?.lat);
          
          const sxA = (ptA.x - mcX) / srcW * mapW;
          const syA = (ptA.y - mcY) / srcH * height;
          const sxB = (ptB.x - mcX) / srcW * mapW;
          const syB = (ptB.y - mcY) / srcH * height;
          
          if (i === 0) ctx.moveTo(sxA, syA);
          else ctx.lineTo(sxA, syA);
          ctx.lineTo(sxB, syB);
          hasLine = true;
        }
        
        // Interpolate the *currently drawing* line towards slideIdx point
        if (slideIdx > 0 && slideIdx < points.length && distance > 5) {
          const ptA = getPixelCoordsForLonLat(points[slideIdx - 1]?.lon, points[slideIdx - 1]?.lat);
          const ptB = getPixelCoordsForLonLat(points[slideIdx]?.lon, points[slideIdx]?.lat);
          
          const sxA = (ptA.x - mcX) / srcW * mapW;
          const syA = (ptA.y - mcY) / srcH * height;
          const sxB = (ptB.x - mcX) / srcW * mapW;
          const syB = (ptB.y - mcY) / srcH * height;
          
          const tipX = lerp(sxA, sxB, pAmt);
          const tipY = lerp(syA, syB, pAmt);
          
          if (!hasLine) {
            ctx.moveTo(sxA, syA);
            hasLine = true;
          }
          ctx.lineTo(tipX, tipY);
        }
        
        if (hasLine) ctx.stroke();

        // Draw Nodes
        for (let i = 0; i <= slideIdx && i < points.length; i++) {
          const pt = getPixelCoordsForLonLat(points[i]?.lon, points[i]?.lat);
          const screenX = (pt.x - mcX) / srcW * mapW;
          const screenY = (pt.y - mcY) / srcH * height;
          
          if (screenX >= -50 && screenX <= mapW + 50 && screenY >= -50 && screenY <= height + 50) {
             const isCurrentNode = i === slideIdx;
             
             ctx.beginPath();
             let radius = 8;
             if (isCurrentNode) radius = lerp(8, 20, pAmt);
             else if (i === slideIdx - 1) radius = lerp(20, 8, pAmt);
             
             ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
             ctx.fillStyle = isCurrentNode ? '#ffffff' : '#e2e8f0';
             ctx.fill();
             ctx.lineWidth = 4;
             ctx.strokeStyle = isCurrentNode ? '#3b82f6' : '#94a3b8';
             ctx.stroke();
             
             // Ping visual wave upon arrival
             if (isCurrentNode && pAmt > 0.7) {
               const pingScale = (pAmt - 0.7) / 0.3; // 0 to 1
               const pingRadius = radius + (pingScale * 30);
               ctx.beginPath();
               ctx.arc(screenX, screenY, pingRadius, 0, Math.PI * 2);
               ctx.fillStyle = `rgba(59, 130, 246, ${(1.0 - pingScale) * 0.5})`;
               ctx.fill();
             }
          }
        }
        
        // Map Divider Line
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(mapW, 0, 8, height);
        
        // Photo Crossfade Renderer
        const renderPhoto = (bmp, alpha) => {
          if (!bmp) return;
          ctx.globalAlpha = alpha;
          const scale = Math.max(photoW / bmp.width, height / bmp.height);
          // subtle zoom effect
          const extraZoom = 1.0 + (0.05 * (subFrame / framesPerSlide));
          const fScale = scale * extraZoom;
          const sw = bmp.width * fScale;
          const sh = bmp.height * fScale;
          ctx.drawImage(bmp, mapW + 8 + (photoW - sw)/2, (height - sh)/2, sw, sh);
          ctx.globalAlpha = 1.0;
        };
        
        let fadeAmt = 0; // 0 = start of transition, 1 = fully current image
        if (subFrame < transFrames && slideIdx > 0) {
           // Transitioning from previous
           fadeAmt = subFrame / transFrames;
           const prevBmp = bmps[slideIdx - 1];
           renderPhoto(prevBmp, 1 - fadeAmt);
           renderPhoto(currentBmp, fadeAmt);
        } else {
           renderPhoto(currentBmp, 1.0);
        }
        
        // Draw Overlay Box
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(mapW + 40, height - 160, photoW - 80, 120);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 48px Inter, sans-serif';
        const locStr = currPt?.city ? `${currPt.city}, ${currPt.country}` : `Point ${ptIdx+1}`;
        ctx.fillText(locStr, mapW + 70, height - 90);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '32px Inter, sans-serif';
        ctx.fillText(currPt?.dateStr || 'Unknown Date', mapW + 70, height - 60);

        const vf = new VideoFrame(c, { timestamp: Math.round((f / fps) * 1_000_000) });
        encoder.encode(vf);
        vf.close();
        
        // Yield to browser to prevent hanging
        if (f % 5 === 0) await new Promise(r => setTimeout(r, 0));
      }
      
      for (const bmp of bmps) bmp.close();
      await encoder.flush();
      encoder.close();
      resolve();
    };
    
    encodeFrame().catch(reject);
  });

  muxer.finalize();
  return new Blob([target.buffer], { type: 'video/mp4' });
}
