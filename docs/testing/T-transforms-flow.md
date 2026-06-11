# Transform Tests — Flow Control

**Reference prefix**: `TR-FLOW-`  
**Source file**: `src/engine/transforms/flow.js`, `src/engine/transforms/video.js` (video flow nodes)  
**Total transforms**: 36

> **Note on flow control transforms**: Many of these are "aggregation" nodes — they produce output
> files (video, GIF, PDF, ZIP) rather than modifying a canvas. Their `apply()` is often a stub 
> (`apply() { /* handled by Processor */ }`). Tests for these focus on:
> 1. Registration + param schema correctness (Tier 1)
> 2. The processor correctly detects and handles them (Tier 2)
> 3. Actual output file quality (Tier 5 Manual) or golden image (Tier 4) where feasible

---

## TR-FLOW-001 — flow-export: Registration
- **Tier**: 1
- **Steps**: `registry.get("flow-export")`
- **Expected Result**: Params include `format` (JPEG/PNG/WebP/AVIF), `quality` (range 1–100), `suffix` (text), `subfolder` (text with vars)

## TR-FLOW-002 — flow-export: Processor captures the result as a ProcessResult blob
- **Tier**: 2
- **Test Data**: 100×100 canvas; params `{ format: "image/jpeg", quality: 90, suffix: "-out", subfolder: "" }`
- **Steps**:
  1. Run processor with flow-export node
  2. Collect ProcessResult items from the processor output
- **Expected Result**: At least one ProcessResult with `blob.type === "image/jpeg"`

## TR-FLOW-003 — flow-export: PNG format produces PNG blob
- **Tier**: 2
- **Test Data**: params `{ format: "image/png", quality: 100 }`
- **Expected Result**: `blob.type === "image/png"`

## TR-FLOW-004 — flow-export: Suffix is appended to filename in result
- **Tier**: 2
- **Test Data**: params `{ suffix: "-edited" }`, input filename `"photo"`
- **Expected Result**: ProcessResult `filename` contains `"-edited"`

## TR-FLOW-005 — flow-export: Subfolder with `{{vars}}` is resolved
- **Tier**: 2
- **Test Data**: params `{ subfolder: "{{exif.dateTaken | date(\"YYYY\")}}" }`, context with `exif.dateTaken = "2024-03-01"`
- **Expected Result**: ProcessResult `subfolder === "2024"`

---

## TR-FLOW-006 — flow-export-variable: Registration
- **Tier**: 1
- **Expected Result**: Params include `variableName`, `fileName` (with vars support)

## TR-FLOW-007 — flow-export-variable: Processor exports a context variable to a file
- **Tier**: 2
- **Test Data**: Context variable `autoCaptions` set to SRT content string; params `{ variableName: "autoCaptions", fileName: "{{filename}}.srt" }`
- **Steps**:
  1. Run processor
  2. Check ProcessResult items for a text file
- **Expected Result**: ProcessResult with `filename` ending in `.srt` and blob containing SRT text

## TR-FLOW-008 — flow-export-variable: No-crash when variable does not exist
- **Tier**: 2
- **Test Data**: params `{ variableName: "missing_var" }`; variable not set in context
- **Expected Result**: No crash; graceful skip or empty file

---

## TR-FLOW-009 — flow-save: Registration + sets context variable
- **Tier**: 1 + 2
- **Test Data**: params `{ label: "checkpoint" }`
- **Expected Result**: `context.variables.get("checkpoint")` is an ImageData object after apply

## TR-FLOW-010 — flow-load: Registration + restores canvas from saved state
- **Tier**: 1 + 2
- **Test Data**: Save red canvas as "state", turn canvas blue, load "state"
- **Expected Result**: Canvas reverts to red

## TR-FLOW-011 — flow-load: blend mode `destination-over` composites correctly
- **Tier**: 2
- **Test Data**: Saved state (red, 50% alpha); current canvas (blue, fully opaque); blend = "destination-over"
- **Expected Result**: Canvas shows blue with no change (destination-over means new content goes under)

## TR-FLOW-012 — flow-load: No-crash when label does not exist in context
- **Tier**: 2
- **Test Data**: `flow-load` with label `"nonexistent"`
- **Expected Result**: No crash; canvas unchanged

---

## TR-FLOW-013 — flow-create-gif: Registration
- **Tier**: 1
- **Expected Result**: Params include `fps`, `loop`, `width`, `height`

## TR-FLOW-014 — flow-create-gif: No-crash and produces a GIF blob
- **Tier**: 5 (Manual — requires real browser and multi-frame processing)
- **Test Data**: 3 images processed in a batch
- **Steps**:
  1. Set up a recipe with `flow-create-gif`
  2. Run batch on 3 images
  3. Check output folder
- **Expected Result**: A `.gif` file is created; plays when opened

---

## TR-FLOW-015 — flow-create-video: Registration
- **Tier**: 1
- **Expected Result**: Params include `fps`, `duration`, `codec`, `width`, `height`

