# PicMachina — AI Recipe Generation Guide

> Feed this document to any AI assistant to enable it to answer questions like
> *"I want to apply an infrared film effect and output an animated slideshow"*
> and produce a working recipe — either by identifying an existing system recipe
> or by composing new nodes into a valid JSON recipe.

---

## 1. What is PicMachina?

PicMachina is a local-first, browser-based batch image processing app. Users define **Recipes** — ordered sequences of transform nodes — and run them against a folder of images. All processing happens on-device (no cloud uploads). Outputs are saved to a local subfolder.

Key concepts:
- **Recipe**: a named list of nodes that processes every image in a batch
- **Node**: a single operation (resize, apply colour grade, export, etc.)
- **Branch node**: splits processing into multiple parallel output paths
- **Conditional node**: if/else logic based on image properties
- **Aggregation node**: collects one frame per image then renders a combined output (GIF, video, contact sheet, animated stack)
- **Run parameters**: recipe-level variables surfaced as a form before each batch run; values override matching node params by name

---

## 2. Recipe JSON Schema

### 2.1 Recipe Object

```json
{
  "name": "string — human-readable name",
  "description": "string — short summary",
  "tags": ["string"],
  "coverColor": "#hex — card colour in the library grid",
  "minItems": "number | null — optional minimum input items required",
  "maxItems": "number | null — optional maximum input items allowed",
  "inputType": "string — optional 'image', 'video', or 'any' (defaults to fallback resolution if undefined)",
  "params": "RunParam[] — optional run-time override fields (see §6)",
  "nodes": "RecipeNode[]"
}
```

### 2.2 RecipeNode Types

```json
{
  "id": "string — unique within the recipe (e.g. 'step-1')",
  "type": "transform | branch | conditional",
  "label": "string — optional display label",
  "disabled": false,
  "condition": "ConditionObject — optional per-node guard (skips node if false)"
}
```

**transform** node (most common):
```json
{
  "type": "transform",
  "transformId": "string — see §3 for all IDs",
  "params": { "paramName": value }
}
```

**branch** node (parallel output paths — each branch is independent):
```json
{
  "type": "branch",
  "branches": [
    { "id": "b1", "label": "Thumbnail", "nodes": [ ...RecipeNode ] },
    { "id": "b2", "label": "Full Res",  "nodes": [ ...RecipeNode ] }
  ]
}
```

**conditional** node (if/else):
```json
{
  "type": "conditional",
  "condition": { "field": "IsPortrait", "operator": "eq", "value": true },
  "thenNodes": [ ...RecipeNode ],
  "elseNodes":  [ ...RecipeNode ]
}
```

### 2.3 Condition Object

```json
{
  "field":    "width | height | aspectRatio | HasGPS | IsPortrait | exif.X | meta.X",
  "operator": "eq | neq | gt | lt | gte | lte | contains | exists",
  "value":    "any"
}
```

---

## 3. Transform Library

All transforms are referenced by their `transformId`. Params shown with their default values.

---

### 3.1 Geometric & Framing (`geo-*`)

#### `geo-resize` — Resize
| Param | Type | Default | Notes |
|---|---|---|---|
| `width` | text | `"100%"` | px or % (e.g. `"1920"` or `"50%"`) |
| `height` | text | `""` | Leave blank to maintain aspect |
| `maintainAspect` | boolean | `true` | |
| `algo` | select | `"Lanczos"` | `"Lanczos"` \| `"Bilinear"` |

#### `geo-crop` — Manual Crop
| Param | Type | Default |
|---|---|---|
| `x`, `y` | text | `"0"` |
| `width`, `height` | text | `"100%"` |

#### `geo-smart-crop` — AI Content-Aware Crop
| Param | Type | Default | Notes |
|---|---|---|---|
| `aspectRatio` | select | `"1:1"` | `"1:1"` \| `"4:5"` \| `"16:9"` \| `"4:3"` \| `"3:2"` |
| `strategy` | select | `"Entropy"` | `"Entropy"` \| `"Attention"` |

#### `geo-rotate` — Rotate / Flip
| Param | Type | Default | Notes |
|---|---|---|---|
| `angle` | select | `0` | `0` \| `90` \| `180` \| `-90` |
| `flip` | select | `"none"` | `"none"` \| `"horizontal"` \| `"vertical"` \| `"both"` |

#### `geo-round` — Round Corners
| Param | Type | Default |
|---|---|---|
| `radius` | text | `"5%"` |
| `circular` | boolean | `false` |

#### `geo-padding` — Canvas Padding
| Param | Type | Default |
|---|---|---|
| `top`, `right`, `bottom`, `left` | text | `"5%"` |
| `color` | color | `"#ffffff"` |

#### `geo-trim` — Trim Solid Edges
| Param | Type | Default |
|---|---|---|
| `tolerance` | range 0–100 | `15` |
| `bgSource` | select | `"Pixel"` | `"Pixel"` \| `"Alpha"` |

#### `geo-pixelate` — Pixelate (Nearest-Neighbour)
| Param | Type | Default |
|---|---|---|
| `blockSize` | range 2–32 | `8` |

#### `geo-face-crop` — Face Crop (AI)
| Param | Type | Default |
|---|---|---|
| `padding` | range 0–100 | `20` |
| `faceIndex` | number | `0` |
| `confidence` | range 10–90 | `30` |

#### `geo-body-crop` — Body Crop (AI)
| Param | Type | Default |
|---|---|---|
| `mode` | select | `"Full"` | `"Full"` \| `"Portrait"` |
| `padding` | range 0–100 | `15` |

#### `geo-face-align` — Face Alignment (AI)
| Param | Type | Default |
|---|---|---|
| `eyeLevel` | boolean | `true` |
| `centerNose` | boolean | `true` |
| `targetScale` | range 10–200 | `100` |

