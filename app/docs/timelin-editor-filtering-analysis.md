# Timeline-Editor Effect Suitability Analysis

**Scope**: video timeline editor (`tme`). Audio timeline (`snd`) is a separate concern and only `audio.js` transforms target it. Today the `tme` effects-pool filter at `tme.js:342` intends to hide `sys`/`meta`/`flow` but compares against `category` (display string) instead of `categoryKey`, so **the pool actually shows every registered transform**. That's the first thing to fix; the table below is what *should* appear.

**Verdict legend**
- ✅ **Native** — purpose-built for video timeline (already ships with timeline semantics).
- 👍 **Drop-in** — pure pixel/composition transform; works per-frame with no changes; keyframable params.
- 🔧 **Adapt** — could be useful in a timeline but needs work (often: needs frame-dim invariance, needs caching, or needs a per-frame mode added).
- ❌ **Wrong tool** — exports a file, mutates metadata, or operates on whole batches/clips. Should be hidden in the pool.

---

## Video-native (`video.js`) — `categoryKey: 'video-effect'` style

| Effect | id | Verdict | Notes |
|---|---|---|---|
| Standard Tuning | `video-tuning` | ✅ Native | Brightness/contrast/sat/exposure — keyframe-able. |
| Duotone | `video-duotone` | ✅ Native | |
| Tint | `video-tint` | ✅ Native | |
| Vignette | `video-vignette` | ✅ Native | |
| Advanced Effects | `video-advanced-effects` | ✅ Native | |
| Bloom | `video-bloom` | ✅ Native | |
| Color Grade | `video-color-grade` | ✅ Native | |
| Chromatic Aberration | `video-chromatic-aberration` | ✅ Native | |
| Posterize | `video-posterize` | ✅ Native | |
| Auto Levels | `video-auto-levels` | 🔧 Adapt | Per-frame auto-levels causes flicker. Add a "sample once at clip-in" mode or temporal smoothing. |
| Channel Swap | `video-channel-swap` | ✅ Native | |
| Halftone | `video-halftone` | ✅ Native | |
| Tilt-Shift | `video-tilt-shift` | ✅ Native | |
| Dither | `video-dither` | ✅ Native | |
| Kuwahara (Oil) | `video-kuwahara` | ✅ Native | Heavy — fine for short clips. |
| Pixel Sort | `video-pixel-sort` | ✅ Native | |
| Mesh Warp | `video-mesh-warp` | ✅ Native | |
| Pose Landmarks | `video-pose-landmarks` | ✅ Native | ML/frame — verify perf. |
| Watermark | `video-watermark` | ✅ Native | Overlaps with overlay-watermark — consider deduping. |
| Caption | `video-caption` | ✅ Native | |

---

## Color & Tone (`color.js`) — duplicate of video.js?

These are the still-image versions. Many are 1:1 mirrors of `video-*` effects.

| Effect | id | Verdict | Notes |
|---|---|---|---|
| Standard Tuning | `color-tuning` | 🔧 Adapt | Duplicate of `video-tuning`. Either route both to one shader or hide `color-*` from TME. **Recommendation: pick one set.** |
| Auto Levels | `color-auto-levels` | 🔧 Adapt | Same flicker concern; merge with `video-auto-levels`. |
| Opacity | `color-opacity` | 👍 Drop-in | Useful as keyframable fade. Should be promoted to `video-effect`. |
| Color Tint | `color-tint` | 🔧 Adapt | dup of `video-tint`. |
| Duotone | `color-duotone` | 🔧 Adapt | dup. |
| Vignette | `color-vignette` | 🔧 Adapt | dup. |
| Advanced Effects | `filter-advanced` | 🔧 Adapt | dup of `video-advanced-effects`. |
| Posterize | `color-posterize` | 🔧 Adapt | dup. |
| Edge Detection | `filter-edge-detect` | 👍 Drop-in | No video equivalent — promote. |
| Relight | `filter-relight` | 👍 Drop-in | Promote. |
| Halftone | `filter-halftone` | 🔧 Adapt | dup. |
| Gaussian Blur | `filter-blur` | 👍 Drop-in | Missing from video set — promote. |
| Directional Blur | `filter-directional-blur` | 👍 Drop-in | Promote. |
| Radial Blur | `filter-radial-blur` | 👍 Drop-in | Promote. |
| Gradient Ramp | `filter-gradient-ramp` | 👍 Drop-in | Promote. |
| Bloom / Glow | `filter-bloom` | 🔧 Adapt | dup of `video-bloom`. |
| Chromatic Aberration | `filter-chromatic-aberration` | 🔧 Adapt | dup. |
| Color Grade | `filter-color-grade` | 🔧 Adapt | dup. |
| Kuwahara | `filter-kuwahara` | 🔧 Adapt | dup. |
| Tilt-Shift | `filter-tilt-shift` | 🔧 Adapt | dup. |
| Channel Swap | `color-channel-swap` | 🔧 Adapt | dup. |
| Pixel Sort | `filter-pixel-sort` | 🔧 Adapt | dup. |
| Dither | `filter-dither` | 🔧 Adapt | dup. |
| Selective Color Grade | `ai-selective-grade` | 🔧 Adapt | Per-frame ML matte — perf/temporal-stability concern. Add matte caching. |
| Cinematic Grade | `color-lumetri` | 👍 Drop-in | Promote. |
| Rain on Lens | `filter-rain` | 👍 Drop-in | Animated by nature — perfect for timeline. Promote. |

