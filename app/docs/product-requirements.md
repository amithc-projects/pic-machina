# Product Requirements Document: PicMachina

## 1. Project Overview

PicMachina is a **local-first, browser-based desktop application** for high-performance batch image processing. Users build **Recipes** — ordered sequences of transform nodes — and run them against a local folder of images. All processing happens entirely on the user's device using the File System Access API; no images are uploaded to any server.

The application targets photographers, content teams, and power users who need repeatable, automated image workflows without cloud dependencies.

---

## 2. Core Concepts

| Concept | Description |
|---|---|
| **Recipe** | A named, reusable workflow — a tree of transform nodes |
| **Node** | A single operation: resize, color grade, export, etc. |
| **Branch node** | Splits execution into parallel output paths (e.g. thumbnail + full-res) |
| **Conditional node** | If/else logic based on image properties (orientation, GPS presence, metadata) |
| **Aggregation node** | Collects one frame per image across the batch, then combines into a single output (GIF, MP4, contact sheet, stack animation) |
| **Template** | A reusable background image or video with 4-point quadrilateral placeholder slots. Slots can be auto-detected via OpenCV or mapped manually. |
| **Block** | A reusable group of nodes that can be referenced inside any recipe |
| **Run Parameters** | Recipe-level variables surfaced as a form before each batch run; values override matching node params by name |
| **System Recipe** | Read-only built-in recipe; users can clone to customise |

---

## 3. Functional Requirements

### 3.1 Environment & File Access

- **Local-only operation**: all transforms execute on-device via Canvas API and Web Workers
- **File System Access API**: users grant access to input and output directories; handles are persisted in IndexedDB and re-verified on next launch
- **Non-destructive**: original files are never modified; outputs saved to a configurable subfolder
- **File System Shadow Persistence**: after every recipe/block/template save, JSON shadow files are written to `.PicMachina/data/` inside the linked project root folder. On startup, if IndexedDB is empty, data is silently restored from these shadow files — surviving browser storage clears
- **Shared current folder**: the selected input folder is synchronised across the Recipe Library, Batch Setup, Recipe Builder, and Step Editor screens. Changing the folder in any one screen updates all others
- **Project Root Linking**: users can link their project root directory in Settings. This enables thumbnail storage to `public/user-samples/` and shadow persistence. Thumbnails are always stored as base64 in IndexedDB for reliable display regardless of server configuration
- **Format support**: JPEG, PNG, WebP, HEIC, TIFF, BMP, GIF (image input); MP4, MOV, WebM (video input); JPEG, PNG, WebP (image output); GIF, MP4 (aggregation output); MP3, WAV, FLAC, Ogg, AAC (audio extraction output)
- **Folder Viewer**: direct folder browsing mode — user can open any local folder and browse/delete contents, independent of a batch run

### 3.2 Recipe Architecture

- Recipes are stored in IndexedDB and serialised as JSON
- **System recipes** are seeded on first launch and always kept up to date (upserted on every app start)
- Users can clone any system recipe to create an editable copy
- Recipes support import/export as JSON
- Recipe JSON includes: `id`, `name`, `description`, `tags`, `coverColor`, `minItems`, `maxItems`, `inputType`, `params` (run parameters), `nodes`

### 3.3 Transform Engine

- **80+ registered transforms** across 9 categories (see `transformations.md` for full catalogue)
- Transforms run in a **Web Worker** for non-AI, non-video recipes (keeps UI responsive)
- **AI transforms** (`ai-*`) run on the main thread (require DOM/MediaPipe APIs unavailable in workers):
  - `ai-face-privacy`, `ai-remove-bg`, `ai-silhouette`, `ai-smart-redact`, `ai-ocr-tag`, `ai-analyse-people`, `ai-clipping-mask`, `ai-glow-eyes`
- **Video transforms** (`flow-video-*`, `video-*`) run on the main thread (WebCodecs + mediabunny library)
- **Aggregation pipeline**: `flow-photo-stack`, `flow-animate-stack` also run on main thread (gif.js requires HTMLCanvasElement)

### 3.4 Node Types

| Type | Behaviour |
|---|---|
| `transform` | Mutates the current canvas in-place |
| `branch` | Each branch works on an independent copy of the canvas; all branches produce outputs |
| `conditional` | Evaluates a condition; runs `thenNodes` or `elseNodes` |
| `block-ref` | Inline-expands a named Block at run time |

