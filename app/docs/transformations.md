# PicMachina — Transform Library Reference

Complete catalogue of all transform nodes available in the Recipe Builder and Node Editor.
All transforms are registered by their `transformId` string.

> For AI-generated recipe JSON, see **RECIPE_GUIDE.md** which includes schema, worked examples, and design rules.

---

## Categories

| Prefix | Category |
|---|---|
| `geo-*` | Geometric & Framing |
| `color-*` | Color & Tone |
| `filter-*` | Filters & Effects |
| `overlay-*` | Overlays & Typography |
| `ai-*` | AI & Composition |
| `flow-*` | Flow Control & Export |
| `meta-*` | Metadata |

---

## Geometric & Framing

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `geo-resize` | Resize | `width`, `height`, `maintainAspect`, `algo` | Values in px or %; height blank = maintain aspect |
| `geo-crop` | Crop | `x`, `y`, `width`, `height` | Values in px or % |
| `geo-smart-crop` | Smart Crop | `aspectRatio` (1:1/4:5/16:9/4:3/3:2), `strategy` (Entropy/Attention) | AI-driven content-aware crop |
| `geo-rotate` | Rotate / Flip | `angle` (0/90/180/-90), `flip` (none/horizontal/vertical/both) | |
| `geo-round` | Round Corners | `radius` (px or %), `circular` (bool) | |
| `geo-padding` | Canvas Padding | `top`, `right`, `bottom`, `left`, `color` | Expands canvas with solid colour border |
| `geo-trim` | Trim | `tolerance` (0–100), `bgSource` (Pixel/Alpha) | Removes solid-colour edges |
| `geo-pixelate` | Pixelate | `blockSize` (2–32, default 8) | Nearest-neighbour downsample+upsample |
| `geo-face-crop` | Face Crop | `padding`, `faceIndex`, `confidence` | AI — falls back to pose detection |
| `geo-body-crop` | Body Crop | `mode` (Full/Portrait), `padding` | AI — uses pose landmarks |
| `geo-face-align` | Face Align | `eyeLevel`, `centerNose`, `targetScale` | AI — 478-landmark normalisation |

---

## Color & Tone

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `color-tuning` | Standard Tuning | `contrast`, `saturation`, `vibrance` (-100–100), `invert` | Core adjustments |
| `color-auto-levels` | Auto Levels | `tolerance` (0–10) | Normalises exposure automatically |
| `color-opacity` | Opacity | `opacity` (0–100) | Global alpha |
| `color-tint` | Color Tint | `color`, `strength` (0–100), `blendMode` | Overlays a hue at given blend mode |
| `color-duotone` | Duotone | `darkColor`, `lightColor` | Maps luminance to two colours |
| `color-vignette` | Vignette | `amount` (0–100), `radius` (0–100) | Darkens/softens edges |
| `color-posterize` | Posterize | `levels` (2–8) | Reduces tonal levels |
| `color-channel-swap` | Channel Swap | `redSource`, `greenSource`, `blueSource` (R/G/B) | Remaps colour channels — use for infrared simulation (R←G, G←R) |

---

## Filters & Effects

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `filter-advanced` | Advanced Effects | `blurRadius`, `sharpenAmount`, `noiseLevel`, `pixelSize` | Multi-purpose filter node |
| `filter-bloom` | Bloom / Glow | `threshold`, `blurRadius`, `strength` | Bright-area glow; useful for halation |
| `filter-chromatic-aberration` | Chromatic Aberration | `offset` (1–30), `direction` | RGB channel fringe; glitch/lo-fi aesthetic |
| `filter-color-grade` | Colour Grade | `lift`, `shadowColor`, `shadowStrength`, `highlightColor`, `highlightStrength` | Split-tone shadow/highlight grading |
| `filter-edge-detect` | Edge Detection | `threshold`, `softEdges`, `blurBefore`, `blendMode`, `edgeStrength` | Sobel-based; use `blendMode: darken` to overlay edges |
| `filter-halftone` | Halftone | `dotSpacing`, `dotColor`, `opacity`, `invert` | Dot-grid print simulation |
| `filter-kuwahara` | Kuwahara / Oil Paint | `radius` (1–8), `passes` (1–3) | Edge-preserving paint smoothing |
| `filter-tilt-shift` | Tilt-Shift | `centerY`, `bandWidth`, `blurAmount`, `feather` | Miniature blur — blurs top and bottom bands |
| `filter-pixel-sort` | Pixel Sort | `threshold` (0–255), `direction`, `stripHeight` | Sorts pixels by luminance within strips — data-corruption glitch effect |
| `filter-dither` | Dither | `palette` (mono/cga/gameboy/c64), `dithering` (bool) | Floyd-Steinberg error diffusion to limited palette |

---

