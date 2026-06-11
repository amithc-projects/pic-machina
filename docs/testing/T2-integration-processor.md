# Tier 2 — Integration Tests: Engine Processor Pipeline

**Tool**: Vitest + jsdom (Canvas API polyfill needed)  
**File location**: `tests/integration/engine/`  
**Run command**: `npx vitest run tests/integration/engine/`

**Setup requirements**:
- `@napi-rs/canvas` or `canvas` npm package for Node.js Canvas support in Vitest
- Mock WASM imports (`photon_rs_bg.wasm`) — replace with a no-op stub
- Mock AI/MediaPipe imports — these are tested in Tier 4 (golden image) only
- Fixture images from `tests/fixtures/` (TD-IMG-001 through TD-IMG-004)

---

## Processor — Condition Evaluator

### IT-025
- **Title**: Condition `IsPortrait` — true for canvas with height > width
- **Description**: Conditional nodes use the internal `evalCondition` function. Test via a recipe that applies different transforms based on orientation.
- **Test Data**: Canvas 1000×1500 (portrait), condition `{ field: "IsPortrait", operator: "eq", value: true }`
- **Steps**:
  1. Import the processor
  2. Build a recipe with a conditional node: if IsPortrait → flow-save (label="portrait"), else → flow-save (label="landscape")
  3. Run processor with a 1000×1500 canvas
  4. Check which state was saved in context.variables
- **Expected Result**: `context.variables.get("portrait")` is set; `"landscape"` is not

### IT-026
- **Title**: Condition `HasGPS` — true when exif.gps is present
- **Test Data**: Context with `exif: { gps: { lat: 51.5, lng: -0.1 } }`, condition `{ field: "HasGPS" }`
- **Steps**:
  1. Build recipe: if HasGPS → flow-save("gps-branch")
  2. Run processor with GPS exif context
- **Expected Result**: `"gps-branch"` variable is set

### IT-027
- **Title**: Condition `width gt 1000` — passes only for wide images
- **Test Data**: 1920×1080 canvas, condition `{ field: "width", operator: "gt", value: 1000 }`
- **Steps**:
  1. Build conditional recipe
  2. Run with 1920×1080 canvas
- **Expected Result**: Then-branch executes

### IT-028
- **Title**: Condition `width gt 1000` — fails for narrow images
- **Test Data**: 800×600 canvas
- **Steps**:
  1. Same recipe, run with 800×600 canvas
- **Expected Result**: Else-branch executes (or neither if no else)

### IT-029
- **Title**: Condition `aspectRatio lte 1` — portrait/square images match
- **Test Data**: Canvas 600×800 (aspectRatio = 0.75)
- **Steps**:
  1. Condition `{ field: "aspectRatio", operator: "lte", value: 1 }`
  2. Run processor
- **Expected Result**: Then-branch fires

---

## Processor — flow-save / flow-load state nodes

### IT-030
- **Title**: `flow-save` stores canvas ImageData under the given label
- **Test Data**: 100×100 canvas with known pixel content, node params `{ label: "my-state" }`
- **Steps**:
  1. Build recipe: single flow-save node, label="my-state"
  2. Run processor
  3. Check `context.variables.get("my-state")`
- **Expected Result**: Returns an `ImageData` object with `width === 100`, `height === 100`

### IT-031
- **Title**: `flow-load` restores previously saved canvas state
- **Test Data**: Red 100×100 canvas, flow-save("red-state"), then clear canvas to white, then flow-load("red-state")
- **Steps**:
  1. Recipe: [flow-save("red-state"), <apply white fill>, flow-load("red-state")]
  2. Run processor
  3. Inspect canvas pixels after processing
- **Expected Result**: Canvas is red again (state was restored)

### IT-032
- **Title**: `flow-load` with blend mode `source-over` composites over current canvas
- **Test Data**: flow-save state (red), canvas (blue), flow-load with blend="source-over"
- **Steps**:
  1. Build recipe with save and load at different blend modes
  2. Inspect output pixel values
- **Expected Result**: Pixels reflect the blending, not a pure replace

---

