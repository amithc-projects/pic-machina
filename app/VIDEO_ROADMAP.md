# Video Roadmap

Pic-Machina is gaining a new tier of video processing capabilities powered by [Mediabunny](https://mediabunny.dev), a WebCodecs-based media library that runs entirely in the browser with zero server uploads.

All video operations run inside the existing Web Worker architecture and follow the same node-based recipe pattern as image transforms.

---

## How It Works

Mediabunny decodes video files frame-by-frame using the browser's hardware-accelerated WebCodecs API. Each frame is exposed as a `VideoSample` which can be drawn onto an `OffscreenCanvas`. Pic-Machina's existing Canvas 2D transform logic (the same code that powers image effects) runs on that canvas before the frame is re-encoded into the output file.

This means **any image effect in Pic-Machina can be applied to video**, with no new pixel-manipulation code required.

---

## Phase 1: Format & Container Operations

New `flow` category transforms for whole-video operations.

### `flow-video-convert`
Re-encode a video to a different format or codec.
- **Output formats**: MP4, WebM, MKV, Ogg, MPEG-TS, QuickTime (.mov)
- **Params**: output format, video codec, audio codec, bitrate
- **Use case**: Convert HEVC to H.264 for broader compatibility; MP4 to WebM for web delivery

### `flow-video-trim`
Cut a video to a specific time range.
- **Params**: start time (seconds), end time (seconds)
- **Use case**: Remove intro/outro, isolate a clip

### `flow-video-compress`
Reduce file size by lowering bitrate.
- **Params**: target bitrate, quality preset (low / medium / high)
- **Use case**: Batch compress footage for web or social delivery

### `flow-video-concat`
Join multiple video files end-to-end into a single output.
- **Params**: sequence order (from file selection order in browser), output format, transition (cut / crossfade)
- **Implementation**: Sequential mediabunny reads with running timestamp offset; audio tracks merged in sync
- **Use case**: Assemble clips from a folder into a single video; build a highlight reel from a batch selection
- **Note**: Input order follows the file selection order in the Pic-Machina folder browser

### `flow-video-change-fps`
Change the frame rate of a video.
- **Params**: target FPS (12 / 24 / 25 / 30 / 60)
- **Use case**: Match footage from different cameras; slow-motion / fast-motion effect

---

## Phase 2: Audio Operations

New audio transforms — entirely new capability with no current equivalent in Pic-Machina.

### `flow-video-strip-audio`
Remove all audio tracks from a video.
- **Params**: none
- **Use case**: Silent video for overlaying custom audio later

### `flow-video-extract-audio`
Export the audio track as a standalone audio file.
- **Output formats**: MP3, FLAC, WAVE, AAC (M4A), Ogg
- **Params**: output format, sample rate
- **Use case**: Rip audio from video; extract narration or music

### `flow-video-replace-audio`
Swap a video's audio track with a different audio file.
- **Params**: replacement audio file (from library assets), trim / loop to fit
- **Use case**: Add music to a silent video; replace recorded audio with a clean take

### `flow-video-remix-audio`
Adjust audio channel layout and sample rate.
- **Params**: channels (stereo → mono, mono → stereo), sample rate
- **Use case**: Normalise audio for broadcast or podcast delivery

---

## Phase 3: Per-Frame Video Effects

New `video` category transforms. Each reuses existing Pic-Machina image processing logic, applied inside a mediabunny `process` callback on every decoded frame.

### Colour & Tone Effects (reused from existing image transforms)

| Transform ID | Name | Existing Source |
|---|---|---|
| `video-tuning` | Standard Tuning | `color-tuning` |
| `video-duotone` | Duotone | `color-duotone` |
| `video-tint` | Colour Tint | `color-tint` |
| `video-vignette` | Vignette | `color-vignette` |
| `video-posterize` | Posterize | `color-posterize` |
| `video-auto-levels` | Auto Levels | `color-auto-levels` |
| `video-channel-swap` | Channel Swap | `color-channel-swap` |

### Filter & Creative Effects (reused from existing image transforms)

| Transform ID | Name | Existing Source |
|---|---|---|
| `video-grain` | Film Grain / Noise | `filter-advanced` |
| `video-blur` | Blur | `filter-advanced` |
| `video-bloom` | Bloom / Glow | `filter-bloom` |
| `video-color-grade` | Colour Grade (LUT) | `filter-color-grade` |
| `video-chromatic-aberration` | Chromatic Aberration | `filter-chromatic-aberration` |
| `video-halftone` | Halftone | `filter-halftone` |
| `video-tilt-shift` | Tilt-Shift | `filter-tilt-shift` |
| `video-dither` | Dither | `filter-dither` |
| `video-kuwahara` | Oil Paint (Kuwahara) | `filter-kuwahara` |
| `video-pixel-sort` | Pixel Sort | `filter-pixel-sort` |

> **Implementation note**: These reuse the Canvas 2D processing functions from `src/engine/transforms/color.js` directly inside the mediabunny `process` hook. No new pixel-manipulation code is needed.

---

## Phase 4: Compositing & Overlay

### `video-watermark`
Burn a watermark image into every frame of a video.
- **Params**: watermark image (from library), position (9-point grid), opacity, scale
- **Reuses**: `overlay-watermark` logic for watermark generation
- **Use case**: Brand protection; content attribution

### `video-caption`
Burn closed captions into every frame (hardcoded / open captions).
- **Params**: caption file (WebVTT / SRT), font, size, colour, background, position
- **Use case**: Accessible video; social media captions without player support required

> **Soft subtitle tracks** (player-toggleable) are also possible via mediabunny's `TextSubtitleSource` — this would embed a proper subtitle track in the container without burning pixels.

### `video-pip` — Picture-in-Picture
Overlay one video on top of another (e.g. talking head over screen recording).
- **Params**: overlay video (from library), position, scale, shape (rectangle / circle), border
- **Implementation**: `CanvasSource` approach — two simultaneous mediabunny `Input` readers, frames composited per timestamp
- **Use case**: Tutorial videos; reaction videos; presenter overlay on slides

---

## Phase 5: Perspective & Spatial Compositing

Extends the existing perspective pipeline (`src/engine/utils/perspective.js`) to video output.

### `video-embed-in-scene`
Embed a video into a perspective-corrected slot within a scene, using the existing Template system.
- **Params**: template (selected from the template library), slot (if the template has multiple), fit mode
- **Reuses**: The full template pipeline — templates are authored in the Template Editor (`tpl.js`), which defines one or more perspective quad slots via 4-point drag handles. The same `drawPerspectiveCell()` from `perspective.js` that powers `overlay-template` renders each video frame into the slot at the correct angle.
- **Output**: Re-encoded video at the template's background image dimensions
- **Use case**: Product mockups (phone/laptop screens); device frame composites; TV room / billboard scene composites; video advertisements
- **Workflow**: Author the scene once in the Template Editor → reuse it across any video via this transform node, exactly as `overlay-template` does for still images

---

## Implementation Architecture

All new transforms integrate with the existing engine without structural changes:

```
src/engine/
├── transforms/
│   ├── video.js          ← NEW: per-frame effect transforms (Phase 3 + 4 + 5)
│   └── flow.js           ← EXTEND: format/audio/concat transforms (Phase 1 + 2)
├── compositor.js         ← EXTEND: video concat logic alongside existing GIF/PDF
└── worker.js             ← no changes needed
```

**Dependency**: Add `mediabunny` to `package.json`. WebCodecs required (Chrome/Edge; Safari 16+ partial).

---

## Concatenation — File Selection Workflow

For `flow-video-concat`, the intended UX:
1. User opens the folder browser and selects multiple video files
2. Files appear in the recipe setup screen in selection order
3. A `flow-video-concat` node at the end of the recipe joins them in that order
4. Output is a single video file

The sequence order is driven by the existing file selection UI — no new UI component needed.

---

## Out of Scope

- Live recording / webcam capture (mediabunny supports `MediaStreamVideoTrackSource` but this is a separate feature)
- Cloud rendering or server-side processing
- Firefox support (WebCodecs not supported)
