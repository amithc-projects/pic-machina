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
- [x] **Task 4.6: Recipe — Graphic Novel / Comic Style**
  - `sys-graphic-novel`: Kuwahara smooth → colour boost → inverted Sobel edge detect (multiply blend) → ink-line portrait.
  - `sys-graphic-novel-bold`: as above with posterisation for a harder comic-book panel look.
  - `filter-edge-detect` extended: added `invertEdges` toggle and `multiply` blend mode specifically for ink-line compositing.
  - [ ] Automated speech bubble rendering using OCR text or annotations (future).
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

## Phase 5d: Creative Effects & Persistence (COMPLETE)

- [x] **`filter-relight`** — up to 3 independent point lights via ambient darkening + screen-mode radial gradients. Configurable colour, intensity, position (X/Y %), and radius per light.
- [x] **`ai-glow-eyes`** — BlazeFace detects eye-centre keypoints; replaces irises with coloured glow (iris fill + dark pupil + screen radial falloff). Used by `sys-vampire-gfx`.
- [x] **`sys-vampire-gfx`** — chalk-white pallor via near-full desaturation, cold colour grade, Kuwahara skin smoothing, bloom glow, and AI glowing red eyes.
- [x] **File System Shadow Persistence** — after every mutation to recipes/blocks/templates, JSON shadow files are written fire-and-forget to `.PicMachina/data/` inside the project root. On startup, if IndexedDB is empty, data is silently restored from these files.
- [x] **Shared current folder** — input folder is synchronised across all four active screens (Batch Setup, Recipe Builder, Step Editor, Folder Viewer); MRU dropdown in Recipe Builder toolbar.
- [x] **Thumbnail picker in Recipe Builder** — browse for any image file directly from the recipe config panel; stored as base64 data URL in IndexedDB.
- [x] **File-type filtering** — workspace carousel and folder picker respect `recipe.inputType` (image / video / any); Step Editor applies additional per-step video filtering.

## Phase 5e: ShowCase Screen (PLANNED)

A visual portfolio layer that lets users highlight and document their best runs.

- [ ] **Task 5e.1: `showcases` IndexedDB store** — new store in `db.js`; CRUD helpers in `src/data/showcases.js`
- [ ] **Task 5e.2: ShowCase screen (`src/screens/shc.js`)** — large-card grid list view; detail view with sample images, editable title/description, recipe link, and "Run Again" button
- [ ] **Task 5e.3: Horizontal pipeline diagram** — recipe nodes rendered as a scrollable left-to-right card strip with step icons, names, and param pills; clicking a card shows all params in a popover
- [ ] **Task 5e.4: "Add to ShowCase" entry points** — star button on completed run rows and gallery header in Output History (`out.js`); toolbar button in Folder Viewer when browsing a run's output (`fld.js`)
- [ ] **Task 5e.5: In-ShowCase curation** — swap sample images (up to 5), edit title/description inline with auto-save debounce

---

## Phase 6: The Master Exporter & Project Bundling
- [ ] **Task 6.1: ZIP Bundling Engine (`fflate`)**
  - Streaming ZIP export including original media, `image.extension.json` sidecars, and the `manifest.json`.
- [ ] **Task 6.2: Metadata Write-Back**
  - Optional embedding of user-edited titles/tags/locations back into IPTC/XMP image headers during export.
- [ ] **Task 6.3: Project Re-hydration**
  - Logic to "Drop a ZIP" to restore the Asset Store and full application state from an archive.

## Phase 7: Advanced Imagery & Color (PLANNED)
- [ ] **Task 7.1: Cinematic Color Grading (LUTs)**
  - Support for uploading `.cube` or `.3dl` Look-Up Tables to apply professional, cinematic color grading consistently across media batches.
- [ ] **Task 7.2: Histogram Level Adjustments**
  - Add nodes to programmatically adjust and normalize image histogram levels (shadows, midtones, highlights) to ensure consistent exposure.
- [x] **Task 7.3: Scrolling Screen Capture Animation (`flow-video-scroll`)**
  - A transformation that takes a long/tall image (e.g., a full-page website screenshot), scales it to fit the viewport width, and creates a video that slowly scrolls from top to bottom, pausing briefly at the end to allow for easy reading.