#### `ai-subject-crop` — Subject-Aware Crop (InSPyReNet)
Crops to a target aspect ratio while composing around the detected subject. Requires the InSPyReNet model (see `#mdl`); falls back to centre-crop when the model isn't downloaded or no subject is found. Reads `asset.vision.subjectBBox` when available — a second batch at a different aspect ratio skips inference.
| Param | Type | Default | Notes |
|---|---|---|---|
| `aspectRatio` | select | `"1:1"` | `"original"` \| `"1:1"` \| `"4:5"` \| `"3:4"` \| `"4:3"` \| `"16:9"` \| `"9:16"` \| `"custom"` |
| `customRatio` | text | `"1.618"` | Numeric width/height (only used when `aspectRatio="custom"`) |
| `padding` | range 0–50 | `10` | % of subject bbox (not image) |
| `anchor` | select | `"center"` | `"center"` \| `"top"` \| `"bottom"` \| `"thirds-tl"` \| `"thirds-tr"` \| `"thirds-bl"` \| `"thirds-br"` |
| `threshold` | range 10–90 | `50` | Matte confidence % for bbox extraction |

---

### 3.2 Color, Tone & Filters (`color-*`, `filter-*`)

#### `color-tuning` — Standard Tuning
| Param | Type | Default |
|---|---|---|
| `contrast` | range -100–100 | `0` |
| `saturation` | range -100–100 | `0` |
| `vibrance` | range -100–100 | `0` |
| `invert` | boolean | `false` |

#### `color-auto-levels` — Auto Levels
| Param | Type | Default |
|---|---|---|
| `tolerance` | range 0–10 | `0.5` |

#### `color-opacity` — Opacity
| Param | Type | Default |
|---|---|---|
| `opacity` | range 0–100 | `100` |

#### `color-tint` — Color Tint
| Param | Type | Default |
|---|---|---|
| `color` | color | `"#ff8800"` |
| `strength` | range 0–100 | `20` |
| `blendMode` | select | `"source-over"` | `"source-over"` \| `"multiply"` \| `"screen"` \| `"overlay"` \| `"soft-light"` |

#### `color-duotone` — Duotone
| Param | Type | Default |
|---|---|---|
| `darkColor` | color | `"#1a0533"` |
| `lightColor` | color | `"#e8f4d4"` |

#### `color-vignette` — Vignette
| Param | Type | Default |
|---|---|---|
| `amount` | range 0–100 | `40` |
| `radius` | range 0–100 | `65` |

#### `color-posterize` — Posterize
| Param | Type | Default |
|---|---|---|
| `levels` | range 2–8 | `4` |

#### `color-channel-swap` — Channel Swap (Infrared / Aerochrome)
Remaps R, G, B channels to other source channels. Useful for infrared film simulation.
| Param | Type | Default | Notes |
|---|---|---|---|
| `redSource` | select | `"G"` | `"R"` \| `"G"` \| `"B"` |
| `greenSource` | select | `"R"` | `"R"` \| `"G"` \| `"B"` |
| `blueSource` | select | `"B"` | `"R"` \| `"G"` \| `"B"` |

#### `filter-advanced` — Advanced Effects
| Param | Type | Default |
|---|---|---|
| `blurRadius` | range 0–40 | `0` |
| `sharpenAmount` | range 0–100 | `0` |
| `noiseLevel` | range 0–50 | `0` |
| `pixelSize` | range 1–40 | `1` |

#### `filter-bloom` — Bloom / Glow
| Param | Type | Default |
|---|---|---|
| `threshold` | range 0–100 | `75` |
| `blurRadius` | range 2–60 | `20` |
| `strength` | range 0–100 | `70` |

#### `filter-chromatic-aberration` — Chromatic Aberration
| Param | Type | Default |
|---|---|---|
| `offset` | range 1–30 | `8` |
| `direction` | select | `"horizontal"` | `"horizontal"` \| `"vertical"` \| `"diagonal"` |

#### `filter-color-grade` — Colour Grade (Lift/Shadow/Highlight)
| Param | Type | Default |
|---|---|---|
| `lift` | range 0–50 | `0` |
| `shadowColor` | color | `"#000000"` |
| `shadowStrength` | range 0–100 | `0` |
| `highlightColor` | color | `"#ffffff"` |
| `highlightStrength` | range 0–100 | `0` |

#### `filter-edge-detect` — Edge Detection
| Param | Type | Default |
|---|---|---|
| `threshold` | range 0–100 | `15` |
| `softEdges` | boolean | `false` |
| `blurBefore` | range 0–5 | `0` |
| `blendMode` | select | `"none"` | `"none"` \| `"darken"` |
| `edgeStrength` | range 0–100 | `100` |

#### `filter-halftone` — Halftone
| Param | Type | Default |
|---|---|---|
| `dotSpacing` | range 4–40 | `10` |
| `dotColor` | color | `"#000000"` |
| `opacity` | range 5–100 | `40` |
| `invert` | boolean | `false` |

#### `filter-kuwahara` — Kuwahara / Oil Paint
| Param | Type | Default |
|---|---|---|
| `radius` | range 1–8 | `3` |
| `passes` | range 1–3 | `1` |

#### `filter-tilt-shift` — Tilt-Shift Miniature
| Param | Type | Default |
|---|---|---|
| `centerY` | range 10–90 | `50` |
| `bandWidth` | range 5–80 | `25` |
| `blurAmount` | range 2–40 | `12` |
| `feather` | range 0–50 | `30` |

#### `filter-pixel-sort` — Pixel Sort (Glitch)
Sorts pixel runs by luminance within horizontal or vertical strips.
| Param | Type | Default |
|---|---|---|
| `threshold` | range 0–255 | `80` |
| `direction` | select | `"light-to-dark"` | `"light-to-dark"` \| `"dark-to-light"` |
| `stripHeight` | number | `1` |

#### `filter-dither` — Dither (Palette Reduction)
Floyd-Steinberg error-diffusion dithering to a limited colour palette.
| Param | Type | Default | Notes |
|---|---|---|---|
| `palette` | select | `"cga"` | `"mono"` \| `"cga"` \| `"gameboy"` \| `"c64"` |
| `dithering` | boolean | `true` | `false` = hard nearest-colour, no error diffusion |

---

### 3.3 Overlays & Typography (`overlay-*`)