## Processor — Branch nodes

### IT-033
- **Title**: Branch node produces one output per branch
- **Description**: A branch node should generate N output blobs (one per variant) from a single input.
- **Test Data**: Recipe TD-REC-002 (branch with 2 variants); fixture image TD-IMG-002
- **Steps**:
  1. Import `processRecipe` from `src/engine/processor.js`
  2. Run with branch recipe and landscape image
  3. Collect all ProcessResult items
- **Expected Result**: Array of length 2 (one per branch variant)

### IT-034
- **Title**: Disabled node is skipped in execution
- **Description**: A node with `disabled: true` must not alter the canvas.
- **Test Data**: Recipe with a color-invert node (`disabled: true`) between two identifiable states
- **Steps**:
  1. Save state before disabled node
  2. Run recipe
  3. Compare canvas pixels before and after
- **Expected Result**: Canvas pixels unchanged by the disabled node

---

## Processor — Meta transforms

### IT-035
- **Title**: `meta-set-exif` stores write instructions on context (does not write to canvas)
- **Test Data**: Node: `meta-set-exif`, params `{ field: "copyright", value: "© Test 2024" }`
- **Steps**:
  1. Run processor with meta-set-exif node
  2. Inspect `context._exifWrites`
- **Expected Result**: `context._exifWrites.copyright === "© Test 2024"`

### IT-036
- **Title**: `meta-set-exif` with `{{vars}}` interpolation resolves correctly
- **Test Data**: params `{ field: "copyright", value: "© {{exif.author | \"Owner\"}}" }`, context with `exif.author = "Alice"`
- **Steps**:
  1. Run processor
  2. Check `context._exifWrites.copyright`
- **Expected Result**: `"© Alice"`

### IT-037
- **Title**: `meta-strip` sets `context._stripMetadata` level
- **Test Data**: Node params `{ level: "GPS Only" }`
- **Steps**:
  1. Run processor with meta-strip node
  2. Inspect `context._stripMetadata`
- **Expected Result**: `context._stripMetadata === "GPS Only"`

---

## Processor — `flow-export` node produces a ProcessResult blob

### IT-038
- **Title**: `flow-export` with JPEG format produces a JPEG blob
- **Test Data**: A 100×100 canvas, node params `{ format: "image/jpeg", quality: 90, suffix: "-out" }`
- **Steps**:
  1. Run processor with flow-export node
  2. Collect ProcessResult items
- **Expected Result**: At least one result with `blob.type === "image/jpeg"`; `filename` ends with `"-out.jpg"` or similar

### IT-039
- **Title**: `flow-export` with PNG format produces a PNG blob
- **Test Data**: Same but `{ format: "image/png" }`
- **Expected Result**: `blob.type === "image/png"`

---

## Variables.js — `resolveParams` integration

### IT-040
- **Title**: `resolveParams` resolves `{{vars}}` in all string params of a node
- **Description**: Node params that contain template tokens should be resolved before the transform runs.
- **Test Data**: Node params `{ subfolder: "{{exif.dateTaken | date(\"YYYY\")}}" }`, context `{ exif: { dateTaken: "2024-03-01" } }`
- **Steps**:
  1. Call `resolveParams(node.params, context)`
- **Expected Result**: `subfolder === "2024"`

---

## data/recipes.js — autosave debounce

### IT-041
- **Title**: `scheduleAutosave` — fires callback after 5 seconds
- **Description**: Uses fake timers to verify the debounce without real 5s wait.
- **Steps**:
  1. Use `vi.useFakeTimers()`
  2. Call `scheduleAutosave(recipe, callback)`
  3. Advance timers by 5000ms
  4. Check callback was called
- **Expected Result**: Callback invoked exactly once after 5000ms

### IT-042
- **Title**: `cancelAutosave` — prevents the callback from firing
- **Steps**:
  1. Use `vi.useFakeTimers()`
  2. Call `scheduleAutosave(recipe, callback)`
  3. Call `cancelAutosave()`
  4. Advance timers by 6000ms
  5. Check callback
- **Expected Result**: Callback never invoked
