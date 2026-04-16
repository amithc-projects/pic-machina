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

## Phase 6: Time-Ranged & Transitional Video Effects

Gives per-frame video-effect nodes finer control over *when* their effect is applied, with smooth fade-in/fade-out transitions and an optional Freeze mode that inserts new duration into the timeline.

---

### 6.1 Duration Modes

| Mode | Behaviour | Use Case |
|---|---|---|
| **Standard** | Applies the effect to a slice of the existing video. Total duration is unchanged. | Fades, colour shifts, temporary blur. |
| **Freeze** | Extracts a single frame and inserts new duration into the timeline. Total duration increases. | Intro/outro transitions; dramatic mid-video pauses. |

---

### 6.2 Data Model Extension

Every video-effect transform node gains an optional `timeRange` object. If absent, the effect applies to the full video (backwards-compatible with all existing recipes).

```javascript
{
  id: 'node-uuid',
  type: 'transform',
  transformId: 'video-blur',
  params: { blurRadius: 45 },
  timeRange: {
    mode: 'standard',      // 'standard' | 'freeze'
    start: 0,              // standard: window start (s) | freeze: frame to capture (s)
    end: 4,                // standard: window end (s)   | freeze: null (not used)
    insertDuration: 2.0,   // freeze only: seconds of new video to insert
    fadeIn: 0,             // ramp-up duration (s) — strength goes 0 → 1
    fadeOut: 2,            // ramp-down duration (s) — strength goes 1 → 0
    easing: 'linear'       // 'linear' | 'ease-in' | 'ease-out'
  }
}
```

**Timestamp reference**: `start` and `end` refer to the video *at that point in the node pipeline*. If an earlier node trims the video, timestamps are relative to the trimmed duration.

**Overlapping ranges**: When two video-effect nodes have overlapping time windows, they are applied in node order (sequentially composited per frame).

---

### 6.3 Effect Strength

Each video-effect transform declares a `strengthParam` field in its definition, naming the single parameter that is interpolated by the time range engine:

```javascript
// Example in video.js transform definition
{
  id: 'video-blur',
  strengthParam: 'blurRadius',   // ← this param is scaled by the 0–1 strength envelope
  params: [ ... ]
}
```

At each frame, the engine computes a `strength` scalar (0–1) from the time position and easing curve, then scales the declared param from `0` (no effect) to its configured value (full effect). All other params are passed through unchanged.

**Easing functions**:
- `linear` — constant rate
- `ease-in` — starts slow, accelerates (`t²`)
- `ease-out` — starts fast, decelerates (`1 - (1-t)²`)

---

### 6.4 Processing Logic

#### Standard Mode
The engine computes `strength` for each frame timestamp:
1. If `timestamp < start` or `timestamp > end` → `strength = 0` (skip effect entirely)
2. If inside `fadeIn` window → `strength = eased(elapsed / fadeIn)`
3. If inside `fadeOut` window → `strength = eased(1 - elapsed / fadeOut)`
4. Otherwise → `strength = 1`

The `strengthParam` value is temporarily overridden to `configuredValue × strength` before calling the transform's `applyPerFrame`.

#### Freeze Mode
1. At `start`, extract the current decoded frame to a buffer canvas.
2. For `insertDuration` seconds, emit copies of the buffered frame instead of advancing the source decode position.
3. Audio during the frozen period is **silenced** (replaced with empty PCM samples).
4. `strength` is computed relative to `insertDuration` (not the source timestamp) — so `fadeOut: 2` with `insertDuration: 2` fades from full effect to clear across the entire inserted segment.
5. After the freeze, normal decoding resumes from the frame immediately following `start`.

---

### 6.5 UI: Node-Level Time Strip (NED Screen)

Each video-effect node gains an interactive **Time Strip** in the NED inspector below the parameter fields.

**Controls:**
- **Mode toggle**: Standard / Freeze switch
- **Timeline bar**: A horizontal strip with a filmstrip background (5–10 thumbnail frames extracted from the loaded test video at evenly-spaced timestamps using `extractVideoFrame`)
- **Standard handles**: Draggable left/right edges for `start`/`end`; inner gradient handles for `fadeIn`/`fadeOut`
- **Freeze handle**: A single pin marker for the capture frame; a duration input for `insertDuration`
- **Easing selector**: Dropdown (Linear / Ease In / Ease Out)
- **Strength label**: Read-only badge showing which param is being animated (e.g. "animating: blur radius")

The filmstrip is generated once when a test video is loaded in the workspace, and cached for the session.

---

### 6.6 UI: Global Timeline (SET Screen)

A read-only multi-track timeline appears below the batch setup preview, **only when the selected file set contains at least one video**.

- One horizontal track per recipe node that has a `timeRange`
- Tracks labelled with the transform name and the animated param
- **Freeze** nodes rendered as distinct coloured blocks that visually extend the total duration bar
- **Standard** nodes rendered as gradient-filled bands showing the fade envelope
- Hovering a track highlights the corresponding node in the recipe list

---

### 6.7 Verification Scenarios

| Scenario | Setup | Expected Output |
|---|---|---|
| **Freeze intro** | `mode: freeze`, `start: 0`, `insertDuration: 2`, `fadeOut: 2`, blur | Output 2 s longer; starts blurry, sharpens over 2 s |
| **Standard segment** | `mode: standard`, `start: 0`, `end: 2`, `fadeOut: 2`, blur | Original duration; starts blurry, clears over 2 s |
| **Mid-video colour shift** | `mode: standard`, `start: 5`, `end: 10`, `fadeIn: 1`, `fadeOut: 1` | Effect ramps in at 5 s, holds, ramps out at 9 s |
| **No timeRange** | existing recipe node without `timeRange` | Effect applies to full video — unchanged behaviour |

---

## Implementation Architecture

All new transforms integrate with the existing engine without structural changes:

```
src/engine/
├── transforms/
│   ├── video.js          ← EXTEND: add strengthParam to each video-effect transform (Phase 6)
│   └── flow.js           ← EXTEND: format/audio/concat transforms (Phase 1 + 2)
├── compositor.js         ← EXTEND: video concat logic alongside existing GIF/PDF
├── video-convert.js      ← EXTEND: timeRange strength envelope + freeze frame insertion (Phase 6)
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