---

## Geometric & Framing (`geometry.js`)

These reshape the canvas. In a timeline, output dimensions are fixed by the project — so most of these are wrong tools as currently designed.

| Effect | id | Verdict | Notes |
|---|---|---|---|
| Resize | `geo-resize` | ❌ Wrong tool | Changes output dims. Hide. |
| Crop | `geo-crop` | ❌ Wrong tool | Same. A "cropped framing within fixed canvas" version would be timeline-suitable — different effect. |
| Smart Crop | `geo-smart-crop` | ❌ Wrong tool | Same. |
| Rotate/Flip | `geo-rotate` | 🔧 Adapt | 90° steps change dims; arbitrary rotate inside fixed canvas is fine. Add a "preserve canvas" mode → keyframable rotation. |
| Round Corners | `geo-round` | 👍 Drop-in | Pure mask. |
| Canvas Padding | `geo-padding` | ❌ Wrong tool | Resizes canvas. |
| Trim | `geo-trim` | ❌ Wrong tool | Auto-trims transparent pixels — meaningless in timeline. |
| Face Crop | `geo-face-crop` | ❌ Wrong tool | Reframes. Could become a "Face Follow" effect (translate/zoom-keyframed in fixed canvas). 🔧 if redesigned. |
| Body Crop | `geo-body-crop` | ❌ Wrong tool | Same. |
| Face Align | `geo-face-align` | ❌ Wrong tool | Reframes. |
| Subject Crop | `ai-subject-crop` | ❌ Wrong tool | Reframes. |
| Pixelate | `geo-pixelate` | 👍 Drop-in | Promote. |
| Checkerboard | `gen-checkerboard` | ❌ Wrong tool | Generator (replaces image). Could be a fullscreen-overlay-mode adaption. |
| Circle | `gen-circle` | ❌ Wrong tool | Same — generator. |
| Magnify | `geo-magnify` | 👍 Drop-in | Region-of-interest zoom — great keyframable timeline effect. Promote. |
| Lens Distortion | `geo-lens` | 👍 Drop-in | Promote. |
| Turbulent Displace | `geo-turbulent-displace` | 👍 Drop-in | Animated by nature. Promote. |
| Liquify | `geo-liquify` | 👍 Drop-in | Promote. |

---

## Overlays & Typography (`overlays.js`)

| Effect | id | Verdict | Notes |
|---|---|---|---|
| Rich Text | `overlay-rich-text` | 👍 Drop-in | Keyframable position/opacity ideal. Promote. |
| Watermark | `overlay-watermark` | 👍 Drop-in | dup of `video-watermark`. |
| Ribbon/Badge | `overlay-ribbon` | 👍 Drop-in | Promote. |
| QR Code | `overlay-qrcode` | 👍 Drop-in | Static per-frame. Promote. |
| Grid Overlay | `overlay-grid` | 👍 Drop-in | Promote. |
| Map View | `overlay-map` | 🔧 Adapt | Tile fetch + render is heavy; add per-clip cache so it doesn't re-fetch every frame. Then promote. |
| Light Leak | `overlay-light-leak` | 👍 Drop-in | Animated naturally. Promote. |
| Canvas Texture | `overlay-canvas-texture` | 👍 Drop-in | Promote. |
| Polaroid Frame | `overlay-polaroid-frame` | 👍 Drop-in | Promote. |
| Scanlines | `overlay-scanlines` | 👍 Drop-in | Promote. |
| Template Frame | `overlay-template` | 👍 Drop-in | Promote. |
| Device Mockup | `overlay-device-mockup` | 👍 Drop-in | Promote. |
| Animated Timer (HTML) | `overlay-timer` | ✅ Native | Time-based by definition. |
| Raw HTML & Styles | `overlay-html-block` | ✅ Native | Already `video-effect`. |
| Hyperframe Template | `overlay-hyperframe` | ✅ Native | Already `video-effect`. |
| Add Subtitles (.SRT) | `overlay-subtitles` | ✅ Native | Already `video-effect`. |
| Craquelure | `overlay-craquelure` | 👍 Drop-in | Promote. |

