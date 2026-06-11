# Transform Tests — Geometric & Framing

**Reference prefix**: `TR-GEO-`  
**Source file**: `src/engine/transforms/geometry.js`  
**Total transforms**: 22

## Testing approach per transform

Each transform gets:
1. **Registration test** (Tier 1): Transform registered in registry with correct id, name, category, and valid param schema.
2. **No-crash test** (Tier 2): `apply()` with default params on a 200×200 canvas does not throw.
3. **Functional test** (Tier 2 or Tier 4): Deterministic assertion on output dimensions or pixel values, or golden image comparison.

**Shared setup** (Tier 2 tests):
```js
// In beforeEach:
const canvas = createCanvas(200, 200); // using @napi-rs/canvas
const ctx = canvas.getContext('2d');
ctx.fillStyle = '#3399ff';
ctx.fillRect(0, 0, 200, 200); // blue fill — gives us a known baseline
```

---

## TR-GEO-001 — geo-resize: Registration
- **Tier**: 1 (Unit)
- **Title**: `geo-resize` is registered with correct metadata
- **Steps**:
  1. Import `registry` from `src/engine/registry.js`
  2. Import `src/engine/transforms/geometry.js` (side-effect import to trigger registration)
  3. Call `registry.get("geo-resize")`
- **Expected Result**: Non-null; `name === "Resize"`, `category === "Geometric & Framing"`, params include `width`, `height`, `maintainAspect`, `algo`

## TR-GEO-002 — geo-resize: Pixel dimensions (absolute)
- **Tier**: 2 (Integration)
- **Title**: `geo-resize` with absolute px values produces exactly that output size
- **Test Data**: 200×200 canvas; params `{ width: "400", height: "300", maintainAspect: false }`
- **Steps**:
  1. Apply `geo-resize` with above params
  2. Assert `canvas.width` and `canvas.height`
- **Expected Result**: `canvas.width === 400`, `canvas.height === 300`

## TR-GEO-003 — geo-resize: Percentage dimensions
- **Tier**: 2
- **Title**: `geo-resize` with 50% width halves the canvas
- **Test Data**: 200×200 canvas; params `{ width: "50%", height: "", maintainAspect: true }`
- **Steps**:
  1. Apply transform
- **Expected Result**: `canvas.width === 100`, `canvas.height === 100` (aspect maintained)

## TR-GEO-004 — geo-resize: No-crash with default params
- **Tier**: 2
- **Steps**: Apply with `{ width: "100%", height: "", maintainAspect: true, algo: "Lanczos" }`
- **Expected Result**: No error thrown; canvas dimensions unchanged (100% resize = identity)

---

## TR-GEO-005 — geo-crop: Registration
- **Tier**: 1
- **Steps**: `registry.get("geo-crop")`
- **Expected Result**: Non-null; params include `aspectRatio`, `anchor`

## TR-GEO-006 — geo-crop: 1:1 crop of landscape produces square
- **Tier**: 2
- **Test Data**: 400×200 canvas; params `{ aspectRatio: "1:1", anchor: "center" }`
- **Steps**: Apply crop
- **Expected Result**: `canvas.width === canvas.height === 200`

## TR-GEO-007 — geo-crop: 16:9 crop of a tall image
- **Tier**: 2
- **Test Data**: 200×400 canvas; params `{ aspectRatio: "16:9", anchor: "center" }`
- **Expected Result**: `canvas.width / canvas.height` ≈ 1.778 (±0.01)

## TR-GEO-008 — geo-crop: Output dimensions never exceed input dimensions
- **Tier**: 2
- **Test Data**: 100×100 canvas; params `{ aspectRatio: "16:9", anchor: "center" }`
- **Expected Result**: `canvas.width <= 100` and `canvas.height <= 100`

---

## TR-GEO-009 — geo-smart-crop: Registration
- **Tier**: 1
- **Steps**: `registry.get("geo-smart-crop")`
- **Expected Result**: Non-null; has `aspectRatio`, `anchor`, `subjectPadding` params