## TR-FLOW-016 — flow-create-video: No-crash and produces an MP4 blob
- **Tier**: 5 (Manual)
- **Test Data**: 5 images
- **Steps**: Batch run with flow-create-video recipe
- **Expected Result**: `.mp4` file created; valid duration ~5 × frameDisplayTime

---

## TR-FLOW-017 — flow-contact-sheet: Registration
- **Tier**: 1
- **Expected Result**: Params include `columns`, `rows`, `padding`, `format`

## TR-FLOW-018 — flow-contact-sheet: Produces one output image from N inputs
- **Tier**: 2
- **Test Data**: 4 identical 100×100 images; params `{ columns: 2, rows: 2, padding: 0 }`
- **Steps**:
  1. Run processor with all 4 images
  2. Collect aggregated ProcessResult
- **Expected Result**: One ProcessResult with dimensions 200×200 (2×100 in each direction)

---

## TR-FLOW-019 — flow-compose-grid: Registration
- **Tier**: 1
- **Expected Result**: Params include `columns`, `cellWidth`, `cellHeight`

## TR-FLOW-020 — flow-compose-grid: No-crash + produces one output per grid
- **Tier**: 2

---

## TR-FLOW-021 — flow-title-slide: Registration
- **Tier**: 1
- **Expected Result**: Params include `title`, `subtitle`, `backgroundColor`, `textColor`

## TR-FLOW-022 — flow-title-slide: Injects a new canvas (title image) before normal output
- **Tier**: 2
- **Steps**: Run processor; check that ProcessResults include one extra result (the title slide)
- **Expected Result**: N+1 results when N images processed (first is title slide)

---

## TR-FLOW-023 — flow-photo-stack: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-024 — flow-video-wall: Registration
- **Tier**: 1
- **Expected Result**: Params include `columns`, `rows`, `loop`

## TR-FLOW-025 — flow-video-wall: No-crash with 2×2 grid of video inputs
- **Tier**: 5 (Manual — requires real video files)

## TR-FLOW-026 — flow-video-pip: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-027 — flow-template-aggregator: Registration
- **Tier**: 1
- **Expected Result**: Params include `templateId`

## TR-FLOW-028 — flow-template-aggregator: No-crash when template not found
- **Tier**: 2
- **Expected Result**: Graceful skip; no uncaught error

## TR-FLOW-029 — flow-animate-stack: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-030 — flow-create-pdf: Registration
- **Tier**: 1
- **Expected Result**: Params include `pageSize`, `orientation`, `margin`

## TR-FLOW-031 — flow-create-pdf: Produces a PDF blob from N images
- **Tier**: 5 (Manual)
- **Steps**: Run batch on 3 images; check output
- **Expected Result**: `.pdf` file opens and contains 3 pages (one per input image)

## TR-FLOW-032 — flow-create-pptx: Registration + produces PPTX blob
- **Tier**: 1 + Manual(5)

## TR-FLOW-033 — flow-bg-swap: Registration
- **Tier**: 1
- **Expected Result**: Params include source (background image), blend mode

## TR-FLOW-034 — flow-bg-swap: No-crash when no background image provided
- **Tier**: 2
- **Expected Result**: Graceful skip or original canvas returned

## TR-FLOW-035 — flow-face-morph: Registration
- **Tier**: 1
- **Expected Result**: Registered; may require MediaPipe or model

## TR-FLOW-036 — flow-face-morph: No-crash when no face detected in source
- **Tier**: 2
- **Test Data**: Solid colour canvas (no face)
- **Expected Result**: No throw; canvas unchanged or original returned

## TR-FLOW-037 — flow-create-zip: Registration
- **Tier**: 1
- **Expected Result**: Params include `archiveName`

## TR-FLOW-038 — flow-create-zip: Produces a ZIP blob containing all processed outputs
- **Tier**: 5 (Manual)
- **Steps**: Run batch with 5 images; output is ZIP
- **Expected Result**: `.zip` file contains 5 image files; each is valid

---

## Video Flow Transforms (src/engine/transforms/flow.js — video section)

## TR-FLOW-039 — flow-video-convert: Registration
- **Tier**: 1
- **Expected Result**: Params include `outputFormat` (MP4/WebM/etc.), codec options

## TR-FLOW-040 — flow-video-convert: Converts MP4 to WebM
- **Tier**: 5 (Manual)
- **Test Data**: TD-VID-001 (`short-clip-5s.mp4`)
- **Steps**: Apply convert; open output in browser
- **Expected Result**: `.webm` file plays correctly; duration matches source

## TR-FLOW-041 — flow-video-trim: Registration
- **Tier**: 1
- **Expected Result**: Params include `startTime`, `endTime` (seconds)

## TR-FLOW-042 — flow-video-trim: Output duration equals endTime − startTime
- **Tier**: 5 (Manual)
- **Test Data**: TD-VID-001 (5s); params `{ startTime: 1, endTime: 3 }`
- **Expected Result**: Output is ~2 seconds long

