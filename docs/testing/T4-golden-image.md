# Tier 4 — Golden Image / Visual Regression Tests

**Tool**: Playwright + `pixelmatch` + `pngjs`  
**File location**: `tests/visual/`  
**Run command**: `npx playwright test --config=playwright.visual.config.ts`

## How These Tests Work

1. A Playwright test loads the app in a real browser.
2. It submits a known fixture image through the processor (via the batch run or a special test harness endpoint).
3. The output image is captured and compared pixel-by-pixel against a stored **reference image** using `pixelmatch`.
4. If the diff exceeds a threshold (default: 0.2% of pixels), the test fails and a diff image is saved to `tests/visual/diffs/`.
5. When a change is **intentional** (e.g. algorithm improvement), the reference is updated by running with `UPDATE_GOLDENS=1`.

## Reference Image Management

- Reference images live in `tests/fixtures/goldens/`
- Committed to git-lfs (large binary storage)
- Named: `{test-id}-reference.png`

## Acceptance Criteria

| Diff threshold | Meaning |
|---|---|
| < 0.1% | Pass — within rendering noise |
| 0.1% – 1% | Flag for human review |
| > 1% | Fail |

---

## Color & Tone Transforms

### GI-001
- **Title**: `color-tuning` — saturation +50 on a known image
- **Description**: Applying +50 saturation to a grey image should produce measurable colour shift; applying it to a coloured image should produce visibly richer colours.
- **Test Data**: TD-IMG-004 (`square-grey.png`) — applying saturation to grey has no effect (grey has no chrominance); use TD-IMG-003 (`square-red.png`) for a meaningful diff.
- **Input fixture**: `square-red.png`
- **Transform params**: `{ contrast: 0, saturation: 50, vibrance: 0, invert: false }`
- **Reference**: `GI-001-reference.png`
- **Steps**:
  1. Submit `square-red.png` through `color-tuning` with saturation=50
  2. Capture output
  3. Compare to reference using pixelmatch
- **Expected Result**: Diff < 0.1% of total pixels

### GI-002
- **Title**: `color-tuning` — invert on pure red produces pure cyan
- **Description**: Inverting `#FF0000` (255,0,0) must yield `#00FFFF` (0,255,255). This is a deterministic mathematical result.
- **Input fixture**: `square-red.png`
- **Transform params**: `{ invert: true }`
- **Reference**: Computed (all pixels should be `rgb(0,255,255)`) — no golden needed, check pixel values directly
- **Steps**:
  1. Apply color-tuning with `invert: true`
  2. Sample the centre pixel from output
- **Expected Result**: Centre pixel RGBA = `(0, 255, 255, 255)`

---

## Geometry / Framing Transforms

### GI-003
- **Title**: `geo-crop` — 1:1 square crop of a landscape image centres correctly
- **Description**: Cropping a 1920×1080 image to 1:1 ratio should produce a 1080×1080 output.
- **Input fixture**: `landscape-no-exif.jpg` (TD-IMG-002)
- **Transform params**: `{ aspectRatio: "1:1", anchor: "center" }`
- **Reference**: `GI-003-reference.png`
- **Steps**:
  1. Apply geo-crop
  2. Assert output dimensions and diff against reference
- **Expected Result**: Output is 1080×1080; diff < 0.1%

### GI-004
- **Title**: `geo-crop` — 16:9 crop with "rule of thirds" anchor
- **Input fixture**: `portrait-with-gps.jpg` (TD-IMG-001)
- **Transform params**: `{ aspectRatio: "16:9", anchor: "thirds-tl" }`
- **Reference**: `GI-004-reference.png`
- **Expected Result**: Crop is positioned with subject roughly in upper-left third; diff < 0.2%

### GI-005
- **Title**: Rotate 90° clockwise produces correct output dimensions and pixel content
- **Input fixture**: `landscape-no-exif.jpg` (1920×1080)
- **Transform params**: `{ rotation: 90 }`
- **Steps**:
  1. Apply rotation transform
  2. Assert output dimensions
  3. Compare to reference
- **Expected Result**: Output is 1080×1920; diff < 0.1%

---

## AI — Background Swap (InSPyReNet)

> **Prerequisite**: InSPyReNet model (`inspyrenet-swinb-fp16`) must be downloaded before this test runs.  
> Use `SKIP_AI_GOLDENS=1` to bypass if model is not available.