## TR-GEO-010 — geo-smart-crop: No-crash with default params (no vision cache)
- **Tier**: 2
- **Description**: Smart crop falls back to centre-crop when no subject bounding box is cached.
- **Test Data**: 400×300 canvas (no cached vision metadata); params `{ aspectRatio: "1:1", anchor: "center" }`
- **Expected Result**: No error thrown; canvas is square

---

## TR-GEO-011 — geo-rotate: Registration
- **Tier**: 1
- **Steps**: `registry.get("geo-rotate")`
- **Expected Result**: Params include `rotation`, `flipH`, `flipV`

## TR-GEO-012 — geo-rotate: 90° clockwise swaps dimensions
- **Tier**: 2
- **Test Data**: 400×200 canvas; params `{ rotation: 90, flipH: false, flipV: false }`
- **Expected Result**: `canvas.width === 200`, `canvas.height === 400`

## TR-GEO-013 — geo-rotate: 180° preserves dimensions
- **Tier**: 2
- **Test Data**: 200×100 canvas; params `{ rotation: 180 }`
- **Expected Result**: `canvas.width === 200`, `canvas.height === 100`

## TR-GEO-014 — geo-rotate: Horizontal flip — pixel at left edge mirrors to right edge
- **Tier**: 2
- **Test Data**: 100×100 canvas; left half red (#FF0000), right half blue (#0000FF); params `{ rotation: 0, flipH: true }`
- **Steps**:
  1. Apply flip
  2. Sample pixel at (10, 50) and (90, 50)
- **Expected Result**: pixel at (10,50) is blue; pixel at (90,50) is red

## TR-GEO-015 — geo-rotate: Golden image — 90° rotation of test image
- **Tier**: 4 (Golden Image)
- **Input**: TD-IMG-002 (`landscape-no-exif.jpg`, 1920×1080)
- **Params**: `{ rotation: 90 }`
- **Reference**: `TR-GEO-015-reference.png`
- **Expected Result**: Output 1080×1920; diff < 0.1%

---

## TR-GEO-016 — geo-round: Registration
- **Tier**: 1
- **Steps**: `registry.get("geo-round")`
- **Expected Result**: Params include `radius`

## TR-GEO-017 — geo-round: Corners are transparent after rounding
- **Tier**: 2
- **Test Data**: 100×100 solid blue canvas; params `{ radius: 50 }` (full circle)
- **Steps**:
  1. Apply round corners
  2. Sample corner pixel at (1, 1)
- **Expected Result**: Corner pixel alpha = 0 (transparent)

## TR-GEO-018 — geo-round: Centre pixel remains opaque
- **Tier**: 2 (same setup as TR-GEO-017)
- **Steps**: Sample pixel at (50, 50)
- **Expected Result**: Alpha = 255 (fully opaque)

---

## TR-GEO-019 — geo-padding: Registration
- **Tier**: 1
- **Steps**: `registry.get("geo-padding")`
- **Expected Result**: Params include `top`, `right`, `bottom`, `left`, `color`

## TR-GEO-020 — geo-padding: Output dimensions = input + padding amounts
- **Tier**: 2
- **Test Data**: 100×100 canvas; params `{ top: 10, right: 20, bottom: 30, left: 40, color: "#ffffff" }`
- **Steps**: Apply padding
- **Expected Result**: `canvas.width === 160` (100+40+20), `canvas.height === 140` (100+10+30)

## TR-GEO-021 — geo-padding: Padding area fills with the specified colour
- **Tier**: 2 (same setup)
- **Steps**: Sample pixel at (5, 5) (top-left padding area)
- **Expected Result**: Pixel is white (255, 255, 255, 255)

---

## TR-GEO-022 — geo-trim: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include `threshold` or `color`

## TR-GEO-023 — geo-trim: No-crash with solid-colour canvas
- **Tier**: 2
- **Test Data**: 200×200 solid white canvas; params `{ threshold: 10 }`
- **Expected Result**: No crash; canvas may be very small (all trimmed) or unchanged

---

## TR-GEO-024 — geo-pixelate: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include `blockSize`

## TR-GEO-025 — geo-pixelate: Block size of 10 produces uniform 10×10 pixel blocks
- **Tier**: 2
- **Test Data**: 100×100 gradient canvas; params `{ blockSize: 10 }`
- **Steps**:
  1. Apply pixelate
  2. Sample pixels at (0,0) and (9,9) (same block)
- **Expected Result**: Both pixels have identical RGBA values

## TR-GEO-026 — geo-pixelate: No-crash with default params
- **Tier**: 2
- **Expected Result**: No error

---

## TR-GEO-027 — geo-lens: Registration
- **Tier**: 1
- **Expected Result**: Registered with `distortion` param

## TR-GEO-028 — geo-lens: No-crash with 0 distortion (identity)
- **Tier**: 2
- **Test Data**: params `{ distortion: 0 }`
- **Expected Result**: No error; canvas visually identical to input

---

## TR-GEO-029 — geo-magnify: Registration + no-crash
- **Tier**: 1 + 2
- **Expected Result**: Registered; apply with default params does not throw

## TR-GEO-030 — geo-turbulent-displace: Registration + no-crash
- **Tier**: 1 + 2
- **Expected Result**: Registered; apply does not throw; canvas dimensions unchanged

## TR-GEO-031 — geo-liquify: Registration + no-crash
- **Tier**: 1 + 2
- **Expected Result**: Registered; apply does not throw

---

## TR-GEO-032 — gen-checkerboard: Output has alternating colour blocks
- **Tier**: 2
- **Test Data**: 200×200 blank canvas; params `{ color1: "#000000", color2: "#ffffff", size: 10 }`
- **Steps**:
  1. Apply checkerboard
  2. Sample pixel at (5,5) — first block
  3. Sample pixel at (15,5) — second block
- **Expected Result**: One pixel is black, the other is white (or vice versa)

## TR-GEO-033 — gen-circle: Canvas has transparent corners
- **Tier**: 2
- **Test Data**: 100×100 canvas; params (default)
- **Steps**: After applying, sample corner pixel
- **Expected Result**: Corner alpha = 0

## TR-GEO-034 — gen-rect: Registration + fills canvas with a coloured rectangle
- **Tier**: 1 + 2
- **Test Data**: params `{ color: "#ff0000", x: 0, y: 0, width: "100%", height: "100%" }`
- **Expected Result**: All pixels red

## TR-GEO-035 — gen-ellipse: Registration + no-crash
- **Tier**: 1 + 2

## TR-GEO-036 — gen-path: Registration + no-crash with default params
- **Tier**: 1 + 2
- **Expected Result**: Registered; apply does not throw

## TR-GEO-037 — geo-face-crop: Registration (AI — requires MediaPipe)
- **Tier**: 1
- **Expected Result**: Registered; has `requires` array or face detection dependency documented

## TR-GEO-038 — geo-face-crop: No-crash when no face is detected
- **Tier**: 2
- **Test Data**: 200×200 solid colour canvas (no face); params default
- **Expected Result**: No throw; canvas returns unchanged or falls back to centre crop

## TR-GEO-039 — geo-body-crop: Registration + no-crash
- **Tier**: 1 + 2

## TR-GEO-040 — geo-face-align: Registration + no-crash
- **Tier**: 1 + 2

## TR-GEO-041 — ai-subject-crop: Registration (requires InSPyReNet model)
- **Tier**: 1
- **Expected Result**: Registered; `requires` array lists `inspyrenet-swinb-fp16`

## TR-GEO-042 — ai-subject-crop: No-crash when model not present
- **Tier**: 2
- **Dependencies**: Mock `getModelRecord` to return null (model absent)
- **Expected Result**: Transform skips gracefully or falls back — does not throw uncaught error