#### `overlay-rich-text` — Rich Text
| Param | Type | Default |
|---|---|---|
| `content` | text | `"{{filename}}"` |
| `font` | text | `"Inter"` |
| `size` | number | `32` |
| `sizeMode` | select | `"px"` | `"px"` \| `"pct-width"` \| `"pct-height"` |
| `color` | color | `"#ffffff"` |
| `opacity` | range 0–100 | `100` |
| `anchor` | select | `"bottom-right"` | `"top-left"` \| `"top-center"` \| `"top-right"` \| `"center-left"` \| `"center"` \| `"center-right"` \| `"bottom-left"` \| `"bottom-center"` \| `"bottom-right"` |
| `offsetX`, `offsetY` | number | `20` |
| `bgBox` | select | `"none"` | `"none"` \| `"wrap"` \| `"full-width"` |
| `bgColor` | color | `"#000000"` |
| `bgOpacity` | range 0–100 | `60` |
| `bgPadding` | number | `8` |
| `shadow` | boolean | `true` |
| `weight` | select | `"400"` | `"300"` \| `"400"` \| `"700"` |
| `blendMode` | select | `"source-over"` | `"source-over"` \| `"multiply"` \| `"screen"` |

#### `overlay-watermark` — Diagonal Watermark
| Param | Type | Default |
|---|---|---|
| `text` | text | `"© {{filename}}"` |
| `font` | text | `"Inter"` |
| `size` | number | `28` |
| `color` | color | `"#ffffff"` |
| `opacity` | range 0–100 | `25` |
| `angle` | range -90–90 | `-35` |

#### `overlay-ribbon` — Ribbon / Badge
| Param | Type | Default |
|---|---|---|
| `text` | text | `"NEW"` |
| `position` | select | `"TR"` | `"TL"` \| `"TR"` \| `"BL"` \| `"BR"` |
| `bgColor` | color | `"#0077ff"` |
| `textColor` | color | `"#ffffff"` |
| `size` | number | `80` |

#### `overlay-qrcode` — QR Code
| Param | Type | Default |
|---|---|---|
| `content` | text | `"https://example.com"` |
| `size` | number | `150` |
| `anchor` | select | `"bottom-right"` | |
| `margin` | number | `16` |
| `errorCorrection` | select | `"M"` | `"L"` \| `"M"` \| `"Q"` \| `"H"` |

#### `overlay-grid` — Grid Overlay
| Param | Type | Default |
|---|---|---|
| `spacing` | number | `50` |
| `color` | color | `"#ffffff"` |
| `opacity` | range 0–100 | `50` |
| `lineWidth` | number | `1` |

#### `overlay-map` — Map View (GPS)
Renders an OpenStreetMap tile at the image's GPS coordinates. Requires EXIF GPS data.
| Param | Type | Default |
|---|---|---|
| `zoom` | range 5–18 | `14` |
| `size` | number | `256` |
| `opacity` | range 0–100 | `85` |
| `anchor` | select | `"bottom-right"` | |
| `margin` | number | `16` |

#### `overlay-light-leak` — Light Leak
| Param | Type | Default |
|---|---|---|
| `edge` | select | `"right"` | `"left"` \| `"right"` \| `"top"` \| `"bottom"` |
| `color` | color | `"#ff6600"` |
| `opacity` | range 0–100 | `35` |
| `spread` | range 10–100 | `65` |
| `blendMode` | select | `"screen"` | `"screen"` \| `"lighter"` \| `"overlay"` |

#### `overlay-canvas-texture` — Canvas Texture
| Param | Type | Default |
|---|---|---|
| `intensity` | range 0–100 | `18` |
| `scale` | range 1–16 | `4` |
| `blendMode` | select | `"overlay"` | `"overlay"` \| `"soft-light"` \| `"multiply"` |

#### `overlay-polaroid-frame` — Polaroid Frame
Expands the canvas with a white border (wider at the bottom) and renders a caption in Dancing Script font. Use before an aggregation node to build a polaroid stack.
| Param | Type | Default | Notes |
|---|---|---|---|
| `borderColor` | color | `"#f5f5f0"` | |
| `borderSide` | number | `20` | px — top/left/right border |
| `borderBottom` | number | `60` | px — bottom border (caption area) |
| `caption` | text | `"{{filename \| sanitized}}"` | Supports `{{variable}}` tokens |

#### `overlay-scanlines` — CRT Scanlines
| Param | Type | Default |
|---|---|---|
| `spacing` | number | `3` |
| `opacity` | range 0–100 | `20` |
| `color` | color | `"#000000"` |

#### `overlay-template` — Template Frame
Draws a Template around the current image using a strict pipeline pass. The image is seamlessly perspective-warped to fit the primary slot, allowing subsequent text overlay nodes to draw directly on the rendered template canvas without escaping the batch processing loop.
| Param | Type | Default |
|---|---|---|
| `templateId` | template-select | - |

---

### 3.4 AI Transforms (`ai-*`)

> **Important**: AI transforms run on the main thread (not in a Web Worker). Recipes containing AI nodes are slower and cannot run concurrently with other batches.

#### `ai-face-privacy` — Face Privacy
| Param | Type | Default |
|---|---|---|
| `mode` | select | `"Blur"` | `"Blur"` \| `"Pixelate"` \| `"Bar"` |
| `confidence` | range 0–100 | `70` |
| `padding` | range 0–100 | `20` |

#### `ai-remove-bg` — Remove Background (MediaPipe, fast)
Fast selfie-segmenter — tuned for people. Use `ai-remove-bg-hq` for arbitrary subjects with pixel-accurate edges.
| Param | Type | Default |
|---|---|---|
| `mode` | select | `"Transparent"` | `"Transparent"` \| `"Silhouette"` |
| `edgeSmoothing` | range 0–100 | `50` |
| `bgFill` | select | `"none"` | `"none"` \| `"color"` \| `"image"` |
| `bgColor` | color | `"#ffffff"` |

#### `ai-remove-bg-hq` — Remove BG (High Quality, InSPyReNet)
State-of-the-art saliency segmentation — clean edges on fur, hair, transparent objects, products. Requires the ~200 MB InSPyReNet model (see `#mdl`). Same parameter shape as `ai-remove-bg` so the two are drop-in swappable in recipes.
| Param | Type | Default |
|---|---|---|
| `mode` | select | `"Transparent"` | `"Transparent"` \| `"Silhouette"` |
| `edgeSmoothing` | range 0–100 | `50` |
| `bgFill` | select | `"none"` | `"none"` \| `"color"` \| `"image"` |
| `bgColor` | color | `"#ffffff"` |
| `bgImage` | file | `""` |

