# Tier 1 — Unit Tests: Engine Core

**Tool**: Vitest  
**File location**: `tests/unit/engine/`  
**Run command**: `npx vitest run tests/unit/engine/`  
**Notes**: Engine tests mock WASM, MediaPipe, and worker dependencies. No actual image processing runs here — that is covered by Tier 4 golden image tests.

---

## engine/registry.js

### UT-073
- **Title**: `Registry.register` — stores a transform definition retrievable by id
- **Steps**:
  1. Import `Registry` class (or instantiate a fresh one for isolation)
  2. Call `registry.register({ id: "test-transform", name: "Test", params: [], apply: () => {} })`
  3. Call `registry.get("test-transform")`
- **Expected Result**: Returns the registered definition object

### UT-074
- **Title**: `Registry.get` — returns null for unknown id
- **Steps**:
  1. Call `registry.get("nonexistent-id")`
- **Expected Result**: Returns `null`

### UT-075
- **Title**: `Registry.getAll` — returns all registered transforms as an array
- **Steps**:
  1. Register 3 transforms
  2. Call `registry.getAll()`
- **Expected Result**: Array length ≥ 3, containing the registered defs

### UT-076
- **Title**: `Registry.getGrouped` — groups transforms by category
- **Steps**:
  1. Register 2 transforms in category "Color & Tone", 1 in "Geometric"
  2. Call `registry.getGrouped()`
- **Expected Result**: Returns object with `"Color & Tone"` key containing 2 items, `"Geometric"` containing 1 item

### UT-077
- **Title**: `Registry.register` — logs warning on overwrite (does not throw)
- **Steps**:
  1. Register a transform with id `"dup"`
  2. Register again with the same id
- **Expected Result**: No error thrown; `registry.get("dup")` returns the second (latest) registration

---

## engine/capabilities.js

### UT-078
- **Title**: `checkRequirement` — `model` type returns false when model record is absent
- **Description**: When `getModelRecord` returns null, the model requirement is not met.
- **Test Data**: Requirement `{ type: "model", id: "whisper-tiny-en", label: "Whisper", actionHref: "#mdl" }`
- **Dependencies**: Mock `src/data/models.js` → `getModelRecord` returns `null`
- **Steps**:
  1. Mock `getModelRecord` to return `null`
  2. Call `checkRequirement(req)`
- **Expected Result**: `{ met: false, req: ... }`

### UT-079
- **Title**: `checkRequirement` — `model` type returns true when model has bytes
- **Dependencies**: Mock `getModelRecord` to return `{ id: "whisper-tiny-en", bytes: new ArrayBuffer(100) }`
- **Steps**:
  1. Mock `getModelRecord` to return record with `bytes`
  2. Call `checkRequirement({ type: "model", id: "whisper-tiny-en" })`
- **Expected Result**: `{ met: true, req: ... }`

### UT-080
- **Title**: `checkRequirement` — `flag` type always returns false (cannot auto-detect)
- **Test Data**: `{ type: "flag", id: "some-flag" }`
- **Steps**:
  1. Call `checkRequirement({ type: "flag", id: "some-flag" })`
- **Expected Result**: `{ met: false }`

### UT-081
- **Title**: `checkRequirement` — unknown type returns false gracefully
- **Test Data**: `{ type: "unknown-type", id: "x" }`
- **Steps**:
  1. Call `checkRequirement({ type: "unknown-type", id: "x" })`
- **Expected Result**: `{ met: false }` — does not throw

### UT-082
- **Title**: `checkRequirement` — result is cached on second call
- **Description**: The second call with the same key must not invoke the resolver again.
- **Dependencies**: A resolver mock that counts invocations
- **Steps**:
  1. Call `checkRequirement` twice with same req
  2. Assert resolver call count
- **Expected Result**: Resolver called exactly once

### UT-083
- **Title**: `invalidate` — clears cache for specific requirement
- **Dependencies**: Pre-populate cache by calling `checkRequirement`; then mock the resolver to return the opposite value
- **Steps**:
  1. Call `checkRequirement({ type: "model", id: "m1" })` → caches `false`
  2. Mock resolver to return `true`
  3. Call `invalidate("model", "m1")`
  4. Call `checkRequirement` again
