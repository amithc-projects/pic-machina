# Project Roadmap: Advanced Media Aggregation & Storytelling

## Phase 1: Infrastructure & The "Fast Core"
**Goal:** Establish the application's "Brain" and provide instant utility with zero download bloat.

- [ ] **Task 1.1: IndexedDB State Manager**
  Build the local NoSQL store to hold the Master Schema. Every image/video is indexed by its unique file hash to maintain persistence across sessions.
- [ ] **Task 1.2: Metadata Ingestion Engine**
  Integrate `exif-js` to extract technical headers (GPS, Date, Camera, Lens) immediately upon file import.
- [ ] **Task 1.3: Core Image Filters (WASM)**
  Deploy **Photon** for instant, non-destructive adjustments (Warhol pop-art, saturation, brightness) that update the `editState` metadata.
- [ ] **Task 1.4: Semantic Sorter Logic**
  Implement folder-structuring logic using a Geocoding API to transform raw GPS coordinates into "City/Country/Neighborhood" strings.
- [ ] **Task 1.5: UI: Metadata Workstation**
  Build the sidebar "Inspector" panel for manual user overrides of Titles, Stories, and Tags.
- [ ] **Task 1.6: Before/After Slider**
  A lightweight JS/CSS utility to visually compare original files against filtered versions.

---

## Phase 2: Semantic Intelligence (OCR & PDF)
**Goal:** Use AI to understand the *content* of the files for deeper organization.

- [ ] **Task 2.1: OCR Integration**
  Integrate `Tesseract.js` as an on-demand WASM worker to extract text from whiteboards, signs, and documents.
- [ ] **Task 2.2: Text-to-Tag Pipeline**
  Implement a logic layer to "scrub" raw OCR text and suggest automated tags/titles for the `sources.ai.ocr` metadata block.
- [ ] **Task 2.3: Document Aggregator**
  Utilize `jsPDF` to create paginated PDF portfolios or expense sheets by grouping images with similar OCR keywords.
- [ ] **Task 2.4: Normalized Annotation Layer**
  Implement the logic to save coordinate-based notes (speech bubbles, ROI) using normalized floats to ensure cross-device compatibility:
  $$pos_x = \frac{pixel_x}{width}, \quad pos_y = \frac{pixel_y}{height}$$

---

## Phase 3: Advanced Vision & Motion
**Goal:** Capture "Human" signals and handle high-speed video previews.

- [ ] **Task 3.1: Human Signal Extraction**
  Integrate `MediaPipe` or `WebNN` (WASM) for Pose (Standing/Sitting/Lying) and Expression (Smile/Frown/Neutral) detection.
- [ ] **Task 3.2: Emotional Metadata Mapping**
  Map detected skeletal and facial signals into the `ai.vision.mood` and `ai.vision.pose` JSON fields.
- [ ] **Task 3.3: FFmpeg.wasm Worker**
  Set up a dedicated Web Worker for FFmpeg to handle heavy processing without freezing the UI thread.
- [ ] **Task 3.4: Recipe: Video Thumbnail GIF Creator**
  Extract 6 frames at regular intervals $\frac{T}{6}$ and encode a high-quality 2-pass GIF with custom palette generation.

---

## Phase 4: Signature Creative "Recipes"
**Goal:** Deploy high-complexity aggregations leveraging the metadata state.

- [ ] **Task 4.1: The Photomosaic Engine**
  Develop/integrate a custom Rust/WASM binary that utilizes `ai.vision.dominantColor` and `system.pHash` to match tile libraries to target images.
- [ ] **Task 4.2: Recipe: The "Brady Bunch" Grid**
  Implement the 3x3 video wall logic using FFmpeg `xstack` with 1:1 center-cropping.
- [ ] **Task 4.3: Audio Strategy (Solo vs. Mix)**
  Implement the `amix` audio filter for the video grid, allowing users to choose between a "Solo" track or a "Chaos Mix."
- [ ] **Task 4.4: Recipe: Comic Book Composition**
  Create a layout engine that draws "Pop-Art" filtered images into cells and overlays speech bubbles based on `user.annotations`.
- [ ] **Task 4.5: Recipe: Timeline & Animated Globe**
  Use `Leaflet.js` or `Three.js` to render the "Story" view, pulling geocoded text labels and EXIF dates into a chronological narrative.

---

## Phase 5: The Master Exporter & Bundler
**Goal:** Finalize the "Portable Project Archive" and "Write-Back" logic.

- [ ] **Task 5.1: Sidecar Generator**
  Logic to serialize IndexedDB records into the `image.extension.json` naming standard (e.g., `IMG_001.jpg.json`).
- [ ] **Task 5.2: The Master Manifest**
  Create a root-level `manifest.json` in the ZIP to store global project settings and non-image-specific recipe configurations.
- [ ] **Task 5.3: Bundling Engine (fflate)**
  Implement a streaming ZIP process to pack original media, sidecars, and the manifest without exceeding browser RAM limits.
- [ ] **Task 5.4: Optional Metadata Write-Back**
  ~~~javascript
  // Logic for Final Export
  if (userSettings.embedMetadata) {
    // Images: Use ExifTool-WASM for header injection
    // Videos: Use FFmpeg.wasm with -c copy for remuxing
  }
  ~~~
- [ ] **Task 5.5: Project Re-hydration Logic**
  Build the "Drop Zone" importer that reads an existing ZIP, pairs `*.*.json` files with their binaries, and restores the full application state.