#### `ai-portrait-bokeh` — Portrait Bokeh (InSPyReNet)
Large-aperture lens simulation: keeps the subject sharp and blurs the background. Graduated falloff uses a mid-band blur at half the radius for approximate depth falloff.
| Param | Type | Default |
|---|---|---|
| `blurRadius` | range 0–60 | `15` |
| `edgeFeather` | range 0–30 | `8` |
| `falloff` | select | `"flat"` | `"flat"` \| `"graduated"` |

#### `ai-drop-shadow` — Subject Drop Shadow (InSPyReNet)
Casts a soft shadow behind the detected subject. Works on both transparent cut-outs (writes alpha to empty pixels) and opaque photos (darkens visible background toward shadow color).
| Param | Type | Default |
|---|---|---|
| `offsetX` | range −100..100 | `12` |
| `offsetY` | range −100..100 | `18` |
| `blur` | range 0–80 | `20` |
| `opacity` | range 0–100 | `55` |
| `color` | color | `"#000000"` |

#### `ai-sticker-outline` — Sticker Outline (InSPyReNet)
Cut-out sticker effect: subject + solid ring border. Optional second concentric ring for double-border looks (e.g. white outer + black inner for YouTube thumbnail style).
| Param | Type | Default | Notes |
|---|---|---|---|
| `thickness` | range 1–40 | `8` | First ring width in px |
| `color` | color | `"#ffffff"` | First ring color |
| `doubleOutline` | boolean | `false` | Enables second ring at 2× thickness |
| `secondColor` | color | `"#000000"` | Second ring color (only when `doubleOutline=true`) |
| `bgMode` | select | `"transparent"` | `"transparent"` (cut out) \| `"keep"` (paint ring onto original photo) |

#### `ai-silhouette` — Silhouette
| Param | Type | Default |
|---|---|---|
| `color` | color | `"#000000"` |
| `opacity` | range 0–100 | `100` |

#### `ai-smart-redact` — Smart Redact (OCR)
Detect and blur licence plates, text, or faces using OCR. Use Extract mode to store OCR text without modifying the image.
| Param | Type | Default | Notes |
|---|---|---|---|
| `mode` | select | `"redact"` | `"redact"` \| `"extract"` |
| `targets` | select | `"Text"` | `"Text"` \| `"Face"` |
| `method` | select | `"Blur"` | `"Blur"` \| `"Bar"` |

#### `ai-ocr-tag` — OCR Tag Extractor
Extracts tags from stored OCR text (dates, prices, proper nouns). Requires Smart Redact (Extract mode) to have run first.
| Param | Type | Default |
|---|---|---|
| `minLength` | range 2–10 | `3` |

#### `ai-analyse-people` — Analyse People
Detect and classify people using body pose landmarks and face detection. Stores results to asset metadata without modifying the image. Exposes `{{sidecar.faceCount}}`, `{{sidecar.personCount}}`, `{{sidecar.poseLabel}}`, `{{sidecar.peopleLabel}}`.
| Param | Type | Default |
|---|---|---|
| `faceConfidence` | range 0–100 | `60` |
| `poseConfidence` | range 0–100 | `50` |
| `maxPoses` | range 1–10 | `5` |

#### `ai-clipping-mask` — Clipping Mask
| Param | Type | Default |
|---|---|---|
| `shape` | select | `"Circle"` | `"Circle"` \| `"RoundedRect"` \| `"Diamond"` |
| `feathering` | range 0–50 | `0` |

---

### 3.5 Flow Control (`flow-*`)

#### `flow-export` — Export File
Every recipe must end with at least one `flow-export` (or it auto-exports JPEG at the end of the node list).
| Param | Type | Default |
|---|---|---|
| `suffix` | text | `""` |
| `format` | select | `"image/jpeg"` | `"image/jpeg"` \| `"image/png"` \| `"image/webp"` |
| `quality` | range 1–100 | `90` |

#### `flow-save` / `flow-load` — Canvas State Memory
Save the current canvas state to a named slot, then restore it later. Useful for multi-panel compositions.
| Param | Type | Default |
|---|---|---|
| `label` | text | `"state-1"` |

#### `flow-compose-grid` — Compose Grid from Saved States
Assembles named saved states into a grid (e.g. a 2×2 Warhol-style panel).
| Param | Type | Default |
|---|---|---|
| `panels` | text | `"panel-1,panel-2,panel-3,panel-4"` |
| `columns` | number | `2` |
| `gap` | number | `0` |
| `bgColor` | color | `"#000000"` |

---

### 3.6 Video Operations (`flow-video-*`)

Video operation transforms use the **mediabunny** library to re-encode or inspect video files. Non-video files in the batch are silently skipped. All run on the main thread (WebCodecs required).

> **Important**: Video operation transforms skip non-video files — they can safely coexist in a recipe that also processes images, they will only act on `.mp4`, `.mov`, `.webm` files.

#### `flow-video-convert` — Convert Format
| Param | Type | Default | Notes |
|---|---|---|---|
| `format` | select | `"mp4"` | `"mp4"` \| `"webm"` \| `"mkv"` \| `"mov"` \| `"ogg"` |
| `codec` | select | `"auto"` | `"auto"` \| `"avc"` \| `"hevc"` \| `"av1"` \| `"vp8"` \| `"vp9"` |
| `audioCodec` | select | `"auto"` | `"auto"` \| `"aac"` \| `"opus"` \| `"vorbis"` \| `"mp3"` |
| `suffix` | text | `""` | |

#### `flow-video-trim` — Trim
| Param | Type | Default |
|---|---|---|
| `start` | number | `0` | Start time in seconds |
| `end` | number | `""` | End time in seconds — blank = end of file |
| `suffix` | text | `"_trimmed"` |

#### `flow-video-compress` — Compress
| Param | Type | Default | Notes |
|---|---|---|---|
| `quality` | select | `"medium"` | `"low"` \| `"medium"` \| `"high"` \| `"custom"` |
| `bitrate` | number | `4` | Mbps — only used when `quality` = `"custom"` |
| `suffix` | text | `"_compressed"` | |

#### `flow-video-change-fps` — Change Frame Rate
| Param | Type | Default | Notes |
|---|---|---|---|
| `fps` | select | `30` | `12` \| `24` \| `25` \| `30` \| `60` |
| `suffix` | text | `""` | |

#### `flow-video-strip-audio` — Strip Audio
| Param | Type | Default |
|---|---|---|
| `suffix` | text | `"_silent"` |

