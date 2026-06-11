# Transform Tests — Color & Tone

**Reference prefix**: `TR-CLR-`  
**Source file**: `src/engine/transforms/color.js`  
**Total transforms**: 29

## Shared setup

```js
// Tier 2 tests — 100×100 canvas
const canvas = createCanvas(100, 100);
const ctx = canvas.getContext('2d');
// Fill with known solid colour for deterministic assertions
ctx.fillStyle = '#808080';
ctx.fillRect(0, 0, 100, 100); // mid-grey baseline
```

> **WASM Note**: The Photon WASM library must be mocked for unit/integration tests. 
> Provide a stub that returns a copy of the input ImageData unchanged, so registration 
> and no-crash tests pass without loading the real WASM binary.
> Actual pixel-level accuracy tests run only in Tier 4 (golden image) using a real browser.

---

## TR-CLR-001 — color-tuning: Registration
- **Tier**: 1
- **Steps**: `registry.get("color-tuning")`
- **Expected Result**: Non-null; params include `contrast` (range, -100 to 100), `saturation` (range), `vibrance` (range), `invert` (boolean)

## TR-CLR-002 — color-tuning: Invert on pure red produces pure cyan (pixel-level)
- **Tier**: 4 (Golden Image — requires real WASM)
- **Input**: TD-IMG-003 (`square-red.png` — 100×100 solid #FF0000)
- **Params**: `{ contrast: 0, saturation: 0, vibrance: 0, invert: true }`
- **Steps**:
  1. Apply in real browser
  2. Sample centre pixel
- **Expected Result**: Centre pixel = (0, 255, 255, 255) — cyan

## TR-CLR-003 — color-tuning: Default params (all zero, no invert) are identity
- **Tier**: 4
- **Input**: TD-IMG-003
- **Params**: `{ contrast: 0, saturation: 0, vibrance: 0, invert: false }`
- **Expected Result**: Diff vs input < 0.05% (WASM may have rounding; very tight tolerance)

## TR-CLR-004 — color-tuning: No-crash with default params
- **Tier**: 2
- **Expected Result**: No error thrown

---

## TR-CLR-005 — color-opacity: Registration
- **Tier**: 1
- **Expected Result**: Registered; single param `opacity` (range 0–100, default 100)

## TR-CLR-006 — color-opacity: 0% opacity sets all pixels to fully transparent
- **Tier**: 2
- **Test Data**: 100×100 solid blue canvas; params `{ opacity: 0 }`
- **Steps**:
  1. Apply opacity transform
  2. Sample any pixel alpha channel
- **Expected Result**: All pixels have alpha = 0

## TR-CLR-007 — color-opacity: 50% opacity halves all alpha values
- **Tier**: 2
- **Test Data**: 100×100 fully opaque (alpha=255) canvas; params `{ opacity: 50 }`
- **Steps**:
  1. Apply opacity
  2. Sample centre pixel alpha
- **Expected Result**: Alpha ≈ 127 (±1 rounding)

## TR-CLR-008 — color-opacity: 100% opacity is identity (alpha unchanged)
- **Tier**: 2
- **Test Data**: 100×100 opaque canvas; params `{ opacity: 100 }`
- **Expected Result**: All pixels retain alpha = 255

---

## TR-CLR-009 — color-tint: Registration
- **Tier**: 1
- **Expected Result**: Params include `color`, `strength`, `blendMode`

## TR-CLR-010 — color-tint: Strength 0 is identity (no change)
- **Tier**: 2
- **Test Data**: 100×100 grey canvas; params `{ color: "#ff0000", strength: 0, blendMode: "source-over" }`
- **Steps**:
  1. Sample pixel before and after apply
- **Expected Result**: Pixel values identical before and after

## TR-CLR-011 — color-tint: No-crash with default params
- **Tier**: 2
- **Expected Result**: No error

## TR-CLR-012 — color-tint: Golden image — 100% red tint over grey image
- **Tier**: 4
- **Input**: TD-IMG-004 (`square-grey.png`)
- **Params**: `{ color: "#ff0000", strength: 100, blendMode: "source-over" }`
- **Reference**: `TR-CLR-012-reference.png`
- **Expected Result**: Diff < 0.5%

---

## TR-CLR-013 — color-duotone: Registration
- **Tier**: 1
- **Expected Result**: Params include `shadowColor`, `highlightColor`

## TR-CLR-014 — color-duotone: No-crash with default params
- **Tier**: 2

## TR-CLR-015 — color-duotone: Output is two-tone (only shadow and highlight colours present)
- **Tier**: 4 (Golden Image)
- **Input**: TD-IMG-004
- **Params**: `{ shadowColor: "#000000", highlightColor: "#ffffff" }` (greyscale duotone)
- **Reference**: `TR-CLR-015-reference.png`
- **Expected Result**: All output pixels are on a gradient between black and white; diff < 0.5%

---

## TR-CLR-016 — color-vignette: Registration
- **Tier**: 1
- **Expected Result**: Params include `strength`, `color`, `feather`

## TR-CLR-017 — color-vignette: Corners are darker than centre
- **Tier**: 2 (pixel-level)
- **Test Data**: 200×200 solid white canvas; params `{ strength: 80, color: "#000000" }`
- **Steps**:
  1. Apply vignette
  2. Compare corner pixel brightness vs centre pixel brightness
- **Expected Result**: Corner luminance < centre luminance

## TR-CLR-018 — color-vignette: No-crash with default params
- **Tier**: 2

---

## TR-CLR-019 — filter-blur: Registration
- **Tier**: 1
- **Expected Result**: Params include `radius`

## TR-CLR-020 — filter-blur: radius=0 is identity
- **Tier**: 2
- **Test Data**: Sharp edge (left half black, right half white); params `{ radius: 0 }`
- **Expected Result**: Edge pixel (x=50, y=50) is either 0 or 255 (sharp boundary preserved)

## TR-CLR-021 — filter-blur: Large radius softens a sharp edge
- **Tier**: 2
- **Test Data**: Same sharp edge; params `{ radius: 10 }`
- **Steps**: Sample pixel at the edge boundary
- **Expected Result**: Edge pixel is between 10 and 245 (blended — neither pure black nor pure white)

## TR-CLR-022 — filter-blur: No-crash with default params
- **Tier**: 2

---

## TR-CLR-023 — color-levels: Registration
- **Tier**: 1
- **Expected Result**: Params include `inputBlack`, `inputWhite`, `gamma`, `outputBlack`, `outputWhite`

## TR-CLR-024 — color-levels: No-crash with default params
- **Tier**: 2

## TR-CLR-025 — color-levels: Golden image — clamp blacks (inputBlack=100)
- **Tier**: 4
- **Input**: TD-IMG-002
- **Params**: `{ inputBlack: 100, inputWhite: 255, gamma: 1.0, outputBlack: 0, outputWhite: 255 }`
- **Reference**: `TR-CLR-025-reference.png`
- **Expected Result**: Diff < 0.5%

---

## TR-CLR-026 — color-curves: Registration
- **Tier**: 1
- **Expected Result**: Params for RGB/individual channel curves

## TR-CLR-027 — color-curves: No-crash with default (linear) curve
- **Tier**: 2

---

## TR-CLR-028 — color-hsl: Registration
- **Tier**: 1
- **Expected Result**: Params include per-colour hue/saturation/luminance sliders

## TR-CLR-029 — color-hsl: No-crash with all-zero params
- **Tier**: 2

## TR-CLR-030 — color-hsl: Golden image — desaturate reds
- **Tier**: 4
- **Input**: TD-IMG-001 (`portrait-with-gps.jpg`)
- **Params**: `{ redSaturation: -100 }` (desaturate only red channel)
- **Reference**: `TR-CLR-030-reference.png`
- **Expected Result**: Diff < 1%

---

## TR-CLR-031 — color-auto-levels: Registration + no-crash
- **Tier**: 1 + 2
- **Description**: Auto levels has no user params — applies automatically.
- **Expected Result**: Registered; apply does not throw

---

## TR-CLR-032 — color-posterize: Registration
- **Tier**: 1
- **Expected Result**: Params include `levels`

## TR-CLR-033 — color-posterize: Levels=2 produces only 2 distinct tones
- **Tier**: 2
- **Test Data**: Gradient canvas (0 to 255 grayscale); params `{ levels: 2 }`
- **Steps**:
  1. Apply posterize
  2. Collect unique red-channel values from all pixels
- **Expected Result**: Only 2 distinct red-channel values exist (e.g. 0 and 255)

---

## TR-CLR-034 — filter-advanced: Registration + no-crash
- **Tier**: 1 + 2
- **Expected Result**: Registered; no crash with default preset

## TR-CLR-035 — filter-edge-detect: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-036 — filter-edge-detect: Plain solid-colour canvas produces near-black output
- **Tier**: 2
- **Test Data**: 100×100 solid red canvas
- **Expected Result**: After edge detection, all pixels near-black (no edges in a solid fill)

## TR-CLR-037 — filter-relight: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-038 — filter-halftone: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-039 — filter-directional-blur: Registration
- **Tier**: 1
- **Expected Result**: Params include `angle`, `radius`

## TR-CLR-040 — filter-directional-blur: No-crash with default params
- **Tier**: 2

## TR-CLR-041 — filter-radial-blur: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-042 — filter-gradient-ramp: Registration
- **Tier**: 1
- **Expected Result**: Params include `color1`, `color2`, `angle`

## TR-CLR-043 — filter-gradient-ramp: Fills canvas with gradient from corner to corner
- **Tier**: 2
- **Test Data**: 100×100 blank canvas; params `{ color1: "#000000", color2: "#ffffff", angle: 0 }`
- **Steps**: Sample top-left (0,0) and bottom-right (99,99)
- **Expected Result**: One pixel near-black, the other near-white

## TR-CLR-044 — filter-bloom: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-045 — filter-chromatic-aberration: Registration
- **Tier**: 1
- **Expected Result**: Params include `offsetX` or `strength`

## TR-CLR-046 — filter-chromatic-aberration: No-crash with offset=0
- **Tier**: 2
- **Test Data**: params `{ strength: 0 }`
- **Expected Result**: No crash; canvas visually unchanged

## TR-CLR-047 — filter-color-grade: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-048 — filter-kuwahara: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-049 — filter-tilt-shift: Registration
- **Tier**: 1
- **Expected Result**: Params include `focusY`, `blurRadius`, `gradientSize`

## TR-CLR-050 — filter-tilt-shift: No-crash with default params
- **Tier**: 2

## TR-CLR-051 — color-channel-swap: Registration
- **Tier**: 1
- **Expected Result**: Params define channel mapping (R→, G→, B→)

## TR-CLR-052 — color-channel-swap: Swap R↔B produces correct pixel values
- **Tier**: 2
- **Test Data**: 10×10 solid (255, 0, 0, 255) red canvas; params `{ redTo: "blue", blueTo: "red" }`
- **Steps**: Apply; sample centre pixel
- **Expected Result**: Pixel is (0, 0, 255, 255) — pure blue

## TR-CLR-053 — filter-pixel-sort: Registration + no-crash
- **Tier**: 1 + 2

## TR-CLR-054 — filter-dither: Registration
- **Tier**: 1
- **Expected Result**: Params include `palette` or `pattern`

## TR-CLR-055 — filter-dither: No-crash with default params
- **Tier**: 2

## TR-CLR-056 — ai-selective-grade: Registration (AI — requires vision model)
- **Tier**: 1
- **Expected Result**: Registered; `requires` array is present

## TR-CLR-057 — ai-selective-grade: No-crash when model absent
- **Tier**: 2
- **Mock**: `getModelRecord` returns null
- **Expected Result**: Graceful skip, no uncaught error

## TR-CLR-058 — color-lumetri: Registration
- **Tier**: 1
- **Expected Result**: Params include shadows, midtones, highlights, saturation, temperature, tint

## TR-CLR-059 — color-lumetri: No-crash with default (neutral) params
- **Tier**: 2

## TR-CLR-060 — color-lumetri: Golden image — warm look applied to test image
- **Tier**: 4
- **Input**: TD-IMG-002
- **Params**: `{ temperature: 30, tint: 0, saturation: 10 }`
- **Reference**: `TR-CLR-060-reference.png`
- **Expected Result**: Diff < 1%

## TR-CLR-061 — filter-rain: Registration + no-crash
- **Tier**: 1 + 2
- **Description**: Rain on lens effect — applies animated droplets; static apply should not crash
