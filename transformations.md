# Specification: Comprehensive Transformation & Flow Library

## 1. Overview
This catalog defines the atomic nodes available in the **Node Editor (NED)**. Transformations are categorized by their functional impact on the media. All text-based fields support variable injection via `{{meta.key}}` or `{{exif.key}}`.

---

## 2. Geometric & Framing
*Physical modifications to layout and dimensions.*

| Node Name | Description | Settings Metadata (Fields) | Icon |
| :--- | :--- | :--- | :--- |
| **Resize** | Scales media. | `width`, `height`, `maintainAspect` (bool), `algo` (Lanczos/Bilinear) | `mdi:aspect-ratio` |
| **Crop** | Standard manual trim. | `x`, `y`, `width`, `height` (px or %) | `mdi:crop` |
| **Smart Crop** | AI-driven content aware crop. | `aspectRatio` (1:1, 4:5, 16:9), `strategy` (Entropy/Attention) | `mdi:auto-fix` |
| **Face Crop** | Centers on detected faces. | `padding` (%), `faceIndex` (int), `zoomStrategy` | `mdi:face-man` |
| **Rotate/Flip** | Changes orientation. | `angle` (90, 180, 270), `direction` (H/V) | `mdi:rotate-right` |
| **Round Corners** | Rounds image edges. | `radius` (px/%), `isCircular` (bool) | `mdi:rounded-corner` |
| **Canvas Padding** | Adds "internal" margins. | `top`, `right`, `bottom`, `left` (px), `color` (hex) | `mdi:select-inverse` |
| **Trim** | Removes solid edges. | `tolerance` (0-100), `bgSource` (Pixel/Alpha) | `mdi:content-cut` |

---

## 3. Color, Tone & Filters
*Pixel-level enhancements and stylistic algorithms.*

| Node Name | Description | Settings Metadata (Fields) | Icon |
| :--- | :--- | :--- | :--- |
| **Standard Tuning**| Core adjustments. | `contrast`, `saturation`, `vibrance`, `invert` (-100 to 100) | `mdi:tune` |
| **Auto Levels** | Normalizes exposure. | `clippingTolerance` (%) | `mdi:brightness-auto` |
| **Opacity** | Sets global transparency. | `alpha` (0-100%) | `mdi:opacity` |
| **Color Tint** | Overlays a specific hue. | `color` (hex), `strength` (%), `blendMode` | `mdi:format-color-fill` |
| **Duotone** | Replaces tones with 2 colors. | `darkColor` (hex), `lightColor` (hex) | `mdi:tonality` |
| **Advanced Effects**| Stylistic filters. | `blurRadius`, `sharpenAmount`, `noiseLevel`, `pixelSize` | `mdi:filter-vintage` |
| **Vignette** | Darkens/softens edges. | `amount` (%), `radius` (%) | `mdi:vignette` |

---

## 4. Creative Overlays & Typography
*Adding information and branding layers.*

| Node Name | Description | Settings Metadata (Fields) | Icon |
| :--- | :--- | :--- | :--- |
| **Rich Text** | Advanced text rendering. | `content` (vars), `font`, `weight`, `align`, `shadow`, `blend` | `mdi:text-fields` |
| **Watermark** | Branded image overlay. | `sourcePath`, `opacity`, `angle`, `anchor` (9-point) | `mdi:branding-watermark` |
| **Typography FX** | Text as a mask. | `mode` (Fill/Cutout), `bgImage` (path) | `mdi:format-text-wrapping-clip` |
| **QR Code** | Generates scan code. | `content` (URL/Var), `size`, `errorCorrection` | `mdi:qrcode` |
| **Ribbon/Badge** | Corner overlays. | `text`, `position` (TL, TR, BL, BR), `bgColor`, `textColor` | `mdi:bookmark` |
| **Map View** | Renders location map. | `zoom`, `style` (Street/Sat), `opacity` (requires GPS meta) | `mdi:map` |

---

## 5. AI & Composition
*Intelligent masking and privacy tools.*

| Node Name | Description | Settings Metadata (Fields) | Icon |
| :--- | :--- | :--- | :--- |
| **Face Privacy** | Obscures identity. | `mode` (Blur/Pixelate/Bar), `confidence` (0-100) | `mdi:incognito` |
| **Smart Redact** | Hides sensitive data. | `targets` (Plate/Card/Face), `method` | `mdi:shield-edit` |
| **Remove BG** | AI Background Removal. | `edgeSmoothing`, `feathering` | `mdi:image-filter-none` |
| **Clipping Mask** | Shape-based masking. | `shape` (Circle/SVG), `feathering` | `mdi:shape-outline` |

---

## 6. Flow Control & Export
*The "Logic" nodes that handle branching and final output.*

| Node Name | Description | Settings Metadata (Fields) | Icon |
| :--- | :--- | :--- | :--- |
| **Save/Load Point** | Memory states. | `label` (string) | `mdi:content-save-cog` |
| **Branch/Variant** | Creates parallel versions. | `label` (e.g., "Thumbnail"), `nestedActions` | `mdi:source-branch` |
| **Conditional** | Logic-based flow. | `if` (HasGPS / IsPortrait / MetaExists), `then` (node) | `mdi:call-split` |
| **Export File** | Standard image output. | `suffix`, `format` (JPG/PNG/WEBP/AVIF), `quality` | `mdi:file-export` |
| **Create Video** | Renders image sequence. | `filename`, `durationPerSlide`, `fps` | `mdi:movie-play` |
| **Create GIF** | Renders animated GIF. | `filename`, `delay`, `loop` (bool) | `mdi:gif` |
| **Contact Sheet** | Grid of multiple images. | `columns`, `gap` (px), `filename` | `mdi:grid` |

---

## 7. Metadata Processing
| Node Name | Description | Settings Metadata (Fields) | Icon |
| :--- | :--- | :--- | :--- |
| **Strip Metadata** | Privacy scrubbing. | `level` (All, GPS Only, Exif Only) | `mdi:layers-remove` |
| **Geocode** | Converts GPS to Text. | `template` (e.g. "{city}, {country}"), `targetField` | `mdi:map-marker-distance` |
| **Set EXIF Info** | Writes custom data. | `field` (Artist/Copyright/Comment), `value` (string) | `mdi:database-edit` |

