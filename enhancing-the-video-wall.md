# Enhancing the Video Wall Compositor

## Background
The current video wall functionality (`src/engine/video-wall.js`) composites multiple input video files into a single MP4 output. It uses a regular, programmatically calculated grid logic (e.g., 1x2, 2x2, 3x3) where videos are placed into fixed rectangular cells side-by-side. 

This document explores the feasibility and architectural decisions required to extend this engine to support **templatable compositions**. In this model, the system accepts a base template image (e.g., a living room with a TV screen) alongside a set of custom placeholder coordinates, allowing videos to be drawn seamlessly into real-world visual contexts.

## 1. Freeform Bounding Boxes and Backgrounds
* **The Goal**: Replace the rigid grid logic with an arbitrary placement system, where videos are positioned via `x, y, w, h` boundaries over a custom background image.
* **Feasibility**: Highly Feasible.
* **Analysis**: The compositing engine already relies on the HTML5 Canvas API (`ctx.drawImage`) prior to encoding each frame. Furthermore, the core `drawCell` function is decoupled from the grid logic—it natively accepts arbitrary boundary coordinates and scales/crops the video accordingly (`cover` or `contain`).
* **Implementation Path**: 
  1. Add parameters for a `backgroundImage` and a `regions` array containing bounding boxes.
  2. During the setup phase, load the template logic as an `ImageBitmap`.
  3. Inside the per-frame loop, replace the black canvas clear (`ctx.fillRect`) with a draw call for the background image, and iterate over `regions` rather than calculated rows/columns.

## 2. Advanced Perspective and "Screen Replacement"
* **The Goal**: Allow videos to be placed onto screens that are angled away from the camera. This requires rotating and manipulating the rectangular video frame to fit into an arbitrary 4-point quadrilateral on the template image (a visual corner-pinning effect).
* **Feasibility**: Highly feasible, but requires an architectural shift in the renderer.
* **Analysis**: 
  - Standard HTML5 Canvas 2D supports **Affine Transforms** (translation, rotation, scaling, and skewing/shearing). While "shearing" can turn the video into a parallelogram, it cannot create true vanishing-point perspective (where the far edge of the TV appears meaningfully smaller than the near edge).
  - To perfectly map a rectangle to any 4 arbitrary corners, a true perspective transform is required. This falls outside the capabilities of the native 2D API.
* **Implementation Path (The "Perfect" Way)**: Upgrade the internal rendering canvas from a `2d` context to a `webgl` context. WebGL natively handles 3D perspective projection and texture mapping.

## 3. WebGL Performance Impact
Adopting WebGL for true perspective mapping raises natural questions about performance. The pivot to WebGL will have a **neutral to strictly positive impact on runtime speed**.

* **Rendering Efficiency**: WebGL interacts directly with the GPU. Mapping video textures to geometry is its primary use case, meaning the perspective math is executed flawlessly by hardware, typically running faster than CPU-bound Canvas 2D math.
* **Data Transfer Pipeline**: Modern browsers fully support passing WebCodecs `VideoFrame` hardware surfaces directly into WebGL textures (zero-copy GPU uploads).
* **Frame Reading**: The current pipeline runs `new VideoFrame(canvas)` to pass the composited result to the encoder. This API extracts pixel payloads at the exact same speeds regardless of whether the source is a 2D or WebGL context.
* **The Trade-off**: The only "cost" is code complexity. Adopting WebGL replaces a single `ctx.drawImage()` call with approximately 50–100 lines of boilerplate to compile shaders and upload vertex buffers. 

## Summary
The goal of converting the procedural grid generator into a robust, context-aware template engine is highly sound. 

Moving forward, the recommended approach is to skip halfway measures (like 2D shearing hacks) and immediately refactor `video-wall.js` to utilize a minimal WebGL pipeline. This ensures videos can be accurately mapped to any screen in any orientation, unlocking perfect visual realism for users.