### 3.5 Flow Control Nodes

- **`flow-export`**: saves current canvas to output folder with optional suffix and format
- **`flow-save` / `flow-load`**: named in-memory canvas states (for multi-panel compositions within a single image)
- **`flow-compose-grid`**: assembles saved states into a grid (e.g. 2×2 Warhol panels)
- **`flow-create-gif`**: animated GIF from one frame per input image
- **`flow-create-video`**: MP4 slideshow from one frame per input image
- **`flow-contact-sheet`**: JPEG grid of all images
- **`flow-template-aggregator`**: mapping node that batches input images sequentially into defined template placeholder slots.
- **`flow-video-wall`**: multiplexes videos into grid layouts or custom defined Templates. Backgrounds natively buffer and loop MP4s leveraging File System Access API without inflating IndexedDB quotas.
- **`flow-video-convert`**: re-encode to different container/codec (MP4, WebM, MKV, MOV, Ogg) via mediabunny
- **`flow-video-trim`**: cut to time range in seconds
- **`flow-video-compress`**: reduce file size via quality presets or custom bitrate
- **`flow-video-change-fps`**: retarget frame rate (12/24/25/30/60 fps)
- **`flow-video-strip-audio`**: remove all audio tracks
- **`flow-video-extract-audio`**: export audio track as MP3, WAV, FLAC, Ogg, or AAC
- **`flow-video-remix-audio`**: change channel layout (stereo↔mono) and/or sample rate
- **`flow-video-concat`**: join all selected videos end-to-end into one MP4 (aggregation node)
- **`video-*` effects** (8 transforms): apply existing image effects (tuning, duotone, tint, vignette, advanced, bloom, color grade, chromatic aberration) to every decoded video frame via mediabunny's process callback
- **`flow-animate-stack`**: animated desk stack — each image appears one by one, randomly rotated, on a coloured desk surface; supports `overlap` parameter and GIF or MP4 output
- **`flow-photo-stack`** (legacy): single-node convenience wrapper combining `overlay-polaroid-frame` + `flow-animate-stack`
- **`flow-face-swap`**: client-side 478-point mesh interlock face swapper. N=2 files yield mutual cross-swaps. N>2 applies image 1's face to all subsequent heads.

### 3.6 Run Parameters

- Recipes declare a top-level `params` array
- Before each batch run, the user sees an inline form showing these params
- Entered values override matching node params **by name** across all nodes in the recipe tree
- Last-used values are persisted per recipe in `localStorage`
- A "Reset" button restores all fields to their `defaultValue`
- Param types: `number`, `range`, `select`, `boolean`, `text`, `color`

### 3.7 Variables & Token Syntax

String-type params support `{{token}}` injection resolved per image at run time:

| Token | Value |
|---|---|
| `{{filename}}` | Full filename |
| `{{filename \| sanitized}}` | Filename with underscores replacing special chars |
| `{{exif.date}}`, `{{exif.make}}`, `{{exif.model}}` | EXIF fields |
| `{{meta.X}}` | Custom metadata field |
| `{{sidecar.X}}` | Custom sidecar or extracted AI/Geocode data |
| `{{recipe.X}}` | Current run parameter value |

### 3.8 Metadata & Asset Store

- **Asset Store**: a robust IndexedDB repository mapping files to extracted metadata (EXIF, geocode, OCR text, vision detection points, user sidecar) via collision-resistant SHA-256 hashes.
- EXIF is read from input files via the `exif-reader` module
- GPS, date, camera make/model available as tokens
- Extracted AI data and geocoding are exposed via `{{sidecar.X}}` syntax
- `meta-strip`: removes GPS Only, EXIF Only, or All metadata from output
- `meta-set-exif`: writes artist, copyright, comment, description, software fields
- `meta-geocode`: converts GPS coordinates to a text string (city, country) via a template

---

## 4. Screens