### GI-006
- **Title**: Background removal on a clean-background portrait
- **Description**: Subject should be cleanly extracted; background pixels should be transparent.
- **Input fixture**: `subject-clean-bg.jpg` (TD-IMG-005)
- **Transform**: `bg-remove` (no replacement background)
- **Reference**: `GI-006-reference.png`
- **Acceptance**: Diff in the subject area < 2% (AI output tolerance is wider); background alpha = 0
- **Steps**:
  1. Run bg-remove
  2. Check that corner pixels (background area) have alpha = 0
  3. Check that subject centre pixel has alpha = 255
  4. Pixelmatch against reference
- **Expected Result**: Corner alpha = 0; subject alpha = 255; diff < 2%

### GI-007
- **Title**: Background swap — replace background with solid colour
- **Input fixture**: `subject-clean-bg.jpg`
- **Transform**: `bg-swap` with replacement colour `#0066FF`
- **Reference**: `GI-007-reference.png`
- **Steps**:
  1. Run bg-swap
  2. Check corner pixels are the replacement colour
  3. Pixelmatch
- **Expected Result**: Corner pixels are `rgb(0, 102, 255)`; diff < 2%

---

## AI — Face Swap (MediaPipe + perspective rendering)

> **Prerequisite**: MediaPipe face detection must load successfully (requires network on first run, then cached).  
> Use `SKIP_AI_GOLDENS=1` to bypass.

### GI-008
- **Title**: Face swap — donor face applied to target image
- **Description**: The output should visually show the donor face blended into the target face region. This is a quality gate — if the algorithm regresses, the diff will be large.
- **Input fixture**: Source=`face-b.jpg`, Target=`face-a.jpg`
- **Transform**: `face-swap`
- **Reference**: `GI-008-reference.png`
- **Acceptance threshold**: 3% (face-swap is inherently variable; this catches complete failures)
- **Expected Result**: Diff < 3%; output has face region modified

---

## Video — Compositor / Stitcher

### GI-009
- **Title**: Compositor produces a video frame at t=0 matching the first input image
- **Description**: For a simple compositor with one clip, the first frame should be close to the source image.
- **Input fixture**: `landscape-no-exif.jpg`
- **Reference**: `GI-009-frame0-reference.png`
- **Expected Result**: Frame 0 pixel diff < 0.5%

### GI-010
- **Title**: Stitcher — contact sheet of 4 images has correct grid layout
- **Description**: 4 images stitched into a 2×2 grid; each quadrant should match the corresponding input.
- **Input fixtures**: TD-IMG-003 (red), TD-IMG-004 (grey), plus two more distinct fixtures
- **Reference**: `GI-010-reference.png`
- **Expected Result**: Diff < 0.5%

---

## Text Overlay Transforms

### GI-011
- **Title**: `overlay-text` — renders text at correct position and size
- **Input fixture**: `square-grey.png` (TD-IMG-004)
- **Transform params**: `{ text: "Hello", x: "50%", y: "50%", fontSize: 24, color: "#000000" }`
- **Reference**: `GI-011-reference.png`
- **Expected Result**: Diff < 0.5%

### GI-012
- **Title**: `overlay-text` — multi-line text with `\n` renders on separate lines
- **Input fixture**: `square-grey.png`
- **Transform params**: `{ text: "Line 1\nLine 2", x: "10%", y: "20%", fontSize: 16 }`
- **Reference**: `GI-012-reference.png`
- **Expected Result**: Diff < 0.5%; two visible text lines

---

## Watermark / Logo Overlay

### GI-013
- **Title**: `overlay-image` — PNG logo composited with correct opacity
- **Input fixture**: `landscape-no-exif.jpg`
- **Transform params**: `{ image: "logo.png", opacity: 0.5, x: "90%", y: "90%", anchor: "bottom-right" }`
- **Reference**: `GI-013-reference.png`
- **Expected Result**: Diff < 1%

---

## Colour Grading

### GI-014
- **Title**: `lut-apply` — applying a known LUT produces the expected colour shift
- **Description**: A specific LUT applied to a test gradient image must produce a mathematically predictable output.
- **Input fixture**: `gradient-test.png` (a synthetic gradient fixture in fixtures/goldens/)
- **Reference**: `GI-014-reference.png`
- **Expected Result**: Diff < 0.2%
