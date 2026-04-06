# Image Stitching (Panoramas) Implementation Plan

Adding client-side image stitching to combine overlapping photos into a single panorama is a highly complex, computationally intensive task. Doing this completely offline in the browser without server-side processing requires specific architectures to prevent browser memory crashes.

## 1. Library Identification

The definitive gold standard for this task is **OpenCV (compiled to WebAssembly via OpenCV.js)**. 

While there are pure-JS algorithms (like `jsfeat`), they lack the sophisticated feature matching, bundle adjustment, seam finding, and multi-band blending required for seamless panoramas. OpenCV contains a dedicated, highly robust `cv::Stitcher` pipeline.

> [!WARNING]
> **The OpenCV.js Module Problem**
> Standard pre-compiled NPM packages for OpenCV.js (e.g., `@techstark/opencv-js`) **do not include the `stitching` module by default**. The OpenCV maintainers exclude it because it significantly inflates the `.wasm` file size and exposes complicated C++ types (like `cv::UMat`) that don't bind easily to JavaScript.

To explicitly use `cv.Stitcher.create()`, we typically need a **custom Emscripten build** of OpenCV with `-DBUILD_opencv_stitching=ON` and heavily whitelisted bindings.

## 2. Proposed Architecture for PicMachina

Since PicMachina is a local-first node engine, we will implement this as a new Aggregator Node (`flow-photo-stitcher`).

### Node Definition (`system-recipes.js`)
- **ID**: `flow-photo-stitcher`
- **Params**: `mode` (Panorama / Scans), `projection` (Spherical / Cylindrical), `crop` (Boolean: to trim irregular black edges after warping).

### Processing Layer (`worker.js`)
- Unlike `flow-face-swap` (which uses MediaPipe and must run on the Main Thread), OpenCV.js runs perfectly purely in a Web Worker environment.
- The aggregation phase will execute in the Background Worker. We will load the WASM binary asynchronously to prevent blocking.

### Memory Management (Critical)
- Image stitching uses extreme amounts of RAM. We must enable `ALLOW_MEMORY_GROWTH` flags in the WASM build.
- We must manually garbage collect (`mat.delete()`) every intermediate frame fed into the stitcher, otherwise the browser will silently crash with an OOM (Out Of Memory) error on the 3rd or 4th image.

## 3. Potential Paths Forward

1. **The Custom Build Path**: Write the Docker/Emscripten bash script necessary to pull the OpenCV C++ source, whitelist the `Stitcher` API, and compile a custom `opencv_picmachina.js` with WASM for the app.
2. **The Feature-Matching Fallback (Pure JS)**: Avoid a heavy 15MB+ custom WASM binary by using a lightweight library like `jsfeat` combined with a manually written RANSAC homography Javascript implementation. (Fast, but prone to visible "seams" and ghosting, as it lacks advanced blending).
3. **Pre-compiled Repositories**: Scrape Github for someone who has already successfully built and published an OpenCV WASM binary with the Stitching module exposed.