---

## AI & Composition (`ai.js`)

| Effect | id | Verdict | Notes |
|---|---|---|---|
| Face Privacy | `ai-face-privacy` | 🔧 Adapt | Per-frame face detect — flicker risk. Add tracker/temporal smoothing. |
| Remove BG | `ai-remove-bg` | 🔧 Adapt | Per-frame matting. Cache per-clip; tolerate cost. |
| Remove BG (HQ) | `ai-remove-bg-hq` | 🔧 Adapt | Same; very heavy. |
| Portrait Bokeh | `ai-portrait-bokeh` | 🔧 Adapt | Same. |
| Subject Drop Shadow | `ai-drop-shadow` | 🔧 Adapt | Reuses matte — useful keyframable. |
| Sticker Outline | `ai-sticker-outline` | 🔧 Adapt | Same. |
| Subject Vignette | `ai-subject-vignette` | 🔧 Adapt | Same. |
| Subject Sharpen | `ai-subject-sharpen` | 🔧 Adapt | Same. |
| Silhouette | `ai-silhouette` | 🔧 Adapt | Same. |
| Smart Redact | `ai-smart-redact` | 🔧 Adapt | Detection flicker concern. |
| OCR Tag Extractor | `ai-ocr-tag` | ❌ Wrong tool | Writes sidecar tags — no visual output. |
| Analyse People | `ai-analyse-people` | ❌ Wrong tool | Writes metadata only. |
| Glowing Eyes | `ai-glow-eyes` | 👍 Drop-in | Per-frame face landmarks → great timeline effect. Promote. |
| Subject Glow | `ai-subject-glow` | 🔧 Adapt | Matte cache. |
| Export Matte | `ai-export-matte` | ❌ Wrong tool | Exports a file. |
| Clipping Mask | `ai-clipping-mask` | 🔧 Adapt | Useful with per-clip matte cache. |
| Chroma Key | `ai-chroma-key` | 👍 Drop-in | Classic keyframable VFX. Promote. |

---

## Flow Control (`flow.js`) — almost all wrong for timeline

These are batch orchestrators / exporters. The timeline IS the composition; these don't belong inside one.

| Effect | id | Verdict |
|---|---|---|
| Export File | `flow-export` | ❌ |
| Export Variable | `flow-export-variable` | ❌ |
| Save State / Load State | `flow-save`, `flow-load` | ❌ |
| Create GIF / Video / PDF / PPTX / ZIP | `flow-create-*` | ❌ Output formats — timeline already outputs video. |
| WebGL / Fast Video Stitcher | `flow-video-stitcher`, `flow-video-fast-stitcher` | ❌ Stitching = what the timeline does. |
| Geotemporal Timeline | `flow-geo-timeline` | ❌ Whole-batch generator. |
| Inject Title Slide | `flow-title-slide` | ❌ Could become a clip-type rather than effect. |
| Render Hyperframe | `flow-render-hyperframe` | ❌ Use `overlay-hyperframe` instead. |
| Contact Sheet / Compose Grid | `flow-contact-sheet`, `flow-compose-grid` | ❌ Multi-image montage. |
| Photo Stack / Animate Stack | `flow-photo-stack`, `flow-animate-stack` | ❌ Whole-batch. |
| Extract Video Frame | `video-extract-frame` | ❌ Decoding op outside timeline scope. |
| GIF from States | `flow-gif-from-states` | ❌ |
| Video Wall / PiP | `flow-video-wall`, `flow-video-pip` | 🔧 Adapt — could become a *clip-level* effect (composite a second clip), but as designed they're whole-batch. |
| Template Render | `flow-template-aggregator` | ❌ |
| Composite onto Background | `flow-bg-swap` | 🔧 Adapt — equivalent of chroma-key + bg layer. Already covered better by `ai-chroma-key`. |
| Face Morph | `flow-face-morph` | ❌ Two-input batch op. |
| Video: Convert / Trim / Compress / Speed / Change FPS / Strip-Audio / Extract-Audio / Remix-Audio / Replace-Audio / Concat / To-GIF / Scroll | `flow-video-*`, `flow-video-to-gif` | ❌ All operate on whole video files. The timeline's render pipeline owns these; no use as a per-clip effect. |