| Code | Screen | Purpose |
|---|---|---|
| **LIB** | Recipe Library | Visual card grid of all recipes (system + user). Search, filter by tag. Clone, delete, preview. Import/export JSON. |
| **SET** | Batch Setup | Select input folder, output folder, recipe. View/select images. Configure output subfolder (defaults to recipe name). Show inline run parameters. Run batch. |
| **NED** | Node Editor | Visual drag-and-drop canvas editor. Categorised node palette. Live preview of a single image through the recipe. |
| **BLD** | Recipe Builder | List-based step editor. Add/reorder/delete nodes. Configure node params. Declare recipe-level run parameters. Config panel includes thumbnail picker (browse for image file; stored as base64, also written to `public/user-samples/` if project root is linked). |
| **BKB** | Block Builder | Build reusable node groups (Blocks) that can be referenced in any recipe. |
| **INS** | Block Inspector | Detailed parameter editor for a single node with live preview. |
| **PVW** | Recipe Preview | Before/after single-image preview. Clone or edit recipe. |
| **QUE** | Processing Queue | Live batch progress with terminal-style log. Cancel in-flight batch. Navigate to output when complete. |
| **OUT** | Output History | Searchable run history. View per-run logs. Browse output folder. Add completed runs to ShowCase. |
| **CMP** | Comparison View | Side-by-side or split-slider before/after comparison. |
| **FLD** | Folder Viewer | Finder-style file browser. Two entry points: (1) from a specific batch run via Output History, (2) direct "open folder" mode that remembers the last browsed folder. Grid, filmstrip, and list views. Slideshow mode. Delete files. Before/after comparison with input folder. Video files show thumbnail preview from `.{videoname}.preview.jpg` sidecars (generated in background); user can set a custom preview frame via the camera button on any video card. |
| **SHC** | ShowCase | Visual portfolio of highlighted runs. Large card grid list view; each entry captures up to 5 sample images/videos from a single run, a user-editable title and description, and a horizontal pipeline diagram of the recipe steps with parameters. Entry points: "Add to ShowCase" button in Output History run rows and gallery header, and in Folder Viewer when browsing a run's output. Curation (swap images, edit text) is done from within the ShowCase screen. |

---

## 5. User Workflow

```
Discovery [LIB] ──> Inspect [PVW] ──> Configure [SET] ──> Run [QUE]
     │                                      │                   │
     │                                      ▼                   ▼
     └──> Build/Edit [BLD/NED/BKB] <──> Test [CMP]     Review [OUT] ──> Browse [FLD]
                                                               │
                                                               ▼
                                                        Highlight [SHC]
```

**Typical flow for a new user:**
1. Open **Library** → browse system recipes
2. Find "Photo Stack Animation" → click **Run** → opens Batch Setup
3. Select input folder → select output folder → run parameters form shows (format, overlap, etc.)
4. Click **Run Batch** → watch live progress in Queue
5. After completion → click **Browse Output** → Folder Viewer shows the GIF/MP4

**Typical flow for a power user:**
1. Clone a system recipe in Library
2. Open in **Builder** → add/remove/reorder nodes → adjust params
3. Add **Run Parameters** to expose tweakable values without editing the recipe each time
4. Run batch → tweak run params → re-run until satisfied

---

## 6. Design & Technical Constraints

### 6.1 Technology Stack

- **Frontend**: Vanilla JS (ES modules), no framework
- **Bundler**: Vite
- **Storage**: IndexedDB (recipes, runs, blocks, folder handles, templates, showcases)
- **Processing**: Web Workers (non-AI), Main thread (AI + animation aggregation)
- **AI**: MediaPipe (face detection, segmentation, pose); Tesseract.js (OCR); OpenCV.js (template slot auto-detection via WASM background worker)
- **GIF encoding**: gif.js (requires HTMLCanvasElement, runs on main thread)
- **MP4 encoding**: WebCodecs API + mp4-muxer (slideshow aggregation)
- **Video processing**: mediabunny (format conversion, trim, compress, fps change, audio ops, per-frame effects)
- **Design system**: Aurora UI (custom, dark-mode-first)

### 6.2 "Pro Studio" Aesthetic

- Dark-mode first; deep charcoal backgrounds (~`#121212`)
- Electric blue (`#0077FF`) for active states, primary buttons, highlights
- Clean sans-serif UI font; monospace for logs and metadata
- Color-coded node categories: geo (blue), color (orange), filter (purple), overlay (green), ai (red), flow (grey)

### 6.3 Performance

- Non-AI batch runs in a Web Worker — UI remains responsive during processing
- AI batches run on main thread with `await new Promise(res => setTimeout(res, 0))` yield between files to keep UI paintable
- Aggregation (GIF/MP4 rendering) runs after all files are processed; progress is shown in the Queue screen
- IndexedDB auto-saves recipe edits; no explicit save button required

