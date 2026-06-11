# Tier 1 — Unit Tests: Sidecar Module

**Tool**: Vitest  
**File location**: `tests/unit/data/sidecar.test.js`, `tests/unit/data/sidecarMigrate.test.js`  
**Run command**: `npx vitest run tests/unit/data/`  
**Notes**: No FSA (File System Access) — read/write functions are tested with in-memory mock directory handles.

---

## sidecar.js — createEmptySidecar

### UT-045
- **Title**: `createEmptySidecar` — returns object with correct `$version`
- **Description**: Factory must always stamp the current schema version.
- **Steps**:
  1. Import `createEmptySidecar, CURRENT_SIDECAR_VERSION` from `src/data/sidecar.js`
  2. Call `createEmptySidecar()`
  3. Assert `.$version`
- **Expected Result**: `.$version === CURRENT_SIDECAR_VERSION` (currently 2)

### UT-046
- **Title**: `createEmptySidecar` — all required top-level sections present
- **Steps**:
  1. Call `createEmptySidecar()`
  2. Assert all section keys exist
- **Expected Result**: Object has keys: `$version`, `source`, `exif`, `geo`, `annotation`, `asset`, `computed`, `processing`

### UT-047
- **Title**: `createEmptySidecar` — `annotation.tags` is an empty array
- **Steps**:
  1. Call `createEmptySidecar()`
  2. Assert `annotation.tags`
- **Expected Result**: `annotation.tags` is `[]` (not null, not undefined)

### UT-048
- **Title**: `createEmptySidecar` — `processing` is an empty array
- **Steps**:
  1. Call `createEmptySidecar()`
- **Expected Result**: `processing` is `[]`

---

## sidecar.js — migrateSidecar

### UT-049
- **Title**: `migrateSidecar` — null input returns a fully-defaulted sidecar
- **Test Data**: `null`
- **Steps**:
  1. Call `migrateSidecar(null)`
- **Expected Result**: Returns a valid sidecar object equivalent to `createEmptySidecar()`, does not throw

### UT-050
- **Title**: `migrateSidecar` — non-object input (string) returns default sidecar
- **Test Data**: `"bad-input"`
- **Steps**:
  1. Call `migrateSidecar("bad-input")`
- **Expected Result**: Returns a valid default sidecar, does not throw

### UT-051
- **Title**: `migrateSidecar` — v1 sidecar gains `annotation.usageScenarios` field
- **Description**: v1 → v2 migration must add the new `usageScenarios` array.
- **Test Data**: TD-SC-001 (`sidecar-v1.json` content as parsed object)
- **Steps**:
  1. Parse the v1 fixture JSON
  2. Call `migrateSidecar(parsedV1)`
  3. Check `annotation.usageScenarios`
- **Expected Result**: `annotation.usageScenarios` is `[]`

### UT-052
- **Title**: `migrateSidecar` — v1 sidecar gains `asset.title` and `asset.contentRating`
- **Test Data**: TD-SC-001
- **Steps**:
  1. Parse v1 fixture, call `migrateSidecar`
  2. Check `asset.title` and `asset.contentRating`
- **Expected Result**: `asset.title === ""`, `asset.contentRating === "general"`

### UT-053
- **Title**: `migrateSidecar` — existing annotation values are preserved during migration
- **Description**: Migration must not overwrite user data that already exists.
- **Test Data**: v1 sidecar with `annotation.rating = 4`, `annotation.tags = ["travel"]`
- **Steps**:
  1. Parse v1 fixture, call `migrateSidecar`
  2. Assert `annotation.rating` and `annotation.tags`
- **Expected Result**: `rating` is still `4`, `tags` is still `["travel"]`

### UT-054
- **Title**: `migrateSidecar` — unknown top-level keys are preserved (no data loss)
- **Description**: If a sidecar has custom keys we don't know about, we must round-trip them.
- **Test Data**: `{ $version: 2, ...validFields..., customKey: "keep-me" }`
- **Steps**:
  1. Call `migrateSidecar` with object containing `customKey`
  2. Assert `customKey` in result
- **Expected Result**: `result.customKey === "keep-me"`

### UT-055
- **Title**: `migrateSidecar` — is idempotent (safe to run twice)
- **Test Data**: TD-SC-002 (already v2)
- **Steps**:
  1. Call `migrateSidecar(v2Data)` twice, chaining the result
  2. Deep-compare first and second result
- **Expected Result**: Both results are deeply equal

### UT-056
- **Title**: `migrateSidecar` — `$version` is stamped to current version on output
- **Test Data**: v1 sidecar (TD-SC-001)
- **Steps**:
  1. Call `migrateSidecar(v1Data)`
  2. Assert `.$version`
- **Expected Result**: `.$version === 2`

---

## sidecar.js — flattenSidecarVars

### UT-057
- **Title**: `flattenSidecarVars` — city field available as `sidecar.geo.city`
- **Test Data**: `{ geo: { city: "Tokyo", country: "Japan" } }`
- **Steps**:
  1. Call `flattenSidecarVars` with above sidecar object
  2. Check `vars.get("sidecar.geo.city")`
- **Expected Result**: Returns `"Tokyo"`

### UT-058
- **Title**: `flattenSidecarVars` — tags array is joined with comma-space
- **Test Data**: `{ annotation: { tags: ["nature", "wildlife"] } }`
- **Steps**:
  1. Call `flattenSidecarVars`
  2. Check `vars.get("sidecar.annotation.tags")`
- **Expected Result**: Returns `"nature, wildlife"`

### UT-059
- **Title**: `flattenSidecarVars` — null or undefined values are omitted from the map
- **Test Data**: `{ exif: { cameraMake: null, cameraModel: "EOS 90D" } }`
- **Steps**:
  1. Call `flattenSidecarVars`
  2. Check `vars.has("sidecar.exif.cameraMake")` and `vars.has("sidecar.exif.cameraModel")`
