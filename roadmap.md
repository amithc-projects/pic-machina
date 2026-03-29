# ImageChef — Product Roadmap

## Release Philosophy

Each version ships a complete, usable product. No half-built screens, no placeholder features.
All processing is client-side only (Chrome/Edge 94+). UI built with vanilla JS ES modules + Vite.
Design system: Aurora UI (CSS variables, dark Pro Studio theme, electric blue `#0077FF` accent throughout).

---

## v1.0 — Core Product ✦ Full Build

**Goal**: A complete, professional batch image processor. All 10 screens. All transforms. Recipes and Blocks with conditional and variant branching logic.

### Screens

| Abbr | Screen | Status |
|------|--------|--------|
| LIB | Recipe Library | v1.0 |
| SET | Batch Setup | v1.0 |
| NED | Node Editor (canvas + categorised chooser) | v1.0 |
| BLD | Recipe Builder (list view) | v1.0 |
| BKB | Block Builder (incl. variant branches + conditional logic) | v1.0 |
| INS | Block Inspector | v1.0 |
| PVW | Recipe Preview | v1.0 |
| QUE | Processing Queue (Web Worker + terminal log) | v1.0 |
| OUT | Output Browser | v1.0 |
| CMP | Comparison View (split slider + histogram) | v1.0 |

### Transformation Nodes (all categories)

**Geometric & Framing**
- Resize, Crop, Smart Crop, Face Crop, Rotate/Flip, Round Corners, Canvas Padding, Trim

**Color, Tone & Filters**
- Standard Tuning, Auto Levels, Opacity, Color Tint, Duotone, Advanced Effects (blur/sharpen/noise/pixelate), Vignette

**Creative Overlays & Typography**
- Rich Text, Watermark, Typography FX, QR Code, Ribbon/Badge, Map View (OpenStreetMap + GPS EXIF)

**AI & Composition**
- Face Privacy (MediaPipe), Smart Redact (Tesseract.js OCR), Remove BG (@imgly), Clipping Mask

**Flow Control & Export**
- Save/Load Point, Branch/Variant, Conditional (HasGPS / IsPortrait / MetaExists / dimension comparisons), Export File (JPEG/PNG/WEBP), Create Video (MP4 via VideoEncoder API), Create GIF (gif.js), Contact Sheet

**Metadata Processing**
- Strip Metadata, Geocode (GPS → text), Set EXIF Info

### Recipe & Block Architecture

- **Recipe**: ordered tree of transformation nodes and/or embedded Blocks
- **Block**: reusable named sub-recipe, independently authored in BKB
- **Variant Branching**: parallel output paths (e.g. Main + Thumbnail) within a recipe or block
- **Conditional Logic**: If/Then flow based on image metadata (orientation, GPS presence, custom EXIF fields)
- **Variable injection**: `{{meta.key}}`, `{{exif.key}}`, `{{filename}}`, `{{date}}` in all text fields
- **`{{loop.index}}`** token reserved (inactive until v1.2)

### System-Bundled Recipes (read-only, clonable)

| Recipe | Description |
|--------|-------------|
| **Web Optimise** | Resize to max 1920px wide → strip GPS metadata → export WEBP 85% quality |
| **Thumbnail Pack** | Variant branch → 1920px (Full) + 800px (Medium) + 400px (Thumb) → export JPEG |
| **Privacy Scrub** | Face Privacy (blur) → Strip Metadata (GPS + all EXIF) → export original format |
| **Polaroid Simulator** | Square crop (Smart Crop) → Canvas Padding (white, 8% all sides, 14% bottom) → Vignette → Standard Tuning (warm +15 saturation) → export JPEG |
| **Copyrighter** | Rich Text overlay: `© {{exif.author \| "Owner"}} {{exif.date \| date("DD-MMM-YYYY")}}` bottom-right → export original format |
| **Black & White Classic** | Standard Tuning (desaturate) → Duotone (deep black / bright white) → Vignette → Sharpen → export JPEG |
| **Film Grain** | Standard Tuning (warm tones, +contrast) → Advanced Effects (noise 18%) → Vignette → export JPEG |
| **Social Ready** | Smart Crop (1:1) → Standard Tuning → Watermark (user logo) → export WEBP |

### Infrastructure

