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
| `video-*` | Video Effects (per-frame) |
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
| `ai-subject-crop` | Subject Crop | `aspectRatio` (original/1:1/4:5/3:4/4:3/16:9/9:16/custom), `customRatio`, `padding` (0–50%), `anchor` (center/top/bottom/thirds-tl/tr/bl/br), `threshold` (10–90%) | Saliency-aware crop using InSPyReNet (#mdl). Reads cached `vision.subjectBBox` when available; falls back to centre crop if model not downloaded. |

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
| `color-posterize` | Posterize | `levels` (2–10) | Reduces tonal levels |
| `color-channel-swap` | Channel Swap | `redSource`, `greenSource`, `blueSource` (R/G/B) | Remaps colour channels — use for infrared simulation (R←G, G←R) |

---

## Filters & Effects

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `filter-advanced` | Advanced Effects | `blurRadius`, `sharpenAmount`, `noiseLevel`, `pixelSize` | Multi-purpose filter node |
| `filter-bloom` | Bloom / Glow | `threshold`, `blurRadius`, `strength` | Bright-area glow; useful for halation |
| `filter-chromatic-aberration` | Chromatic Aberration | `offset` (1–30), `direction` | RGB channel fringe; glitch/lo-fi aesthetic |
| `filter-color-grade` | Colour Grade | `lift`, `shadowColor`, `shadowStrength`, `highlightColor`, `highlightStrength` | Split-tone shadow/highlight grading |
| `filter-edge-detect` | Edge Detection | `threshold`, `softEdges`, `blurBefore`, `blendMode` (none/multiply/darken), `invertEdges`, `edgeStrength` | Sobel-based; `invertEdges: true` + `blendMode: multiply` draws black ink lines over the image (graphic novel style) |
| `filter-halftone` | Halftone | `dotSpacing`, `dotColor`, `opacity`, `invert` | Dot-grid print simulation |
| `filter-kuwahara` | Kuwahara / Oil Paint | `radius` (1–8), `passes` (1–3) | Edge-preserving paint smoothing |
| `filter-tilt-shift` | Tilt-Shift | `centerY`, `bandWidth`, `blurAmount`, `feather` | Miniature blur — blurs top and bottom bands |
| `filter-pixel-sort` | Pixel Sort | `threshold` (0–255), `direction`, `stripHeight` | Sorts pixels by luminance within strips — data-corruption glitch effect |
| `filter-dither` | Dither | `palette` (mono/cga/gameboy/c64), `dithering` (bool) | Floyd-Steinberg error diffusion to limited palette |
| `filter-relight` | Relight | `ambient` (0–100), `l1On/l2On/l3On`, `l1X/l1Y` (0–100%), `l1Color`, `l1Intensity`, `l1Radius` | Up to 3 independent point lights via screen compositing. Darkens image to `ambient`% then adds coloured radial lights. Supports warm/cool multi-light setups. |

---

## Overlays & Typography

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `overlay-rich-text` | Rich Text | `content`, `font`, `size`, `sizeMode`, `color`, `opacity`, `anchor`, `bgBox`, `shadow`, `weight`, `blendMode` | Full-featured text overlay; supports `{{variable}}`. Set `Blend Mode` to `Mask: Cut In` to clip the image inside the text letters, or `Mask: Cut Out` to punch letters out of the image. |
| `overlay-watermark` | Diagonal Watermark | `text`, `font`, `size`, `color`, `opacity`, `angle` | Tiled diagonal text |
| `overlay-ribbon` | Ribbon / Badge | `text`, `position` (TL/TR/BL/BR), `bgColor`, `textColor`, `size` | Corner badge overlay |
| `overlay-qrcode` | QR Code | `content`, `size`, `anchor`, `margin`, `errorCorrection` | Generates QR code from any URL or text |
| `overlay-grid` | Grid Overlay | `spacing`, `color`, `opacity`, `lineWidth` | Technical/engineering grid |
| `overlay-map` | Map View | `zoom`, `size`, `opacity`, `anchor`, `margin` | OpenStreetMap tile at EXIF GPS location — requires GPS metadata |
| `overlay-light-leak` | Light Leak | `edge`, `color`, `opacity`, `spread`, `blendMode` | Analog-style light bleed from one edge |
| `overlay-canvas-texture` | Canvas Texture | `intensity`, `scale`, `blendMode` | Procedural canvas/paper grain overlay |
| `overlay-polaroid-frame` | Polaroid Frame | `borderColor`, `borderSide`, `borderBottom`, `caption` | Expands canvas with white border and caption; designed to precede `flow-animate-stack` |
| `overlay-scanlines` | CRT Scanlines | `spacing`, `opacity`, `color` | Horizontal CRT-style scan line overlay |
| `overlay-template` | Template Frame | `templateId` | Warps the current image into the primary slot of a saved Perspective Template; renders the template background around it |
| `overlay-device-mockup` | Device Mockup | `family`, `model`, `variant` | Wraps the current image inside a physical device chassis using dynamic clipping and glare overlays |

---

## AI & Composition

> AI transforms run on the main thread (not in a Web Worker) and are significantly slower than non-AI transforms. They require browser support for WebGPU or WASM.

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `ai-face-privacy` | Face Privacy | `mode` (Blur/Pixelate/Bar), `confidence`, `padding` | MediaPipe face detection |
| `ai-remove-bg` | Remove Background | `mode` (Transparent/Silhouette), `edgeSmoothing`, `bgFill`, `bgColor` | MediaPipe selfie segmentation (~5 MB, fast). Tuned for people. |
| `ai-remove-bg-hq` | Remove BG (High Quality) | `mode` (Transparent/Silhouette), `edgeSmoothing`, `bgFill`, `bgColor`, `bgImage` | InSPyReNet SwinB saliency (~200 MB, see #mdl). Pixel-accurate edges for any subject — fur, hair, transparent objects, products. |
| `ai-portrait-bokeh` | Portrait Bokeh | `blurRadius` (0–60), `edgeFeather` (0–30), `falloff` (flat/graduated) | InSPyReNet matte + Photon gaussian_blur. Large-aperture lens simulation. Graduated mode adds a mid-band blur for fake depth falloff. |
| `ai-drop-shadow` | Subject Drop Shadow | `offsetX`, `offsetY`, `blur`, `opacity`, `color` | InSPyReNet matte. Works on both cut-outs (writes alpha) and photos (darkens visible background). |
| `ai-sticker-outline` | Sticker Outline | `thickness`, `color`, `doubleOutline`, `secondColor`, `bgMode` (transparent/keep) | InSPyReNet matte dilated via blur-then-threshold. Optional second concentric ring for meme/double-border looks. |
| `ai-subject-vignette` | Subject Vignette | `strength` (0–100), `softness` (0–100), `color` | InSPyReNet matte feathered by `softness × 0.15 × min(W,H)`. Darkens (or tints) everything outside the matte, leaving the subject untouched. Unlike a geometric vignette, it stays locked to the subject no matter where they sit in frame. |
| `ai-selective-grade` | Selective Color Grade | `subjectSaturation`/`subjectTemperature`/`subjectExposure`, `backgroundSaturation`/`backgroundTemperature`/`backgroundExposure` (all ±100), `edgeFeather` (0–30) | Two Photon-graded full-image copies composited via the feathered InSPyReNet matte. Temperature is modelled as a paired red/blue channel shift (±60 at the extremes); exposure maps to `adjust_brightness` (±127). Defaults: warm/bright subject, cool/darker background. |
| `ai-subject-sharpen` | Subject Sharpen | `mode` (sharpen/denoise/both), `amount` (0–200), `edgeFeather` (0–20), `inverse` (bool) | Photon `sharpen` (pass count = amount/30) and/or `noise_reduction` (pass count = amount/60) applied to a full-image clone, composited back through the matte so only the subject (or, with `inverse`, only the background) is affected. |
| `ai-silhouette` | Silhouette | `color`, `opacity` | Removes BG and fills subject with solid colour |
| `ai-smart-redact` | Smart Redact | `mode` (redact/extract), `targets` (Text/Face), `method` (Blur/Bar) | OCR + face detection for privacy scrubbing |
| `ai-ocr-tag` | OCR Tag Extractor | `minLength` | Extracts tags from OCR text (needs Smart Redact Extract mode) |
| `ai-analyse-people` | Analyse People | `faceConfidence`, `poseConfidence`, `maxPoses` | MediaPipe pose & face detection to asset store |
| `ai-clipping-mask` | Clipping Mask | `shape` (Circle/RoundedRect/Diamond), `feathering` | Shape-based mask using AI segmentation |
| `ai-glow-eyes` | Glowing Eyes | `color`, `intensity` (0–100), `irisScale` (60–200%), `glowSpread` (150–600%), `darkPupil`, `confidence` | FaceLandmarker iris landmarks (468/473) for pixel-accurate iris centre; screen-mode additive glow with hot-white core + outer diffuse skin illumination. Used in Vampire GFX recipe. |

### InSPyReNet-based transforms (requires `#mdl` download)

`ai-remove-bg-hq`, `ai-portrait-bokeh`, `ai-subject-crop`, `ai-drop-shadow`, `ai-sticker-outline`, `ai-subject-vignette`, `ai-selective-grade`, `ai-subject-sharpen`, and the `isolateSubject` option on `flow-photo-stack` / `flow-animate-stack` / `flow-template-aggregator` all share the same ~200 MB InSPyReNet SwinB saliency model, managed on the **Models** screen (`#mdl`). All of them:

- **Share one inference per image per recipe** — the saliency matte is cached by canvas signature. Stacking Remove BG HQ + Portrait Bokeh + Drop Shadow + Sticker Outline + Subject Crop + Vignette + Selective Grade + Subject Sharpen in a single recipe runs the model exactly once.
- **Persist `vision.subjectBBox` / `subjectCentroid` / `subjectArea`** on the asset record, so a second batch run at a different aspect ratio or different shadow offset reads the cached bbox instead of re-running inference.
- **Degrade gracefully** when the model isn't downloaded — they log a warning and leave the canvas untouched (except `ai-subject-crop`, which centre-crops to the target aspect).
- Run on **main thread only** (onnxruntime-web + WebGPU). Batches containing any of them are routed via `MAIN_THREAD_TRANSFORMS` in `batch.js`.

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
| `flow-contact-sheet` | Contact Sheet | `columns`, `gap`, `filename`, `groupBy1`, `groupBy2` | Grid JPEG of all images; optionally group by a metadata field (e.g. `{{sidecar.city}}`) with title/subtitle headers |
| `flow-video-stitcher` | WebGL Video Stitcher | `filename`, `width`, `height`, `fps`, `durationPerSlide`, `transitionDuration`, `transitionMode`, `motionMode` | GPU-accelerated slideshow with crossfade/wipe/pixelize transitions and Ken Burns motion (zoom-in/out, pan). Aggregation node. |
| `flow-geo-timeline` | Geotemporal Timeline | `filename`, `width`, `height`, `fps`, `durationPerPhoto`, `transitionDuration` | Assembles GPS-tagged images into a scrolling video charting a journey on a map. Aggregation node — requires `meta-geocode` upstream. |
| `flow-title-slide` | Inject Title Slide | `triggerField`, `titleTemplate`, `bgColor`, `bgImage`, `fontFamily`, `fontSize`, `textColor` | Injects a generated title card into the aggregation stream whenever a structural variable (e.g. city or date) changes. Used before `flow-video-stitcher` or similar. |
| `video-extract-frame` | Extract Video Frame | `atPercent` (0–100) | Seeks the input video to a position and draws that frame onto the canvas. Use resize/crop steps after to shape the frame. Runs on main thread. |
| `flow-gif-from-states` | GIF from States | `panels`, `delay`, `loop`, `suffix` | Assembles named saved canvas states into an animated GIF within a single image's pipeline (not a batch aggregator). |
| `flow-create-pdf` | Create PDF | `filename`, `orientation` (portrait/landscape), `format` (a4/letter/legal), `quality` | Assembles all processed images into a multi-page PDF. Aggregation node. |
| `flow-create-pptx` | Create PowerPoint | `filename`, `layout` (16:9/4:3) | Assembles all processed images into a multi-slide PPTX presentation. Aggregation node. |
| `flow-create-zip` | Create ZIP | `filename` | Packages all processed output images into a ZIP archive. Aggregation node. |
| `flow-animate-stack` | Animate Stack | `filename`, `format`, `width`, `height`, `deskColor`, `frameDelay`, `maxRotation`, `overlap`, `isolateSubject` | Each frame appears on a desk one by one, randomly rotated. Generic — use after `overlay-polaroid-frame` for a polaroid stack. `isolateSubject=true` runs InSPyReNet on every source image and bakes the matte into alpha, so frames composite as cut-out silhouettes rather than rectangles (requires #mdl; N sources = N inferences). |
| `flow-photo-stack` | Photo Stack (Legacy) | All `flow-animate-stack` params + `borderColor`, `borderBottom`, `caption`, `isolateSubject` | Combines polaroid framing + desk animation in a single node. Prefer the two-node pattern. `isolateSubject` behaves as in Animate Stack — the silhouette sits on the white polaroid card, giving a "paper cut-out" look. |
| `flow-face-swap` | Machina-Swap | `suffix` | Mesh interlock node that cross-swaps faces (2 images) or pastes source to all (3+ images). |
| `flow-bg-swap` | Composite onto Background | `suffix`, `format`, `quality`, `scale` (fit/fill/none) | Aggregation. Image 1 = foreground subject (place `ai-remove-bg` upstream to cut it out). Images 2+ = background scenes (used original, unprocessed). Composites the cutout subject onto each background, producing one output per background. Use with ordered selection. |
| `flow-template-aggregator` | Template Render | `templateId`, `filename`, `quality`, `isolateSubject` | Maps batch images sequentially into defined template placeholder slots using OpenCV-detected bounds. If placeholders < images, it chunk-processes them into multiple numbered template composites. `isolateSubject=true` runs InSPyReNet on each slot's image (after fitMode scaling) and composites only the subject into the perspective cell — template background stays visible around the cut-out (requires #mdl; one inference per slot). |
| `flow-video-wall` | Video Wall | `layout`, `filename`, `outputWidth`, `outputHeight`, `fps` | Composites multiple input videos into a multi-stream MP4 grid. `layout` accepts system ids (`grid-2x2`, `custom-tv`) AND custom `templateId`s. Hardware accelerated. Supports Native `.mp4` file handle background looping. |
| `flow-video-concat` | Video Concatenate | `filename`, `fps`, `width`, `height`, `bitrate` | Joins all selected video files end-to-end into a single output MP4. |

### Video Operations (Per-Video, Single-Input)

These transforms operate on individual video files using the mediabunny conversion engine. Non-video files are skipped automatically. All run on the main thread.

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `flow-video-convert` | Video: Convert Format | `format` (mp4/webm/mkv/mov/ogg), `codec`, `audioCodec`, `suffix` | Re-encode to a different container and/or codec |
| `flow-video-trim` | Video: Trim | `start` (s), `end` (s), `suffix` | Cut to a specific time range |
| `flow-video-compress` | Video: Compress | `quality` (low/medium/high/custom), `bitrate` (Mbps), `suffix` | Reduce file size via lower bitrate |
| `flow-video-change-fps` | Video: Change Frame Rate | `fps` (12/24/25/30/60), `suffix` | Retarget the video frame rate |
| `flow-video-strip-audio` | Video: Strip Audio | `suffix` | Remove all audio tracks |
| `flow-video-extract-audio` | Video: Extract Audio | `format` (mp3/wav/flac/ogg/aac), `suffix` | Export audio track as a standalone audio file |
| `flow-video-remix-audio` | Video: Remix Audio | `channels` (keep/1/2), `sampleRate` (keep/22050/44100/48000), `suffix` | Adjust audio channel layout and/or sample rate |

---

## Video Effects (Per-Frame)

These transforms apply existing image effects to every frame of a video using the mediabunny `process` callback and WebCodecs encoding. Each shares its parameter set with the equivalent image transform. All output an MP4. Non-video files are skipped. Runs on the main thread (WebCodecs + DOM required).

> **Preview mode**: In the Recipe Builder and Step Editor, these apply the effect to a single extracted frame for instant preview — no full re-encode needed.

| Transform ID | Source Effect | Key Params | Notes |
|---|---|---|---|
| `video-tuning` | `color-tuning` | `contrast`, `saturation`, `vibrance`, `invert`, `suffix`, `bitrate` | Adjust contrast/saturation/vibrance on every frame |
| `video-duotone` | `color-duotone` | `darkColor`, `lightColor`, `suffix`, `bitrate` | Two-colour tone mapping on every frame |
| `video-tint` | `color-tint` | `color`, `strength`, `blendMode`, `suffix`, `bitrate` | Colour tint overlay on every frame |
| `video-vignette` | `color-vignette` | `amount`, `radius`, `suffix`, `bitrate` | Edge darkening on every frame |
| `video-advanced-effects` | `filter-advanced` | `blurRadius`, `sharpenAmount`, `noiseLevel`, `pixelSize`, `suffix`, `bitrate` | Blur/sharpen/grain/pixelate on every frame |
| `video-bloom` | `filter-bloom` | `threshold`, `blurRadius`, `strength`, `suffix`, `bitrate` | Cinematic highlight glow on every frame |
| `video-color-grade` | `filter-color-grade` | `lift`, `shadowColor`, `shadowStrength`, `highlightColor`, `highlightStrength`, `suffix`, `bitrate` | Split-tone shadow/highlight grading on every frame |
| `video-chromatic-aberration` | `filter-chromatic-aberration` | `offset`, `direction`, `suffix`, `bitrate` | RGB channel fringe on every frame |

---

## Metadata

| Transform ID | Name | Key Params | Notes |
|---|---|---|---|
| `meta-strip` | Strip Metadata | `level` (All / GPS Only / EXIF Only) | Removes EXIF from output |
| `meta-set-exif` | Set EXIF Info | `field` (artist/copyright/comment/description/software), `value` | Writes custom EXIF fields; supports `{{variable}}` |
| `meta-geocode` | Reverse Geocode | `template` (`{city}, {country}`), `targetField` | Converts GPS coords to text and stores in metadata |
| `meta-dominant-color` | Extract Dominant Color | - | Quickly analyses the image to extract the top 3 dominant colors and maps them to semantic keywords ({{dominantColors.0}}, {{dominantHex.0}}). |

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
| `{{dominantColors.0}}` | Primary semantic color name (e.g. 'navy') |
| `{{dominantHex.0}}` | Primary exact hex color (e.g. '#000080') |
| `{{recipe.X}}` | Value of recipe run parameter named X |