- **Expected Result**: Second call returns `true` (cache was cleared)

### UT-084
- **Title**: `checkTransformAvailability` — available when transform has no `requires`
- **Dependencies**: Register a transform with no `requires` array
- **Steps**:
  1. Call `checkTransformAvailability("transform-no-reqs")`
- **Expected Result**: `{ available: true, unmet: [] }`

### UT-085
- **Title**: `checkTransformAvailability` — unavailable when required model is missing
- **Test Data**: Transform registered with `requires: [{ type: "model", id: "test-model" }]`; model not present
- **Steps**:
  1. Register transform with model requirement
  2. Mock `getModelRecord` to return null
  3. Call `checkTransformAvailability`
- **Expected Result**: `{ available: false, unmet: [{ type: "model", id: "test-model" }] }`

### UT-086
- **Title**: `checkRecipeAvailability` — null recipe returns available
- **Steps**:
  1. Call `checkRecipeAvailability(null)`
- **Expected Result**: `{ available: true, unmet: [] }`

### UT-087
- **Title**: `checkRecipeAvailability` — deduplicates same unmet requirement across multiple nodes
- **Description**: If two nodes both require the same model, it should appear in `unmet` only once.
- **Test Data**: Recipe with 2 nodes both requiring `whisper-tiny-en`, model not present
- **Steps**:
  1. Build recipe with two transcription nodes
  2. Mock model as absent
  3. Call `checkRecipeAvailability(recipe)`
- **Expected Result**: `unmet.length === 1`

---

## engine/transforms/geometry.js — pure helpers

### UT-088
- **Title**: `resolveAspectRatio` — `"original"` returns canvas aspect ratio
- **Description**: The `original` sentinel should preserve the source image's ratio.
- **Test Data**: aspectRatio=`"original"`, W=1920, H=1080
- **Steps**:
  1. Access `resolveAspectRatio` (may need to extract or test via integration)
  2. Call with above params
- **Expected Result**: Returns `16/9` ≈ 1.7778

### UT-089
- **Title**: `resolveAspectRatio` — `"4:3"` returns the correct numeric ratio
- **Test Data**: aspectRatio=`"4:3"`, W=800, H=600
- **Steps**:
  1. Call `resolveAspectRatio("4:3", null, 800, 600)`
- **Expected Result**: Returns `4/3` ≈ 1.3333

### UT-090
- **Title**: `resolveAspectRatio` — `"custom"` with valid `customRatio` uses it
- **Test Data**: aspectRatio=`"custom"`, customRatio=`"2.35"`, W=1000, H=500
- **Steps**:
  1. Call `resolveAspectRatio("custom", "2.35", 1000, 500)`
- **Expected Result**: Returns `2.35`

### UT-091
- **Title**: `resolveAspectRatio` — `"custom"` with invalid `customRatio` falls back to image ratio
- **Test Data**: aspectRatio=`"custom"`, customRatio=`"not-a-number"`, W=1000, H=500
- **Steps**:
  1. Call `resolveAspectRatio("custom", "not-a-number", 1000, 500)`
- **Expected Result**: Returns `1000/500 = 2.0` (image original ratio)

---

## engine/utils/perspective.js — drawAffineTriangle

### UT-092
- **Title**: `drawAffineTriangle` — degenerate triangle (zero area) does nothing
- **Description**: When determinant is < 1e-6 the function must bail out without drawing or throwing.
- **Test Data**: Three collinear points: s0=s1=s2={(0,0)}
- **Dependencies**: A mock CanvasRenderingContext2D spy
- **Steps**:
  1. Create spy ctx
  2. Call `drawAffineTriangle(ctx, mockImage, 100, 100, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0}, {x:0,y:0})`
- **Expected Result**: `ctx.setTransform` is never called; no error thrown

### UT-093
- **Title**: `drawAffineTriangle` — valid triangle invokes ctx.transform and ctx.drawImage
- **Test Data**: Non-degenerate triangle source and destination corners
- **Dependencies**: Mock ctx spy
- **Steps**:
  1. Call with valid source and destination triangles
- **Expected Result**: `ctx.save`, `ctx.transform`, `ctx.drawImage`, and `ctx.restore` are each called once
