# PicMachina Roadmap

## Phase 1: Infrastructure & The "Fast Core" (COMPLETE)
- [x] IndexedDB Master Store & Asset Metadata Store
- [x] EXIF Ingestion Engine
- [x] Core WASM Filters (Photon)
- [x] Metadata Workstation UI (Asset Panel)

## Phase 2: Semantic Intelligence & AI Enrichment (COMPLETE)
- [x] OCR Integration (Tesseract.js)
- [x] Human Signal Extraction (MediaPipe Pose/Face)
- [x] Root Manifest Generation
- [x] Local AI Text Synthesis (browser-native LLM tag extraction)

## Phase 3: The Template Engine & Interactive Editor (COMPLETE)
**Goal:** Transition from fixed grids to custom, user-defined perspective templates.

- [x] **Task 3.1: Shared Perspective Rendering Utility**
  - Generalized mesh-warp logic from `video-wall.js` into a shared engine utility.
- [x] **Task 3.2: Template Schema & Storage**
  - JSON schema for templates (background image ref + array of named quads with 4 normalized corner points). `templates` store in IndexedDB.
- [x] **Task 3.3: UI: The Template Editor (TPL Screen)**
  - Interactive screen where users upload a background image and draw quadrilateral placeholders by dragging 4 corner points.
- [x] **Task 3.4: Template Aggregator Node (`flow-template-aggregator`)**
  - Maps batch images sequentially into template slots using perspective projection.
  - Extended to support `flow-video-wall` — maps multiplexed videos into template slots natively with looping video backgrounds.

## Phase 4: Signature Creative Recipes (COMPLETE)
- [x] Photo Stack Animation (Polaroid/Desk)
- [x] Video Wall (Hardcoded + Template Layouts)
- [x] WebGL Slideshow Stitcher (`flow-video-stitcher`) with GPU crossfades and cinematic motion
- [x] Metadata Timeline Sequencer (`flow-title-slide`) — injects interstitial title slides on structural metadata changes
- [ ] **Task 4.6: Recipe — The Comic Book**
  - Layout engine using `color-posterize` and `ai-face-privacy`.
  - Automated speech bubble rendering using OCR text or annotations.
- [ ] **Task 4.7: Recipe — Geotemporal Timeline**
  - Scrolling narrative view using `meta-geocode` data and `exif.date` to map a trip's progression.
- [ ] **Task 4.8: Recipe — The Photomosaic**
  - High-complexity aggregator matching hundreds of thumbnails to a target image using `dominantColor` vision data.
- [ ] **Task 4.10: Image Stitching**
  - Generate a combined image from a sequence of overlapping photos (e.g., panoramas).

## Phase 5: Video Operations (COMPLETE)

Full video pipeline built on **mediabunny** (WebCodecs-based conversion engine).

### Phase 5a: Format & Container Operations (COMPLETE)
- [x] `flow-video-convert` — re-encode to different container/codec
- [x] `flow-video-trim` — cut to time range
- [x] `flow-video-compress` — reduce file size via quality presets or custom bitrate
- [x] `flow-video-change-fps` — retarget frame rate
- [x] `flow-video-concat` — join all selected videos end-to-end (aggregation node)

### Phase 5b: Audio Operations (COMPLETE)
- [x] `flow-video-strip-audio` — remove all audio tracks
- [x] `flow-video-extract-audio` — export audio track as MP3/WAV/FLAC/Ogg/AAC
- [x] `flow-video-remix-audio` — adjust channel layout (stereo↔mono) and/or sample rate

### Phase 5c: Per-Frame Video Effects (COMPLETE)
- [x] 8 video effect transforms (`video-*`) applying existing image effects to every decoded frame:
  - `video-tuning`, `video-duotone`, `video-tint`, `video-vignette`
  - `video-advanced-effects`, `video-bloom`, `video-color-grade`, `video-chromatic-aberration`
- [x] Progress logging with frame count and ETA during batch runs
- [x] Frame preview in Recipe Builder and Step Editor (no re-encode needed)
- [x] Video thumbnail sidecars (`.{videoname}.preview.jpg`) — generated in background in Folder Viewer and Batch Setup; user can set custom preview frame via camera button

## Phase 6: The Master Exporter & Project Bundling
- [ ] **Task 6.1: ZIP Bundling Engine (`fflate`)**
  - Streaming ZIP export including original media, `image.extension.json` sidecars, and the `manifest.json`.
- [ ] **Task 6.2: Metadata Write-Back**
  - Optional embedding of user-edited titles/tags/locations back into IPTC/XMP image headers during export.
- [ ] **Task 6.3: Project Re-hydration**
  - Logic to "Drop a ZIP" to restore the Asset Store and full application state from an archive.