## TR-FLOW-043 — flow-video-compress: Registration
- **Tier**: 1
- **Expected Result**: Params include target bitrate or quality setting

## TR-FLOW-044 — flow-video-compress: Output file is smaller than input
- **Tier**: 5 (Manual)
- **Test Data**: Large video file
- **Expected Result**: Output file size < input file size

## TR-FLOW-045 — flow-video-speed: Registration
- **Tier**: 1
- **Expected Result**: Params include `speed` (e.g. 0.5 = slow motion, 2 = fast)

## TR-FLOW-046 — flow-video-speed: 2× speed produces half-duration output
- **Tier**: 5 (Manual)
- **Test Data**: TD-VID-001 (5s); params `{ speed: 2 }`
- **Expected Result**: Output is ~2.5 seconds

## TR-FLOW-047 — flow-video-change-fps: Registration + no-crash
- **Tier**: 1 + Manual(5)

## TR-FLOW-048 — flow-video-strip-audio: Registration
- **Tier**: 1
- **Expected Result**: No params required (or optional)

## TR-FLOW-049 — flow-video-strip-audio: Output has no audio track
- **Tier**: 5 (Manual)
- **Test Data**: TD-VID-001 (has audio)
- **Expected Result**: Output file has no audio track (verified with browser/ffprobe)

## TR-FLOW-050 — flow-video-extract-audio: Registration
- **Tier**: 1

## TR-FLOW-051 — flow-video-extract-audio: Produces an audio-only output file
- **Tier**: 5 (Manual)
- **Expected Result**: Output is an audio file (MP3/WAV/OGG); plays in browser

## TR-FLOW-052 — flow-video-remix-audio: Registration + no-crash
- **Tier**: 1 + Manual(5)

## TR-FLOW-053 — flow-video-concat: Registration
- **Tier**: 1
- **Expected Result**: Params include ordering or no params (order = processing order)

## TR-FLOW-054 — flow-video-concat: N videos concatenated produce total duration = sum of inputs
- **Tier**: 5 (Manual)
- **Test Data**: TD-VID-001 (5s) × 2
- **Expected Result**: Output is ~10 seconds

## TR-FLOW-055 — flow-video-scroll: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-056 — flow-video-to-gif: Registration
- **Tier**: 1
- **Expected Result**: Params include `fps`, `width`, `loop`

## TR-FLOW-057 — flow-video-to-gif: Converts short video to animated GIF
- **Tier**: 5 (Manual)
- **Test Data**: TD-VID-001
- **Expected Result**: `.gif` file animates when opened; frame rate matches param

## TR-FLOW-058 — flow-geo-timeline: Registration
- **Tier**: 1
- **Expected Result**: Params include `width`, `height`, `fps`, `durationPerPhoto`, `transitionDuration`

## TR-FLOW-059 — flow-geo-timeline: Skips images without GPS and logs warning
- **Tier**: 2
- **Test Data**: Mix of images — 2 with GPS, 1 without; context metadata set accordingly
- **Steps**: Run processor; inspect log output
- **Expected Result**: Warning logged for the non-GPS file; output video created from 2 files

---

## Video Effect Transforms (src/engine/transforms/video.js)

The video transforms (video-tuning, video-duotone, video-tint, etc.) mirror their image counterparts but operate frame-by-frame on video. Each gets:

## TR-FLOW-060 — video-tuning: Registration
- **Tier**: 1
- **Expected Result**: Registered; params mirror `color-tuning` (contrast, saturation, etc.)

## TR-FLOW-061 — video-duotone: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-062 — video-tint: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-063 — video-vignette: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-064 — video-advanced-effects: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-065 — video-bloom: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-066 — video-color-grade: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-067 — video-chromatic-aberration: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-068 — video-posterize: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-069 — video-auto-levels: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-070 — video-channel-swap: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-071 — video-halftone: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-072 — video-tilt-shift: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-073 — video-dither: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-074 — video-kuwahara: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-075 — video-pixel-sort: Registration + no-crash
- **Tier**: 1 + 2

## TR-FLOW-076 — video-mesh-warp: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include mesh control points

## TR-FLOW-077 — video-mesh-warp: No-crash with identity mesh (no distortion)
- **Tier**: 2

## TR-FLOW-078 — video-pose-landmarks: Registration (requires AI model)
- **Tier**: 1
- **Expected Result**: Registered; `requires` array lists pose detection model

## TR-FLOW-079 — video-watermark: Registration
- **Tier**: 1
- **Expected Result**: Params include `image`, `position`, `opacity`, `scale`

## TR-FLOW-080 — video-watermark: No-crash when no image provided
- **Tier**: 2

## TR-FLOW-081 — video-caption: Registration
- **Tier**: 1
- **Expected Result**: Params include `text` or variable reference, `position`, `style`

## TR-FLOW-082 — video-caption: No-crash with empty text
- **Tier**: 2

## TR-FLOW-083 — flow-video-replace-audio: Registration + no-crash
- **Tier**: 1 + Manual(5)
