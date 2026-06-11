# Transform Tests — Metadata

**Reference prefix**: `TR-META-`  
**Source file**: `src/engine/transforms/metadata.js`  
**Total transforms**: 6

---

## TR-META-001 — meta-strip: Registration
- **Tier**: 1
- **Steps**: `registry.get("meta-strip")`
- **Expected Result**: Registered; params include `level` (select: All / GPS Only / EXIF Only); `apply` does not modify the canvas

## TR-META-002 — meta-strip: Sets `context._stripMetadata` to the selected level
- **Tier**: 2
- **Test Data**: 100×100 canvas; node params `{ level: "GPS Only" }`
- **Steps**:
  1. Run processor with meta-strip node
  2. Inspect context after execution
- **Expected Result**: `context._stripMetadata === "GPS Only"`; canvas pixels unchanged

## TR-META-003 — meta-strip: Default level is "All"
- **Tier**: 2
- **Test Data**: params `{}` (all defaults)
- **Expected Result**: `context._stripMetadata === "All"`

---

## TR-META-004 — meta-set-exif: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include `field` (select: artist/copyright/comment/description/software) and `value` (text with variable support)

## TR-META-005 — meta-set-exif: Writes to `context._exifWrites` with correct field key
- **Tier**: 2
- **Test Data**: params `{ field: "copyright", value: "© Test 2024" }`
- **Steps**:
  1. Run processor with meta-set-exif node
  2. Inspect `context._exifWrites`
- **Expected Result**: `context._exifWrites.copyright === "© Test 2024"`

## TR-META-006 — meta-set-exif: Multiple nodes accumulate into `_exifWrites` (no overwrite of other fields)
- **Tier**: 2
- **Test Data**: Two meta-set-exif nodes: `{ field: "copyright", value: "A" }` and `{ field: "artist", value: "B" }`
- **Steps**: Run both nodes in sequence
- **Expected Result**: `context._exifWrites.copyright === "A"` AND `context._exifWrites.artist === "B"`

## TR-META-007 — meta-set-exif: `{{vars}}` in value is resolved before writing
- **Tier**: 2
- **Test Data**: params `{ field: "copyright", value: "© {{exif.author | \"Owner\"}}" }`, context `{ exif: { author: "Alice" } }`
- **Expected Result**: `context._exifWrites.copyright === "© Alice"`

## TR-META-008 — meta-set-exif: Canvas pixels are NOT modified by this transform
- **Tier**: 2
- **Test Data**: Record pixel values before and after apply
- **Expected Result**: All pixel values identical before and after

---

## TR-META-009 — meta-geocode: Registration
- **Tier**: 1
- **Expected Result**: Registered; may have `overwrite` or `format` params

## TR-META-010 — meta-geocode: Writes city/country to sidecar from GPS coords
- **Tier**: 2
- **Test Data**: Context with `exif.gps = { lat: 48.8566, lng: 2.3522 }` (Paris); Nominatim response mocked (TD-GEO-001)
- **Dependencies**: Mock `fetch` to return TD-GEO-001 nominatim response
- **Steps**:
  1. Run processor with meta-geocode node
  2. Check `context.sidecar.geo`
- **Expected Result**: `sidecar.geo.city === "Paris"`, `sidecar.geo.country === "France"`

## TR-META-011 — meta-geocode: No-crash when GPS is absent
- **Tier**: 2
- **Test Data**: Context with no `exif.gps`
- **Expected Result**: No crash; sidecar geo fields remain empty

---

## TR-META-012 — meta-dominant-color: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include `variable` (output variable name)

## TR-META-013 — meta-dominant-color: Sets a variable with the dominant colour hex value
- **Tier**: 2
- **Test Data**: 100×100 solid red canvas; params `{ variable: "dominantColor" }`
- **Steps**:
  1. Run processor
  2. Check `context.variables.get("dominantColor")`
- **Expected Result**: Returns `"#ff0000"` or a near-red hex value (dominant colour of solid red image)

## TR-META-014 — meta-dominant-color: Does not modify canvas pixels
- **Tier**: 2
- **Expected Result**: Pixels unchanged after apply

---

## TR-META-015 — meta-blur-detect: Registration
- **Tier**: 1
- **Expected Result**: Registered; params include output variable name for blur score and label

## TR-META-016 — meta-blur-detect: Blurry image produces a low sharpness score
- **Tier**: 2
- **Test Data**: A manually blurred (Gaussian blur applied first) 100×100 canvas
- **Steps**:
  1. Apply blur (e.g. `filter-blur` with radius=10) to make a blurry canvas
  2. Apply `meta-blur-detect`
  3. Check sharpness score variable
- **Expected Result**: Score is "low" or < threshold value

## TR-META-017 — meta-blur-detect: Sharp image produces a high sharpness score
- **Tier**: 2
- **Test Data**: High-contrast checkerboard canvas (maximum sharpness)
- **Expected Result**: Score is "high" or above threshold

---

## TR-META-018 — meta-sidecar-write: Registration
- **Tier**: 1
- **Expected Result**: Registered; writes sidecar data to the file system

## TR-META-019 — meta-sidecar-write: No-crash when no dirHandle is present in context
- **Tier**: 2
- **Test Data**: Context without `dirHandle` set
- **Expected Result**: No crash; graceful skip (cannot write without FSA handle)

## TR-META-020 — meta-sidecar-write: Writes computed fields back to sidecar
- **Tier**: 2
- **Dependencies**: Mock `writeSidecar` function to capture the written data
- **Test Data**: Context with `sidecar` object and mock dirHandle
- **Steps**:
  1. Run processor with meta-sidecar-write node
  2. Inspect captured write call
- **Expected Result**: `writeSidecar` called once with the correct filename and populated sidecar object
