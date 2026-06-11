# Transform Tests — Overlays & Typography

**Reference prefix**: `TR-OVL-`  
**Source file**: `src/engine/transforms/overlays.js`  
**Total transforms**: 18

---

## TR-OVL-001 — overlay-rich-text: Registration
- **Tier**: 1
- **Steps**: `registry.get("overlay-rich-text")`
- **Expected Result**: Registered; params include `text`, `x`, `y`, `fontSize`, `fontFamily`, `color`, `align`

## TR-OVL-002 — overlay-rich-text: No-crash with empty text
- **Tier**: 2
- **Test Data**: 200×200 canvas; params `{ text: "", x: "50%", y: "50%" }`
- **Expected Result**: No error thrown; canvas unchanged

## TR-OVL-003 — overlay-rich-text: Renders text onto canvas (pixels change)
- **Tier**: 2
- **Test Data**: 200×200 white canvas; params `{ text: "X", x: "50%", y: "50%", fontSize: 60, color: "#000000" }`
- **Steps**:
  1. Record canvas pixel hash before apply
  2. Apply transform
  3. Compare pixel values
- **Expected Result**: At least one pixel becomes darker than 200 (the letter X rendered in black)

## TR-OVL-004 — overlay-rich-text: Golden image — standard text placement
- **Tier**: 4
- **Input**: TD-IMG-002 (`landscape-no-exif.jpg`)
- **Params**: `{ text: "HELLO WORLD", x: "50%", y: "50%", fontSize: 48, color: "#ffffff", align: "center" }`
- **Reference**: `TR-OVL-004-reference.png`
- **Expected Result**: Diff < 0.5%

## TR-OVL-005 — overlay-rich-text: `{{filename}}` variable is resolved in text
- **Tier**: 2
- **Test Data**: params `{ text: "{{filename}}" }`, context `{ filename: "photo" }`
- **Steps**:
  1. Run processor with the text node and appropriate context
  2. Check a pixel in the text region changed
- **Expected Result**: No `{{filename}}` literal appears in rendered output (resolves to "photo")

---

## TR-OVL-006 — overlay-watermark: Registration
- **Tier**: 1
- **Expected Result**: Params include `image` (asset reference or URL), `opacity`, `position`, `scale`

## TR-OVL-007 — overlay-watermark: No-crash when no image asset provided
- **Tier**: 2
- **Test Data**: params with empty/null image reference
- **Expected Result**: No crash; canvas unchanged or placeholder rendered

## TR-OVL-008 — overlay-watermark: Opacity 0 produces no change to canvas
- **Tier**: 2
- **Test Data**: params `{ image: "logo.png", opacity: 0 }`
- **Expected Result**: Canvas pixels unchanged

---

## TR-OVL-009 — overlay-ribbon: Registration
- **Tier**: 1
- **Expected Result**: Params include `text`, `position` (corner/edge), `color`, `textColor`

## TR-OVL-010 — overlay-ribbon: No-crash with default params
- **Tier**: 2

## TR-OVL-011 — overlay-ribbon: Golden image — top-left red ribbon with white text
- **Tier**: 4
- **Input**: TD-IMG-002
- **Params**: `{ text: "NEW", position: "top-left", color: "#ff0000", textColor: "#ffffff" }`
- **Reference**: `TR-OVL-011-reference.png`
- **Expected Result**: Diff < 0.5%; red diagonal or banner visible in top-left area

---

## TR-OVL-012 — overlay-qrcode: Registration
- **Tier**: 1
- **Expected Result**: Params include `url` or `data`, `size`, `position`, `errorCorrection`

## TR-OVL-013 — overlay-qrcode: No-crash with valid URL
- **Tier**: 2
- **Test Data**: params `{ url: "https://example.com", size: 80, position: "bottom-right" }`
- **Expected Result**: No error; a region of the canvas in the bottom-right has changed (QR code rendered)

## TR-OVL-014 — overlay-qrcode: Generated QR is scannable
- **Tier**: 5 (Manual)
- **Steps**:
  1. Apply QR code overlay to a test image
  2. Export the result
  3. Scan the QR code with a mobile device
- **Expected Result**: QR code decodes to the original URL

---

## TR-OVL-015 — overlay-grid: Registration
- **Tier**: 1
- **Expected Result**: Params include `columns`, `rows`, `color`, `lineWidth`

## TR-OVL-016 — overlay-grid: No-crash with 2×2 grid
- **Tier**: 2
- **Test Data**: 100×100 canvas; params `{ columns: 2, rows: 2, color: "#ff0000", lineWidth: 1 }`
- **Expected Result**: No crash; red lines visible at midpoints

## TR-OVL-017 — overlay-grid: Grid lines appear at correct pixel positions
- **Tier**: 2
- **Test Data**: 100×100 white canvas; 2×2 grid with 1px red lines
- **Steps**: Sample pixel at (50, 0) (vertical midline) and (0, 50) (horizontal midline)
- **Expected Result**: Pixels at those coordinates are red