### 6.4 Privacy & Security

- Zero network requests for image processing
- GPS metadata stripped before any output by user's choice (`meta-strip`)
- `overlay-map` fetches OpenStreetMap tiles (external HTTP) only if explicitly added to a recipe
- No analytics, no telemetry

---

## 7. System Recipes (Built-in)

| ID | Name | Description |
|---|---|---|
| `sys-web-optimise` | Web Optimise | Resize to 1920px, strip GPS, export as WebP 85% |
| `sys-thumbnail-pack` | Thumbnail Pack | Three size variants (1920/800/400px) as JPEG |
| `sys-privacy-scrub` | Privacy Scrub | AI face blur + strip all metadata |
| `sys-watermark` | Watermark | Diagonal tiled watermark |
| `sys-photo-stack` | Photo Stack Animation | Polaroid frame + animated desk stack (GIF or MP4); has run parameters |
| `sys-popart-warhol` | Pop Art Warhol | 4-panel duotone silkscreen grid |
| `sys-popart-warhol-halftone` | Pop Art Warhol — Halftone | Warhol grid with halftone dots |
| `sys-blueprint` | Blueprint | Sobel edge detection + blue duotone + engineering grid |
| `sys-cyberpunk` | Cyberpunk | Neon duotone + bloom + chromatic aberration |
| `sys-analog-film` | Classic Analog Film | 1970s warm film look with grain, vignette, light leak |
| `sys-oil-painting` | Impressionist Oil Painting | Kuwahara smoothing + edge overlay + canvas texture |
| `sys-film-noir` | Film Noir | B&W high-contrast with grain and heavy vignette |
| `sys-retrowave` | Retrowave | 80s synthwave sunset duotone with neon grid |
| `sys-lomo` | Lomo Camera | Vivid lomo look with vignette and light leak |
| `sys-faded-matte` | Faded Matte | Clean faded-film matte with lifted blacks |
| `sys-tilt-shift` | Tilt-Shift Miniature | Scale-model horizontal blur |
| `sys-aerochrome` | Aerochrome (Infrared) | Kodak Aerochrome infrared simulation — foliage turns pink/red |
| `sys-glitch` | Digital Glitch | Chromatic aberration + pixel sort + CRT scanlines |
| `sys-8bit` | Retro 8-Bit | Nearest-neighbour pixelate + CGA dither (PNG output) |
| `sys-graphic-novel` | Graphic Novel | Kuwahara smooth + colour boost + ink-line edge detection (subtle, photo-realistic) |
| `sys-graphic-novel-bold` | Graphic Novel — Bold | As above with posterisation and heavier ink lines for a comic-book panel look |
| `sys-vampire-gfx` | Vampire GFX | Chalk-white pallor, cold colour grade, skin bloom glow and AI red glowing eyes (BlazeFace) |
| `sys-polaroid` | Polaroid | Classic instant camera framing with light leak |
| `sys-copyrighter` | Copyrighter | Add copyright watermarks |
| `sys-bw-classic` | Classic Black & White | High-contrast B&W processing |
| `sys-film-grain` | Film Grain | Simple film grain overlay |
| `sys-social-ready` | Social Ready | Crop and pad for social media |
| `sys-video-frame-gif` | Video Frame GIF | Extract frames into an animated GIF |
| `sys-video-wall` | Video Wall | Combine videos into a grid |
| `sys-video-tv` | TV Room | Video placed inside a TV mockup |
| `sys-comic-book` | Comic Book Cell | Comic style treatment |
| `sys-geo-timeline` | Geotemporal Timeline | Map-based video sequence of photos |
| `sys-machina-swap` | Machina-Swap | Mesh-based face swapping |
| `sys-talking-head-pip` | Talking Head PiP | Picture-in-picture layout |
| `sys-bg-swap` | Background Swap | Subject cut-out composite onto new background |
| `sys-pm-solutions-id` | PM Solutions ID Card | Corporate ID generator |
| `sys-organise-by-location` | Organise by Location | Group images by GPS city/country |
| `sys-organise-by-date` | Organise by Date | Group images by capture date |
| `sys-cinematic-portrait` | Cinematic Portrait | Film look for portraits |
| `sys-find-blurry` | Find Blurry Images | Filter out low-sharpness images |
| `sys-oil-painting-face-swap` | Oil Painting Face Swap | Face swap combined with painterly effect |