#### `flow-video-extract-audio` — Extract Audio
Exports the audio track as a standalone audio file (video is discarded).
| Param | Type | Default | Notes |
|---|---|---|---|
| `format` | select | `"mp3"` | `"mp3"` \| `"wav"` \| `"flac"` \| `"ogg"` \| `"aac"` |
| `suffix` | text | `"_audio"` | |

#### `flow-video-remix-audio` — Remix Audio
| Param | Type | Default | Notes |
|---|---|---|---|
| `channels` | select | `"keep"` | `"keep"` (original) \| `"1"` (stereo→mono) \| `"2"` (mono→stereo) |
| `sampleRate` | select | `"keep"` | `"keep"` \| `"22050"` \| `"44100"` \| `"48000"` |
| `suffix` | text | `""` | |

---

### 3.7 Video Effects (`video-*`)

Video effects apply existing image transforms to **every decoded frame** of a video via mediabunny's `process` callback, then re-encode the result. Each shares its params with the equivalent `color-*` / `filter-*` image transform, plus `suffix` and `bitrate` fields.

In the Recipe Builder and Step Editor, video effect transforms show a **frame preview** — the effect is applied to a single extracted frame for instant feedback without a full re-encode.

> Non-video files are silently skipped.

#### `video-tuning` — Video Tuning (wraps `color-tuning`)
| Param | Type | Default |
|---|---|---|
| `contrast` | range -100–100 | `0` |
| `saturation` | range -100–100 | `0` |
| `vibrance` | range -100–100 | `0` |
| `invert` | boolean | `false` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-duotone` — Video Duotone (wraps `color-duotone`)
| Param | Type | Default |
|---|---|---|
| `darkColor` | color | `"#1a0533"` |
| `lightColor` | color | `"#e8f4d4"` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-tint` — Video Tint (wraps `color-tint`)
| Param | Type | Default |
|---|---|---|
| `color` | color | `"#ff8800"` |
| `strength` | range 0–100 | `20` |
| `blendMode` | select | `"source-over"` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-vignette` — Video Vignette (wraps `color-vignette`)
| Param | Type | Default |
|---|---|---|
| `amount` | range 0–100 | `40` |
| `radius` | range 0–100 | `65` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-advanced-effects` — Video Advanced Effects (wraps `filter-advanced`)
| Param | Type | Default |
|---|---|---|
| `blurRadius` | range 0–40 | `0` |
| `sharpenAmount` | range 0–100 | `0` |
| `noiseLevel` | range 0–50 | `0` |
| `pixelSize` | range 1–40 | `1` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-bloom` — Video Bloom / Glow (wraps `filter-bloom`)
| Param | Type | Default |
|---|---|---|
| `threshold` | range 0–100 | `75` |
| `blurRadius` | range 2–60 | `20` |
| `strength` | range 0–100 | `70` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-color-grade` — Video Color Grade (wraps `filter-color-grade`)
| Param | Type | Default |
|---|---|---|
| `lift` | range 0–50 | `0` |
| `shadowColor` | color | `"#000000"` |
| `shadowStrength` | range 0–100 | `0` |
| `highlightColor` | color | `"#ffffff"` |
| `highlightStrength` | range 0–100 | `0` |
| `suffix` | text | `""` |
| `bitrate` | number | `8000000` |

#### `video-chromatic-aberration` — Video Chromatic Aberration (wraps `filter-chromatic-aberration`)
| Param | Type | Default | Notes |
|---|---|---|---|
| `offset` | range 1–30 | `8` | |
| `direction` | select | `"horizontal"` | `"horizontal"` \| `"vertical"` \| `"diagonal"` |
| `suffix` | text | `""` | |
| `bitrate` | number | `8000000` | |

---

### 3.8 Aggregation Nodes

Aggregation nodes collect **one frame per input image** during the batch run, then combine them into a single output file after all images have been processed.

> **Rule**: A recipe must have exactly one aggregation node. Do not pair it with `flow-export` for the same images — the aggregation node IS the export step.

#### `flow-create-gif` — Animated GIF
| Param | Type | Default |
|---|---|---|
| `filename` | text | `"animation.gif"` |
| `delay` | number | `200` | ms between frames |
| `loop` | boolean | `true` |

#### `flow-create-video` — MP4 Slideshow
| Param | Type | Default |
|---|---|---|
| `filename` | text | `"slideshow.mp4"` |
| `durationPerSlide` | number | `2` | seconds per image |
| `fps` | number | `30` |

#### `flow-video-stitcher` — GPU WebGL Slideshow
An advanced Video Encoder aggregator utilizing WebGL to execute random GPU pan/zoom motions and dynamic crossfade transitions (gl-transitions) natively inside the browser.
| Param | Type | Default | Notes |
|---|---|---|---|
| `filename` | text | `"stitched.mp4"` |
| `durationPerSlide` | number | `3.0` | 
| `transitionDuration` | number | `1.0` | Duration of overlapping crossfade
| `transitionMode` | text | `"random"` | Or `"crossfade"`, `"wipe"`, etc
| `motionMode` | text | `"random"` | Or `"zoom-in"`, `"pan-right"`

#### `flow-title-slide` — Metadata Timeline Sequencer
A main-thread interceptor block that observes a structural metadata value (e.g. `{{sidecar.City}}` or `{{sidecar.Date}}`). When the value explicitly changes between two consecutive frames during a batch run, this node automatically intercepts the queue and generates an interstitial title slide canvas block, injecting it into the payload streams immediately before the image frame that triggered the structural change. Best paired with `flow-video-stitcher`.
| Param | Type | Default | Notes |
|---|---|---|---|
| `triggerField` | text | `{{sidecar.City}}` | The metadata property to monitor for changes
| `template` | text | `Location: {{sidecar.City}}` | The Rich Text payload for the injected title slide
| `backgroundUrl` | text | (empty) | Fallback background URL (accepts relative/absolute paths)
| `durationPerSlide` | number | `3.0` | How long the title slide should hold in a video aggregator

#### `flow-contact-sheet` — Contact Sheet
Assembles all images into a grid JPEG.
| Param | Type | Default |
|---|---|---|
| `columns` | number | `4` |
| `gap` | number | `8` |
| `filename` | text | `"contact-sheet.jpg"` |