## Overlays & Typography

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `overlay-rich-text` | Rich Text | `content`, `font`, `size`, `sizeMode`, `color`, `opacity`, `anchor`, `bgBox`, `shadow`, `weight`, `blendMode` | Full-featured text overlay; supports `{{variable}}` |
| `overlay-watermark` | Diagonal Watermark | `text`, `font`, `size`, `color`, `opacity`, `angle` | Tiled diagonal text |
| `overlay-ribbon` | Ribbon / Badge | `text`, `position` (TL/TR/BL/BR), `bgColor`, `textColor`, `size` | Corner badge overlay |
| `overlay-qrcode` | QR Code | `content`, `size`, `anchor`, `margin`, `errorCorrection` | Generates QR code from any URL or text |
| `overlay-grid` | Grid Overlay | `spacing`, `color`, `opacity`, `lineWidth` | Technical/engineering grid |
| `overlay-map` | Map View | `zoom`, `size`, `opacity`, `anchor`, `margin` | OpenStreetMap tile at EXIF GPS location — requires GPS metadata |
| `overlay-light-leak` | Light Leak | `edge`, `color`, `opacity`, `spread`, `blendMode` | Analog-style light bleed from one edge |
| `overlay-canvas-texture` | Canvas Texture | `intensity`, `scale`, `blendMode` | Procedural canvas/paper grain overlay |
| `overlay-polaroid-frame` | Polaroid Frame | `borderColor`, `borderSide`, `borderBottom`, `caption` | Expands canvas with white border and caption; designed to precede `flow-animate-stack` |
| `overlay-scanlines` | CRT Scanlines | `spacing`, `opacity`, `color` | Horizontal CRT-style scan line overlay |

---

## AI & Composition

> AI transforms run on the main thread (not in a Web Worker) and are significantly slower than non-AI transforms. They require browser support for WebGPU or WASM.

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `ai-face-privacy` | Face Privacy | `mode` (Blur/Pixelate/Bar), `confidence`, `padding` | MediaPipe face detection |
| `ai-remove-bg` | Remove Background | `mode` (Transparent/Silhouette), `edgeSmoothing`, `bgFill`, `bgColor` | AI subject segmentation |
| `ai-silhouette` | Silhouette | `color`, `opacity` | Removes BG and fills subject with solid colour |
| `ai-smart-redact` | Smart Redact | `mode` (redact/extract), `targets` (Text/Face), `method` (Blur/Bar) | OCR + face detection for privacy scrubbing |
| `ai-ocr-tag` | OCR Tag Extractor | `minLength` | Extracts tags from OCR text (needs Smart Redact Extract mode) |
| `ai-analyse-people` | Analyse People | `faceConfidence`, `poseConfidence`, `maxPoses` | MediaPipe pose & face detection to asset store |
| `ai-clipping-mask` | Clipping Mask | `shape` (Circle/RoundedRect/Diamond), `feathering` | Shape-based mask using AI segmentation |

---

## Flow Control & Export

### Per-Image Export

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `flow-export` | Export File | `suffix`, `format` (image/jpeg / image/png / image/webp), `quality` | Saves current canvas as a file |
| `flow-save` | Save State | `label` | Saves current canvas to a named slot |
| `flow-load` | Load State | `label` | Restores a previously saved canvas slot |
| `flow-compose-grid` | Compose Grid | `panels` (comma-separated labels), `columns`, `gap`, `bgColor` | Assembles saved states into a grid |

### Aggregation Nodes (Cross-Image Output)

Aggregation nodes collect one frame per input image then produce a single combined output after the entire batch completes. **Do not use `flow-export` on the same path as an aggregation node.**

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `flow-create-gif` | Animated GIF | `filename`, `delay` (ms), `loop` | Simple frame-by-frame GIF |
| `flow-create-video` | MP4 Slideshow | `filename`, `durationPerSlide` (s), `fps` | MP4 via WebCodecs |
| `flow-contact-sheet` | Contact Sheet | `columns`, `gap`, `filename` | Grid JPEG of all images |
| `flow-animate-stack` | Animate Stack | `filename`, `format`, `width`, `height`, `deskColor`, `frameDelay`, `maxRotation`, `overlap` | Each frame appears on a desk one by one, randomly rotated. Generic — use after `overlay-polaroid-frame` for a polaroid stack. |
| `flow-photo-stack` | Photo Stack (Legacy) | All `flow-animate-stack` params + `borderColor`, `borderBottom`, `caption` | Combines polaroid framing + desk animation in a single node. Prefer the two-node pattern. |
| `flow-template-aggregator` | Template Render | `templateId`, `filename`, `quality` | Maps batch images sequentially into defined template placeholder slots using OpenCV-detected bounds. If placeholders < images, it chunk-processes them into multiple numbered template composites. |

---

## Metadata

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `meta-strip` | Strip Metadata | `level` (All / GPS Only / EXIF Only) | Removes EXIF from output |
| `meta-set-exif` | Set EXIF Info | `field` (artist/copyright/comment/description/software), `value` | Writes custom EXIF fields; supports `{{variable}}` |
| `meta-geocode` | Reverse Geocode | `template` (`{city}, {country}`), `targetField` | Converts GPS coords to text and stores in metadata |

---

## Variable Token Reference

Use `{{token}}` syntax in any text param (content, caption, suffix, watermark, EXIF values, etc.).

| Token | Resolves to |
|---|---|
| `{{filename}}` | Full filename including extension |
| `{{filename \| sanitized}}` | Filename with underscores replacing special characters |
| `{{exif.date}}` | EXIF DateTimeOriginal |
| `{{exif.make}}` | Camera make |
| `{{exif.model}}` | Camera model |
| `{{exif.gps}}` | GPS coordinates string |
| `{{meta.X}}` | Custom metadata field named X |
| `{{recipe.X}}` | Value of recipe run parameter named X |