---

## Metadata (`metadata.js`)

All of these only mutate sidecar fields — no visual output. Hide from timeline.

| Effect | id | Verdict |
|---|---|---|
| Strip Metadata | `meta-strip` | ❌ |
| Set EXIF Info | `meta-set-exif` | ❌ |
| Geocode | `meta-geocode` | ❌ |
| Extract Dominant Color | `meta-dominant-color` | ❌ |
| Blur Detect | `meta-blur-detect` | ❌ |
| Sidecar Write | `meta-sidecar-write` | ❌ |

---

## Audio & Video (`audio.js`)

Belongs to `snd` editor (audio timeline), not video timeline.

| Effect | id | Verdict |
|---|---|---|
| Auto-Transcribe (Whisper) | `ai-transcribe` | ❌ for `tme`; native for `snd`. |
| Generate Audio (Kokoro TTS) | `flow-audio-tts` | ❌ for `tme`; native for `snd`. |

---

## Recommendations

1. **Fix the pool filter bug** at `tme.js:342`. Compare against `categoryKey` (`'flow' | 'meta' | 'sys'`), not `category`. With the current bug, every Wrong-tool effect above is currently visible and draggable.

2. **Add a `timeline` capability flag** to the transform definition (e.g. `timeline: 'native' | 'compatible' | 'unsupported'`). Filter the TME pool by `timeline !== 'unsupported'`. This is more honest than category-based filtering and survives recategorisation.

3. **De-duplicate `color-*`/`filter-*` vs `video-*`**. The 14 duplicates mean two implementations to maintain and confuse users. Pick one canonical set; either:
   - Drop `video-*` and have the engine route the still-image transforms through the per-frame pipeline (preferred — less code).
   - Or drop `color-*`/`filter-*` from `tme` and only show `video-*`.

4. **Promote ~25 "👍 Drop-in" effects** by adding `categoryKey: 'video-effect'` (or the new `timeline` flag) so they appear in TME with confidence: opacity, edge-detect, relight, all blurs, gradient-ramp, lumetri, rain, pixelate, magnify, lens, turbulent-displace, liquify, every overlay except map, glow-eyes, chroma-key.

5. **For "🔧 Adapt" effects** — common patterns:
   - **Matte/detection caching** (per-clip, optionally per-second): all `ai-*` and the matting AI effects. Without it, scrubbing in the timeline is painful.
   - **Temporal smoothing** for auto-levels and detector-driven effects (Kalman/EMA on bbox/landmark).
   - **"Preserve canvas" mode** for geometric effects (rotate, crop-as-framing, lens) so output dims remain timeline-fixed.

6. **Reframing geometry effects** (Face Crop, Body Crop, Subject Crop, Smart Crop) should become a single new `video-track-and-frame` effect: detect once, then apply keyframable pan/zoom inside the fixed canvas. Today they're whole-image reframers and don't fit.

7. **Hide entirely from TME**: all `flow-*` exporters, all `meta-*`, `ai-export-matte`, `ai-ocr-tag`, `ai-analyse-people`, `geo-trim`, `geo-resize`, `geo-padding`, `gen-checkerboard`, `gen-circle`, `flow-audio-*`. Counts: ~38 effects belong only in recipe mode.

### Rough scoreboard

- ✅ Native / already video-tuned: **23**
- 👍 Drop-in (just need a flag): **~25**
- 🔧 Adapt (worth doing): **~22**
- ❌ Wrong tool — hide from TME: **~38**

Total ~108 transforms in registry. The TME pool today shows them all; the right pool would show **~70** with most current Native + Drop-in items immediately useful and the Adapt set as the engineering backlog.