#### `flow-template-aggregator` — Template Render
Maps processed batch images sequentially into defined template placeholder slots using geometrical perspective projection.
If the template only has exactly 1 slot, processing a batch of 10 images will yield 10 individually numbered composite renders (e.g. `laptop-1.jpg`, `laptop-2.jpg`).
If the template has 3 slots, processing 9 images will yield 3 composites.
*Note: Using this node suppresses the standard auto-export behavior of single images.*
| Param | Type | Default |
|---|---|---|
| `templateId` | text | - |
| `filename` | text | `"render.jpg"` |
| `quality` | range 0–100 | `90` |

#### `flow-video-wall` — Video Wall
Composites multiple input videos into a single grid-layout MP4. Can map video output to built-in layouts (`grid-2x2`, `custom-tv`) or any dynamic template (`templateId`) dynamically via perspective grids. Supports native loopable video backgrounds via file-system handles!
| Param | Type | Default | Notes |
|---|---|---|---|
| `filename` | text | `"video-wall.mp4"` | |
| `layout` | text | `"grid-2x2"` | Supports system IDs or custom Template IDs |
| `outputWidth` | number | `1920` | Output width px |
| `outputHeight` | number | `1080` | Output height px |
| `fps` | number | `30` | Output framerate |
| `bitrate` | number | `8000000` | Video bitrate |
| `endOfVideo` | text | `"black"` | `black`, `image`, or `text` |
| `fallbackImageUrl` | text | | Local image URL used when `endOfVideo`='image' |
| `captions` | text | | Comma-separated labels mapped dynamically across the cells |

#### `flow-animate-stack` — Animated Desk Stack (Generic)
Places each processed frame onto a textured desk, randomly rotated, animating each photo appearing one by one. Output is GIF or MP4. Use this when the per-image framing has already been applied (e.g. via `overlay-polaroid-frame`).
| Param | Type | Default |
|---|---|---|
| `filename` | text | `"stack"` |
| `format` | select | `"gif"` | `"gif"` \| `"mp4"` |
| `width` | number | `1920` |
| `height` | number | `1080` |
| `deskColor` | color | `"#3d2b1a"` |
| `frameDelay` | number | `800` | ms between frames |
| `maxRotation` | range 0–45 | `35` | degrees |
| `overlap` | range 0–90 | `0` | % each new photo overlaps the previous |

#### `flow-photo-stack` — Polaroid Stack Animation (All-in-One)
Combines `overlay-polaroid-frame` + `flow-animate-stack` in a single node (legacy/convenience). Prefer the two-node pattern for flexibility.
| Param | Type | Default |
|---|---|---|
| `filename` | text | `"photo-stack"` |
| `format` | select | `"gif"` | `"gif"` \| `"mp4"` |
| `width`, `height` | number | `1920`, `1080` |
| `deskColor` | color | `"#3d2b1a"` |
| `frameDelay` | number | `800` |
| `maxRotation` | range 0–45 | `35` |
| `borderColor` | color | `"#f5f5f0"` |
| `borderBottom` | number | `60` |
| `caption` | text | `"{{filename \| sanitized}}"` |
| `overlap` | range 0–90 | `0` |

#### `flow-face-swap` — Machina Face Swap
A robust client-side ML engine that uses MediaPipe Face Landmarker (Tasks Vision) to triangulate 478 points, calculate an affine perspective matrix for each triangle, and seamlessly map Source faces onto Target bodies.
| Param | Type | Default |
|---|---|---|
| `suffix` | text | `"_machinaswap"` |

#### `flow-video-concat` — Video Concatenate
Joins all selected video files end-to-end into a single output MP4. Input order follows file selection order in Batch Setup.
| Param | Type | Default |
|---|---|---|
| `filename` | text | `"concatenated.mp4"` |
| `fps` | number | `30` |
| `width` | number | `""` | Leave blank to use first video's width |
| `height` | number | `""` | Leave blank to use first video's height |
| `bitrate` | number | `8000000` |

---

### 3.9 Metadata (`meta-*`)

#### `meta-strip` — Strip Metadata
| Param | Type | Default |
|---|---|---|
| `level` | select | `"All"` | `"All"` \| `"GPS Only"` \| `"EXIF Only"` |

#### `meta-set-exif` — Write EXIF Fields
| Param | Type | Default |
|---|---|---|
| `field` | select | `"copyright"` | `"artist"` \| `"copyright"` \| `"comment"` \| `"description"` \| `"software"` |
| `value` | text | `"© Owner"` |

#### `meta-geocode` — Reverse-Geocode GPS to Text
| Param | Type | Default |
|---|---|---|
| `template` | text | `"{city}, {country}"` |
| `targetField` | text | `"location"` |

---

## 4. Variable / Token Syntax

Any text param (caption, suffix, content, watermark text, etc.) supports `{{variable}}` injection. Variables are resolved per-image at run time.

| Token | Value |
|---|---|
| `{{filename}}` | Full filename including extension |
| `{{filename \| sanitized}}` | Filename with underscores replacing special chars |
| `{{exif.date}}` | EXIF DateTimeOriginal |
| `{{exif.make}}` | Camera make |
| `{{exif.model}}` | Camera model |
| `{{meta.X}}` | Any custom metadata field X |
| `{{sidecar.X}}` | Any custom sidecar field or extracted data (e.g. `ocrTags`, `faceCount`, `city`) |
| `{{recipe.X}}` | Value of run parameter named X |

---

## 5. System Recipes (Built-in)

These recipes are read-only and available to every user. Users can clone them to customise.