- **Expected Result**: `cameraMake` key is absent from map; `cameraModel` is present with value `"EOS 90D"`

### UT-060
- **Title**: `flattenSidecarVars` — `$version` meta field is skipped
- **Test Data**: A full sidecar with `$version: 2`
- **Steps**:
  1. Call `flattenSidecarVars`
  2. Check whether any key contains `$version`
- **Expected Result**: No key containing `$version` in the Map

### UT-061
- **Title**: `flattenSidecarVars` — null/non-object input returns empty Map
- **Test Data**: `null`
- **Steps**:
  1. Call `flattenSidecarVars(null)`
- **Expected Result**: Returns a Map of size 0, does not throw

---

## sidecar.js — buildSidecarPatch

### UT-062
- **Title**: `buildSidecarPatch` — formValues override existing geo fields
- **Test Data**: existing=sidecar with `geo.city="London"`, formValues=`{ city: "Paris" }`
- **Steps**:
  1. Call `buildSidecarPatch(existing, { city: "Paris" })`
  2. Assert `result.geo.city`
- **Expected Result**: `result.geo.city === "Paris"`

### UT-063
- **Title**: `buildSidecarPatch` — missing formValues fall back to existing sidecar values
- **Test Data**: existing sidecar with `annotation.rating=5`, formValues=`{}`
- **Steps**:
  1. Call `buildSidecarPatch(existing, {})`
  2. Assert `result.annotation.rating`
- **Expected Result**: `result.annotation.rating === 5`

### UT-064
- **Title**: `buildSidecarPatch` — null existing sidecar is handled gracefully
- **Test Data**: existing=`null`, formValues=`{ rating: 3 }`
- **Steps**:
  1. Call `buildSidecarPatch(null, { rating: 3 })`
- **Expected Result**: Does not throw; `annotation.rating === 3`

---

## sidecarMigrate.js — migrateSidecarFiles

### UT-065
- **Title**: `migrateSidecarFiles` — renames `photo.jpg.json` to `.photo.jpg.json`
- **Description**: The migration function must rename legacy suffix sidecars to dot-prefix format.
- **Test Data**: Mock directory handle containing `photo.jpg.json` (and no `.photo.jpg.json`)
- **Dependencies**: A mock `FileSystemDirectoryHandle` that tracks reads/writes/deletions in memory
- **Steps**:
  1. Build a mock dirHandle with `photo.jpg.json` present
  2. Call `migrateSidecarFiles(mockDirHandle)`
  3. Assert result and mock state
- **Expected Result**: `renamed` array contains `"photo.jpg.json → .photo.jpg.json"`. New file `.photo.jpg.json` present. Old `photo.jpg.json` deleted.

### UT-066
- **Title**: `migrateSidecarFiles` — skips if dot-prefix version already exists
- **Test Data**: Mock dir with both `photo.jpg.json` and `.photo.jpg.json` present
- **Steps**:
  1. Call `migrateSidecarFiles`
- **Expected Result**: `skipped` contains `"photo.jpg.json"`, `renamed` is empty, no file deleted

### UT-067
- **Title**: `migrateSidecarFiles` — does not rename plain `config.json` (no media extension in base)
- **Description**: Files like `config.json` should be untouched — the base `"config"` has no inner extension.
- **Test Data**: Mock dir containing only `config.json`
- **Steps**:
  1. Call `migrateSidecarFiles`
- **Expected Result**: `renamed`, `skipped`, `errors` all empty

### UT-068
- **Title**: `migrateSidecarFiles` — null dirHandle returns empty result without throwing
- **Test Data**: `null`
- **Steps**:
  1. Call `migrateSidecarFiles(null)`
- **Expected Result**: Returns `{ renamed: [], skipped: [], errors: [] }`

### UT-069
- **Title**: `migrateSidecarFiles` — handles multiple files in one pass
- **Test Data**: Mock dir with `a.jpg.json`, `b.png.json`, and `.c.mp4.json` (already migrated)
- **Steps**:
  1. Call `migrateSidecarFiles`
- **Expected Result**: `a.jpg.json` and `b.png.json` renamed; `.c.mp4.json` unchanged (no double-prefix)

---

## sidecar.js — sidecarName / roundtrip naming

### UT-070
- **Title**: Sidecar filename for `photo.jpg` is `.photo.jpg.json`
- **Description**: The naming convention must be precisely verified — this is the integration point with the file browser.
- **Steps**:
  1. Access internal `sidecarName` function (export it for testing or test via readSidecar with a mock)
  2. Pass `"photo.jpg"`
- **Expected Result**: Returns `".photo.jpg.json"`

### UT-071
- **Title**: `SIDECAR_SCHEMA_KEYS` — contains all known dotted paths required by the variable picker
- **Description**: Spot-check that the key list includes core paths used by other modules.
- **Steps**:
  1. Import `SIDECAR_SCHEMA_KEYS` from `src/data/sidecar.js`
  2. Assert presence of specific required keys
- **Expected Result**: Array includes: `"sidecar.annotation.rating"`, `"sidecar.geo.city"`, `"sidecar.exif.cameraMake"`, `"sidecar.source.filename"`

### UT-072
- **Title**: `SIDECAR_SCHEMA_GROUPS` — every key in groups also appears in `SIDECAR_SCHEMA_KEYS`
- **Description**: Consistency check — groups power the UI; keys power autocomplete. They must agree.
- **Steps**:
  1. Import both exports
  2. Flatten all group keys
  3. Assert each is in SIDECAR_SCHEMA_KEYS
- **Expected Result**: Every grouped key is present in the flat key list