- **Vite** build tool, vanilla JS ES modules, no framework
- **Aurora UI** CSS/JS loaded from local copy of `github.com/amithc-projects/aurora-docs/static`
- **IndexedDB** for recipe/block storage; auto-save every 5 seconds
- **File System Access API** for persistent input/output folder handles (Chrome/Edge 94+)
- **Web Workers** for all batch processing; UI thread never blocked
- **Hash-based routing** (`#lib`, `#set`, `#ned`, `#bld`, `#bkb`, `#ins`, `#pvw`, `#que`, `#out`, `#cmp`)
- **SVG-based node connectors** in NED canvas for flow visualisation
- **CSS custom properties** for full theme customisability (dark Pro Studio default)
- **Non-destructive outputs** always written to `/output` subfolder; originals untouched
- **Terminal-style run log** written to IndexedDB; viewable in QUE and OUT screens
- **Recipe cover images**: user-assigned; default placeholder shown until set

---

## v1.1 — Data & Metadata Expansion

**Goal**: Unlock data-driven batch processing with external metadata sources and richer metadata write-back.

### Features

- **CSV/JSON sidecar file support**
  - Import a sidecar file in SET screen alongside the image folder
  - Values keyed by filename (or index) injected as `{{sidecar.column_name}}` variables
  - Available in all variable-interpolated fields (text overlays, filenames, EXIF write-back)
  - Per-image variable binding shown in QUE terminal log
  - UI: sidecar file picker in SET; column-mapping preview table

- **IPTC metadata read**
  - Read IPTC Caption, Keywords, Credit, Copyright fields on load
  - Available as `{{iptc.caption}}`, `{{iptc.keywords}}` etc. in variable fields

- **XMP metadata read**
  - Parse embedded XMP sidecar or inline block
  - Available as `{{xmp.key}}` variables

- **Set IPTC/XMP node** (new transform)
  - Write Caption, Keywords, Creator, Rights fields back to output JPEG

- **Batch rename rule** (new SET screen option)
  - Define output filename pattern using variable syntax: `{{exif.date}}_{{filename}}_{{index}}`

---

## v1.2 — Iterative Processing & New Formats

**Goal**: Enable loop-based processing workflows and expand output format support.

### Features

- **Loop Node** (BKB + NED)
  - Wraps a sequence of child nodes
  - Configurable: `iterations` (int), `loop variable` name, `increment` value
  - `{{loop.index}}` available in all child node fields
  - Use cases: multi-pass AI upscaling, exposure bracketing, LUT sweeps, frame-by-frame video processing
  - Visualised as a container/wrapper in BKB timeline with nested node sequence

- **Break Condition** (on Loop Node)
  - Early-exit logic: `IF metadata.<key> <operator> <value> THEN break`
  - Terminal log highlights break trigger event
  - Example: stop upscaling passes once estimated noise level drops below threshold

- **AVIF output format**
  - Available in Export File node (Chrome 101+ `canvas.toBlob('image/avif')`)
  - Quality parameter (0–100)
  - Graceful fallback warning if browser does not support AVIF encoding

- **Multi-page TIFF / PDF input** (stretch goal)
  - Detect multi-page inputs on load
  - Loop node automatically iterates over pages when input is multi-page TIFF

---

## v2.0 — Collaboration & Sharing (Future Vision)

> Not committed. Included for directional context only.

- Export/import recipes as portable `.chef` JSON bundles (with embedded block definitions)
- Optional cloud sync for recipe library (user-owned storage: iCloud Drive / Google Drive via File System Access)
- Recipe rating & community sharing via a read-only recipe registry endpoint
- Plugin API: third-party transform nodes loaded as ES module URLs

---

## Constraints (all versions)

| Constraint | Decision |
|-----------|----------|
| Processing location | Client-side only. No data ever leaves the browser. |
| Browser support | Chrome 94+ and Edge 94+ (required for File System Access + VideoEncoder APIs) |
| Screen size | Desktop only. Minimum viewport 1280×800. No mobile/tablet layouts. |
| Framework | Vanilla JS ES modules. No React, Vue, Angular. |
| Build tool | Vite (bundling, dev server, tree-shaking only — no transpilation to legacy JS) |
| Design system | Aurora UI (local copy). Electric blue `#0077FF` as primary accent. Dark Pro Studio theme default. |
| Originals | Never overwritten. All output to `/output` subfolder. |