| ID | Name | Effect | Key Nodes |
|---|---|---|---|
| `sys-web-optimise` | Web Optimise | Resize to 1920px, strip GPS, export WebP 85% | geo-resize → meta-strip → flow-export |
| `sys-thumbnail-pack` | Thumbnail Pack | Three size variants (1920 / 800 / 400px) as JPEG | branch (3 paths) → geo-resize → flow-export |
| `sys-privacy-scrub` | Privacy Scrub | Blur faces, strip all metadata | ai-face-privacy → meta-strip → flow-export |
| `sys-watermark` | Watermark | Diagonal tiled watermark across image | overlay-watermark → flow-export |
| `sys-machina-swap` | Machina-Swap | Mesh interlock node that cross-swaps faces (2 images) or pastes source to all (3+ images). | flow-face-swap |
| `sys-photo-stack` | Photo Stack Animation | Polaroid frame each photo, animate dropping onto desk | overlay-polaroid-frame → flow-animate-stack |
| `sys-popart-warhol` | Pop Art Warhol | 4-panel duotone grid | smart-crop → posterize → 4× duotone panels → flow-compose-grid |
| `sys-popart-warhol-halftone` | Pop Art Warhol — Halftone | Warhol grid with halftone dot overlay | same as above + filter-halftone per panel |
| `sys-blueprint` | Blueprint | Technical drawing effect — Sobel edges + blue duotone + grid | edge-detect → color-duotone → overlay-grid → flow-export |
| `sys-cyberpunk` | Cyberpunk | Neon-soaked dark city look | duotone → bloom → chromatic-aberration → flow-export |
| `sys-analog-film` | Classic Analog Film | 1970s warm film look | color-grade → noise → vignette → light-leak → flow-export |
| `sys-oil-painting` | Impressionist Oil Painting | Painterly effect with Kuwahara smoothing | filter-kuwahara → edge-detect → canvas-texture → color-tuning → flow-export |
| `sys-film-noir` | Film Noir | B&W punchy contrast with grain and heavy vignette | color-tuning → filter-advanced → color-vignette → flow-export |
| `sys-retrowave` | Retrowave | 80s synthwave sunset duotone with neon grid | duotone → overlay-grid → chromatic-aberration → bloom → flow-export |
| `sys-lomo` | Lomo Camera | Saturated lomo look with vignette and light leak | color-tuning → color-grade → vignette → noise → light-leak → flow-export |
| `sys-faded-matte` | Faded Matte | Clean faded-film matte with lifted blacks | color-grade → color-tuning → vignette → flow-export |
| `sys-tilt-shift` | Tilt-Shift Miniature | Scale-model blur effect | filter-tilt-shift → color-tuning → flow-export |
| `sys-aerochrome` | Aerochrome (Infrared) | Kodak Aerochrome infrared film simulation — foliage turns pink | color-channel-swap → color-tuning → filter-bloom → flow-export |
| `sys-glitch` | Digital Glitch | Chromatic aberration + pixel sort + CRT scanlines | filter-chromatic-aberration → filter-pixel-sort → overlay-scanlines → flow-export |
| `sys-8bit` | Retro 8-Bit | Pixelate + CGA dither — classic 8-bit game aesthetic | geo-pixelate → filter-dither → flow-export (PNG) |
| `sys-graphic-novel` | Graphic Novel | Photo-realistic with subtle ink outlines — Kuwahara smooth + colour boost + edge ink lines | filter-kuwahara → color-tuning → filter-edge-detect (multiply/invert) → flow-export |
| `sys-graphic-novel-bold` | Graphic Novel — Bold | Bolder comic-book variant with posterisation and heavier ink lines | filter-kuwahara → color-tuning → color-posterize → filter-edge-detect (multiply/invert) → flow-export |
| `sys-vampire-gfx` | Vampire GFX | Chalk-white pallor, cold shadows, skin glow and AI red glowing eyes | filter-kuwahara → color-tuning → filter-color-grade → color-vignette → filter-bloom → ai-glow-eyes → flow-export |
| `sys-cinematic-portrait` | Cinematic Portrait | Saliency-driven photo-studio look — bokeh + warm subject / cool BG grade + subject vignette + contrast lift. Requires the InSPyReNet model (#mdl). | ai-portrait-bokeh → ai-selective-grade → ai-subject-vignette → color-tuning → flow-export |

---

## 6. Run Parameters

Recipes can declare a `params` array at the top level. Before each batch run, the user is shown a form to fill in these values. Values override matching node params by name across all nodes in the recipe.

### Run Param Schema
```json
{
  "name": "string — must match a node param key exactly",
  "label": "string — shown in the form",
  "type": "number | range | select | boolean | text | color",
  "defaultValue": "any",
  "min": 0,
  "max": 100,
  "options": [{ "label": "GIF", "value": "gif" }]
}
```

### Example: Photo Stack with user-controllable format and overlap
```json
{
  "params": [
    { "name": "format",      "label": "Output Format",   "type": "select",
      "options": [{"label":"Animated GIF","value":"gif"},{"label":"MP4 Video","value":"mp4"}],
      "defaultValue": "gif" },
    { "name": "overlap",     "label": "Overlap %",        "type": "range", "min": 0, "max": 90, "defaultValue": 0 },
    { "name": "maxRotation", "label": "Max Rotation (°)", "type": "range", "min": 0, "max": 45, "defaultValue": 35 },
    { "name": "frameDelay",  "label": "Frame Delay (ms)", "type": "number", "defaultValue": 800 }
  ]
}
```

---

## 7. Worked Examples

### Example A: Animated Polaroid Slideshow

**User intent**: "Take my holiday photos, add a polaroid border with the filename as a caption, and output an animated GIF of all photos dropping onto a desk."

This uses the built-in `sys-photo-stack` recipe. If the user wants to customise, clone it or build:

```json
{
  "name": "Polaroid Slideshow",
  "description": "White-bordered polaroids dropping onto a desk one by one",
  "nodes": [
    {
      "id": "step-1", "type": "transform",
      "transformId": "overlay-polaroid-frame",
      "params": {
        "borderColor": "#f5f5f0",
        "borderSide": 20,
        "borderBottom": 60,
        "caption": "{{filename | sanitized}}"
      },
      "label": "Polaroid Frame"
    },
    {
      "id": "step-2", "type": "transform",
      "transformId": "flow-animate-stack",
      "params": {
        "filename": "my-holiday",
        "format": "gif",
        "width": 1920,
        "height": 1080,
        "deskColor": "#3d2b1a",
        "frameDelay": 800,
        "maxRotation": 25,
        "overlap": 30
      },
      "label": "Animate Stack"
    }
  ]
}
```

> **Note**: `flow-animate-stack` is an aggregation node. It collects one frame per image and renders the animation after all images are processed. Do NOT add `flow-export` after it.

---

### Example B: Infrared Film Effect + Contact Sheet

**User intent**: "Apply an Aerochrome-style infrared look to all my landscape photos and produce a contact sheet."

```json
{
  "name": "Infrared Contact Sheet",
  "nodes": [
    {
      "id": "ir-1", "type": "transform",
      "transformId": "color-channel-swap",
      "params": { "redSource": "G", "greenSource": "R", "blueSource": "B" }
    },
    {
      "id": "ir-2", "type": "transform",
      "transformId": "color-tuning",
      "params": { "saturation": 60, "contrast": 20 }
    },
    {
      "id": "ir-3", "type": "transform",
      "transformId": "filter-bloom",
      "params": { "threshold": 63, "blurRadius": 8, "strength": 40 }
    },
    {
      "id": "ir-4", "type": "transform",
      "transformId": "flow-contact-sheet",
      "params": { "columns": 4, "gap": 8, "filename": "infrared-contact.jpg" }
    }
  ]
}
```

---

### Example C: Batch Thumbnail Pack with Watermark

**User intent**: "For each image: create a square-cropped 1080px social version with a copyright watermark, and a 400px thumbnail."

```json
{
  "name": "Social Pack with Watermark",
  "nodes": [
    {
      "id": "s-1", "type": "transform",
      "transformId": "geo-smart-crop",
      "params": { "aspectRatio": "1:1", "strategy": "Attention" }
    },
    {
      "id": "branch-1", "type": "branch",
      "branches": [
        {
          "id": "b-full", "label": "Social (1080px)",
          "nodes": [
            { "id": "b1-r", "type": "transform", "transformId": "geo-resize", "params": { "width": "1080" } },
            { "id": "b1-w", "type": "transform", "transformId": "overlay-watermark",
              "params": { "text": "© My Brand", "opacity": 20, "angle": -35 } },
            { "id": "b1-e", "type": "transform", "transformId": "flow-export",
              "params": { "suffix": "_social", "format": "image/jpeg", "quality": 90 } }
          ]
        },
        {
          "id": "b-thumb", "label": "Thumbnail (400px)",
          "nodes": [
            { "id": "b2-r", "type": "transform", "transformId": "geo-resize", "params": { "width": "400" } },
            { "id": "b2-e", "type": "transform", "transformId": "flow-export",
              "params": { "suffix": "_thumb", "format": "image/webp", "quality": 80 } }
          ]
        }
      ]
    }
  ]
}
```

---

### Example D: Privacy Scrub with Orientation-Aware Export

**User intent**: "Blur all faces, strip GPS, and export at different sizes depending on whether the image is portrait or landscape."

```json
{
  "name": "Privacy Scrub — Size by Orientation",
  "nodes": [
    {
      "id": "p-1", "type": "transform",
      "transformId": "ai-face-privacy",
      "params": { "mode": "Blur", "confidence": 70 }
    },
    {
      "id": "p-2", "type": "transform",
      "transformId": "meta-strip",
      "params": { "level": "All" }
    },
    {
      "id": "p-3", "type": "conditional",
      "condition": { "field": "IsPortrait", "operator": "eq", "value": true },
      "thenNodes": [
        { "id": "p-3a", "type": "transform", "transformId": "geo-resize", "params": { "width": "1080" } },
        { "id": "p-3b", "type": "transform", "transformId": "flow-export", "params": { "suffix": "_safe", "format": "image/jpeg" } }
      ],
      "elseNodes": [
        { "id": "p-3c", "type": "transform", "transformId": "geo-resize", "params": { "width": "1920" } },
        { "id": "p-3d", "type": "transform", "transformId": "flow-export", "params": { "suffix": "_safe", "format": "image/jpeg" } }
      ]
    }
  ]
}
```

---

### Example E: Retro 8-Bit (Pixel Art)

**User intent**: "Turn my photos into 8-bit pixel art with a CGA colour palette."

Use the built-in `sys-8bit` recipe, or build:

```json
{
  "name": "Retro 8-Bit",
  "nodes": [
    {
      "id": "8b-1", "type": "transform",
      "transformId": "geo-pixelate",
      "params": { "blockSize": 6 }
    },
    {
      "id": "8b-2", "type": "transform",
      "transformId": "filter-dither",
      "params": { "palette": "cga", "dithering": true }
    },
    {
      "id": "8b-3", "type": "transform",
      "transformId": "flow-export",
      "params": { "suffix": "_8bit", "format": "image/png", "quality": 100 }
    }
  ]
}
```

---

## 8. Design Rules for AI Recipe Generation

1. **Always end every output path with `flow-export`** — or use an aggregation node (`flow-animate-stack`, `flow-create-gif`, etc.) as the terminal node.
2. **Never combine `flow-export` and an aggregation node** on the same execution path — aggregation nodes ARE the output.
3. **AI transforms** (`ai-*`) work fine in recipes but cause the batch to run on the main thread (slower). Avoid them if the goal doesn't require AI.
4. **`flow-save` / `flow-load`** are for multi-panel compositions within a single image (e.g. Warhol). Don't use them for cross-image state.
5. **`flow-animate-stack` requires all frames to have the same dimensions** — apply `geo-resize` and/or `overlay-polaroid-frame` before it.
6. **Aggregation nodes are per-recipe singletons** — only one `flow-animate-stack` (or `flow-create-gif`, etc.) per recipe.
7. **`{{recipe.X}}` tokens** only resolve if a `params` array declares a param named `X`.
8. **`overlap` in `flow-animate-stack`** controls how much each new photo overlaps the stack of previous ones (0 = no overlap, 90 = heavy stacking). Start at 20–40 for a natural look.
9. **`deskColor` in stack nodes** is the background colour of the animation canvas — dark brown (`#3d2b1a`) looks like a wooden desk; try `#1a1a2e` for a dark surface.
10. **For existing intents**, prefer recommending a system recipe with cloning over building from scratch. Cloned recipes are fully editable in the Builder screen.

---

## 9. Importing Recipes

Recipes in JSON format can be imported directly in the **Recipe Library (LIB)** screen via the Import button. The JSON can be a single recipe object `{...}` or an array `[{...}, {...}]`.

## Native Video Subtitles Workflow

If the user wants native subtitle scraping, recommend the `ai-transcribe` -> `overlay-subtitles` combo:

```json
{
  "id": "node-transcription",
  "type": "transform",
  "transformId": "ai-transcribe",
  "params": {}
},
{
  "id": "node-subs",
  "type": "transform",
  "transformId": "overlay-subtitles",
  "params": {
    "subtitleFile": "{{autoCaptions}}"
  }
}
```
