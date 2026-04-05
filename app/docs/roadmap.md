# PicMachina Roadmap: April 5 Update

## Phase 1: Infrastructure & The "Fast Core" (COMPLETE)
- [x] IndexedDB Master Store & Asset Metadata Store
- [x] EXIF Ingestion Engine
- [x] Core WASM Filters (Photon)
- [x] Metadata Workstation UI (Asset Panel)

## Phase 2: Semantic Intelligence & AI Enrichment (IN PROGRESS)
- [x] OCR Integration (Tesseract.js)
- [x] Human Signal Extraction (MediaPipe Pose/Face)
- [ ] **Task 2.5: Root Manifest Generation**
  - Implement a `manifest.json` for exports to track batch identity and image sequence order.
- [ ] **Task 2.6: Local AI Text Synthesis**
  - Utilize browser-native LLMs (e.g., Gemini Nano) to summarize OCR results into automatic tags.

## Phase 3: The Template Engine & Interactive Editor (NEW)
**Goal:** Transition from fixed grids to custom, user-defined perspective templates.

- [ ] **Task 3.1: Shared Perspective Rendering Utility**
  - Generalize the mesh-warp logic from `video-wall.js` into a shared engine utility for both video and still image aggregators.
- [ ] **Task 3.2: Template Schema & Storage**
  - Define a JSON schema for templates (background image ref + array of named quads with 4 normalized corner points).
  - Add a `templates` store to IndexedDB.
- [ ] **Task 3.3: UI: The Template Editor (TPL Screen)**
  - A new interactive screen where users can upload a background image and "draw" placeholders.
  - Support for dragging the 4 corner points of each placeholder to match perspective elements (like a photo frame on a wall or a billboard).
- [ ] **Task 3.4: Template Aggregator Node (`flow-template-aggregator`)**
  - A new aggregation node that accepts a Template ID and populates placeholders with batch images in sequence.

## Phase 4: Signature Creative Recipes
- [x] Photo Stack Animation (Polaroid/Desk)
- [x] Video Wall (Hardcoded Layouts)
- [ ] **Task 4.6: Recipe — The Comic Book**
  - Layout engine using `color-posterize` and `ai-face-privacy`.
  - Automated speech bubble rendering using `ocr` text data or `annotations`.
- [ ] **Task 4.7: Recipe — Geotemporal Timeline**
  - A scrolling narrative view using `meta-geocode` data and `exif.date` to map a trip's progression.
- [ ] **Task 4.8: Recipe — The Photomosaic**
  - High-complexity aggregator matching hundreds of thumbnails to a target image using `dominantColor` vision data.

## Phase 5: The Master Exporter & Project Bundling
- [ ] **Task 5.1: ZIP Bundling Engine (`fflate`)**
  - Streaming ZIP export including original media, `image.extension.json` sidecars, and the `manifest.json`.
- [ ] **Task 5.2: Metadata Write-Back**
  - Optional embedding of user-edited titles/tags/locations back into IPTC/XMP image headers during export.
- [ ] **Task 5.3: Project Re-hydration**
  - Logic to "Drop a ZIP" to restore the Asset Store and full application state from an archive





