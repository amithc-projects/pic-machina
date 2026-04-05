/**
 * PicMachina — Scanner Worker
 * OpenCV processing pipeline safely isolated off the main thread.
 */

console.log('[Worker] Booting OpenCV...');
try {
  self.importScripts('https://cdn.jsdelivr.net/gh/wallat/compiled-opencvjs/v4.2.0/opencv.js');
  console.log('[Worker] Downloaded OpenCV script.');
} catch(e) {
  console.error('[Worker] importScripts failed:', e);
}

self.onmessage = async (e) => {
    const { id, imageData, width, height } = e.data;
    console.log('[Worker] Received task:', id);
    
    let retries = 0;
    
    // Fallback polling to ensure WASM is spun up
    const checkReady = () => {
        // Handle Promise-based Module return
        if (self.cv instanceof Promise) {
             self.cv.then(compiledCv => {
                 self.cv = compiledCv;
                 console.log('[Worker] Resolved OpenCV Promise.');
                 processData(id, imageData, width, height);
             }).catch(err => {
                 self.postMessage({ id, error: "OpenCV Init Promise Error: " + err.message });
             });
             return;
        }

        // Handle Function-based Initialization (Emscripten modularized builds) 
        if (typeof self.cv === 'function' && !self.cv._isInitializing) {
             console.log('[Worker] cv is a function. Initializing Emscripten module...');
             self.cv._isInitializing = true;
             
             // Wrap calling the function, some versions require it to be executed to return the promise
             const initResult = self.cv();
             if (initResult instanceof Promise) {
                  initResult.then(compiledCv => {
                      self.cv = compiledCv;
                      console.log('[Worker] Resolved OpenCV Function Promise.');
                      processData(id, imageData, width, height);
                  }).catch(err => {
                      self.postMessage({ id, error: "OpenCV Init Promise Error: " + err.message });
                  });
                  return;
             } else {
                  console.log('[Worker] OpenCV Function did not return a Promise, polling for mutation...');
                  // Re-assign self.cv to the object returned
                  if (initResult && typeof initResult === 'object') self.cv = initResult;
             }
        }
        
        if (self.cv && self.cv.Mat) {
            console.log('[Worker] OpenCV Math bindings found! Processing.');
            processData(id, imageData, width, height);
        } else {
            retries++;
            if (retries > 50) { // 5 seconds
                self.postMessage({ id, error: "OpenCV failed to initialize in worker after 5 seconds." });
                return;
            }
            if (retries % 10 === 0) console.log(`[Worker] Waiting for cv.Mat... (cv is ${typeof self.cv})`);
            setTimeout(checkReady, 100);
        }
    };
    checkReady();
};

function processData(id, imageDataRaw, W, H) {
    try {
        const cv = self.cv;
        
        // Reconstruct ImageData from the raw Uint8ClampedArray buffer
        const imgArray = new Uint8ClampedArray(imageDataRaw);
        
        // Load into OpenCV buffer
        const src = cv.matFromArray(H, W, cv.CV_8UC4, imgArray);
        
        const gray = new cv.Mat();
        const blurred = new cv.Mat();
        const edges = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.Canny(blurred, edges, 50, 150);

        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

        const found = [];
        const minArea = (W * H) * 0.005; // Drop anything under 0.5% screen size

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const peri = cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.02 * peri, true);
            
            if (approx.rows === 4 && approx.cols === 1) {
                const area = cv.contourArea(approx);
                if (area > minArea && cv.isContourConvex(approx)) {
                    let pts = [];
                    for (let j = 0; j < 4; j++) {
                        pts.push({
                           x: approx.data32S[j*2],
                           y: approx.data32S[j*2+1]
                        });
                    }
                    found.push(pts);
                }
            }
            approx.delete();
            contour.delete();
        }

        src.delete(); gray.delete(); blurred.delete(); edges.delete();
        contours.delete(); hierarchy.delete();

        // Process found array to map to 0-1 scale safely
        const results = [];
        const similarityThreshold = 0.05;
        
        found.forEach(pts => {
            const normalized = pts.map(p => ({
                x: p.x / W,
                y: p.y / H
            }));

            // Calculate exact center
            const cx = normalized.reduce((sum, p) => sum + p.x, 0) / 4;
            const cy = normalized.reduce((sum, p) => sum + p.y, 0) / 4;
            
            // Revolve coordinates to consistently start top-left mapped
            normalized.sort((a,b) => {
                const angleA = Math.atan2(a.y - cy, a.x - cx);
                const angleB = Math.atan2(b.y - cy, b.x - cx);
                return angleA - angleB;
            });
            
            // Clean up concentric borders inherently detected on thick frames
            const isDuplicate = results.some(existing => {
                let totalDiff = 0;
                for (let k = 0; k < 4; k++) {
                    totalDiff += Math.abs(normalized[k].x - existing.points[k].x);
                    totalDiff += Math.abs(normalized[k].y - existing.points[k].y);
                }
                return totalDiff < similarityThreshold;
            });
            
            if (!isDuplicate) {
                results.push({ points: normalized });
            }
        });

        self.postMessage({ id, results });
    } catch (err) {
        self.postMessage({ id, error: err.message });
    }
}