---

## TR-OVL-018 — overlay-map: Registration (requires network/tiles)
- **Tier**: 1
- **Expected Result**: Registered; params include `lat`, `lng`, `zoom`, `width`, `height`

## TR-OVL-019 — overlay-map: No-crash when tile fetch is mocked
- **Tier**: 2
- **Dependencies**: Mock `fetchRenderedMap` to return a blank canvas
- **Test Data**: params `{ lat: 51.5, lng: -0.1, zoom: 12 }`
- **Expected Result**: No crash; some content rendered (even if mock tiles)

---

## TR-OVL-020 — overlay-light-leak: Registration + no-crash
- **Tier**: 1 + 2
- **Expected Result**: Registered; apply does not throw; produces a warmer or tinted canvas

## TR-OVL-021 — overlay-canvas-texture: Registration + no-crash
- **Tier**: 1 + 2

## TR-OVL-022 — overlay-polaroid-frame: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include `caption`, `borderWidth`

## TR-OVL-023 — overlay-polaroid-frame: No-crash with default params
- **Tier**: 2

## TR-OVL-024 — overlay-polaroid-frame: Golden image — polaroid border
- **Tier**: 4
- **Input**: TD-IMG-003 (`square-red.png`)
- **Params**: default
- **Reference**: `TR-OVL-024-reference.png`
- **Expected Result**: Diff < 0.5%; white border visible on bottom edge (polaroid style)

---

## TR-OVL-025 — overlay-scanlines: Registration + no-crash
- **Tier**: 1 + 2

## TR-OVL-026 — overlay-scanlines: Dark horizontal stripes appear at regular intervals
- **Tier**: 2
- **Test Data**: 100×100 white canvas; default params
- **Steps**: Compare pixels at even vs odd rows
- **Expected Result**: Even rows lighter than odd rows (or vice versa) — alternating pattern

---

## TR-OVL-027 — overlay-template: Registration
- **Tier**: 1
- **Expected Result**: Params include `templateId` reference

## TR-OVL-028 — overlay-template: No-crash when template not found
- **Tier**: 2
- **Test Data**: params `{ templateId: "nonexistent-template" }`
- **Expected Result**: Graceful fallback; no unhandled error

---

## TR-OVL-029 — overlay-device-mockup: Registration
- **Tier**: 1
- **Expected Result**: Params include `device` (phone/tablet/laptop), `orientation`

## TR-OVL-030 — overlay-device-mockup: No-crash with default device
- **Tier**: 2

## TR-OVL-031 — overlay-device-mockup: Renders image inside device frame (golden image)
- **Tier**: 4
- **Input**: TD-IMG-002
- **Params**: `{ device: "phone", orientation: "portrait" }`
- **Reference**: `TR-OVL-031-reference.png`
- **Expected Result**: Diff < 1%

---

## TR-OVL-032 — overlay-timer: Registration (HTML-in-canvas)
- **Tier**: 1
- **Expected Result**: Registered; `requires` includes `html-in-canvas` capability

## TR-OVL-033 — overlay-timer: No-crash when html-in-canvas not available
- **Tier**: 2
- **Dependencies**: Mock `checkRequirement` to return false for `html-in-canvas`
- **Expected Result**: Graceful warning logged; canvas unchanged; no throw

---

## TR-OVL-034 — overlay-html-block: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include `html`, `css`

## TR-OVL-035 — overlay-html-block: No-crash when html-in-canvas not available
- **Tier**: 2
- **Expected Result**: Graceful fallback

---

## TR-OVL-036 — overlay-subtitles: Registration
- **Tier**: 1
- **Expected Result**: Params include `srtContent` or variable reference, `fontSize`, `position`

## TR-OVL-037 — overlay-subtitles: Parses SRT and renders at correct time position
- **Tier**: 2
- **Test Data**: SRT content from TD-SRT-001; context `{ currentTimeMs: 2000 }` (within first subtitle block 1s–4s)
- **Steps**:
  1. Apply overlay-subtitles with SRT content and t=2s
  2. Check that pixels changed in the subtitle region
- **Expected Result**: Subtitle text rendered on canvas at t=2s

## TR-OVL-038 — overlay-subtitles: No subtitle rendered before first cue
- **Tier**: 2
- **Test Data**: SRT content; context `{ currentTimeMs: 500 }` (before 1s start)
- **Expected Result**: Canvas unchanged (no text rendered yet)

---

## TR-OVL-039 — overlay-craquelure: Registration + no-crash
- **Tier**: 1 + 2

## TR-OVL-040 — overlay-draw-mask: Registration
- **Tier**: 1
- **Expected Result**: Params include brush strokes or mask data path

## TR-OVL-041 — overlay-draw-mask: No-crash with no mask data
- **Tier**: 2
- **Expected Result**: No crash; canvas unchanged
