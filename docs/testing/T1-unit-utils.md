# Tier 1 — Unit Tests: Utility Functions

**Tool**: Vitest  
**File location**: `tests/unit/utils/`  
**Run command**: `npx vitest run tests/unit/utils/`  
**Notes**: No DOM, no browser, no network required. All pure function tests.

---

## misc.js

### UT-001
- **Title**: `clamp` — value within range is unchanged
- **Description**: Verify that `clamp(v, min, max)` returns `v` when min ≤ v ≤ max.
- **Test Data**: v=50, min=0, max=100
- **Steps**:
  1. Import `clamp` from `src/utils/misc.js`
  2. Call `clamp(50, 0, 100)`
- **Expected Result**: Returns `50`

### UT-002
- **Title**: `clamp` — value below minimum is clamped to min
- **Description**: Value less than min should return min.
- **Test Data**: v=-10, min=0, max=100
- **Steps**:
  1. Call `clamp(-10, 0, 100)`
- **Expected Result**: Returns `0`

### UT-003
- **Title**: `clamp` — value above maximum is clamped to max
- **Test Data**: v=200, min=0, max=100
- **Steps**:
  1. Call `clamp(200, 0, 100)`
- **Expected Result**: Returns `100`

### UT-004
- **Title**: `formatBytes` — bytes below 1 KB
- **Description**: Numbers under 1024 should show as `X B`.
- **Test Data**: 512
- **Steps**:
  1. Call `formatBytes(512)`
- **Expected Result**: Returns `"512 B"`

### UT-005
- **Title**: `formatBytes` — kilobytes range
- **Test Data**: 2048
- **Steps**:
  1. Call `formatBytes(2048)`
- **Expected Result**: Returns `"2.0 KB"`

### UT-006
- **Title**: `formatBytes` — megabytes range
- **Test Data**: 5242880
- **Steps**:
  1. Call `formatBytes(5242880)`
- **Expected Result**: Returns `"5.0 MB"`

### UT-007
- **Title**: `deepClone` — produces a deep copy, not a reference
- **Description**: Mutations to the clone must not affect the original.
- **Test Data**: `{ a: 1, b: { c: 2 } }`
- **Steps**:
  1. Const original = `{ a: 1, b: { c: 2 } }`
  2. Const clone = `deepClone(original)`
  3. Set `clone.b.c = 99`
  4. Assert `original.b.c`
- **Expected Result**: `original.b.c` remains `2`

### UT-008
- **Title**: `uuid` — produces a valid v4 UUID string
- **Description**: UUID must match the standard v4 format pattern.
- **Steps**:
  1. Call `uuid()`
  2. Test result against regex `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`
- **Expected Result**: Regex matches

### UT-009
- **Title**: `uuid` — two consecutive calls produce different values
- **Steps**:
  1. Call `uuid()` twice
- **Expected Result**: The two values are not equal

### UT-010
- **Title**: `formatDate` — formats epoch ms to human-readable date
- **Test Data**: `new Date('2024-03-15').getTime()` → epoch ms for 2024-03-15
- **Steps**:
  1. Call `formatDate(epochMs)`
- **Expected Result**: Returns a string containing "Mar", "15", and "2024"

---

## variables.js (interpolation engine)

### UT-011
- **Title**: `interpolate` — basic `{{filename}}` substitution
- **Description**: The most common token should resolve to the filename without extension.
- **Test Data**: template=`"output_{{filename}}"`, context=`{ filename: "photo", ext: "jpg" }`
- **Steps**:
  1. Import `interpolate` from `src/utils/variables.js`
  2. Call `interpolate("output_{{filename}}", { filename: "photo", ext: "jpg" })`
- **Expected Result**: Returns `"output_photo"`

### UT-012
- **Title**: `interpolate` — `{{ext}}` substitution
- **Test Data**: template=`"file.{{ext}}"`, context=`{ filename: "photo", ext: "jpg" }`
- **Steps**:
  1. Call `interpolate("file.{{ext}}", { filename: "photo", ext: "jpg" })`
- **Expected Result**: Returns `"file.jpg"`

### UT-013
- **Title**: `interpolate` — unknown token is preserved as-is
- **Description**: A token with no matching key should remain in the output, not be replaced with empty string.
- **Test Data**: template=`"{{unknown_token}}"`, context=`{}`
- **Steps**:
  1. Call `interpolate("{{unknown_token}}", {})`
- **Expected Result**: Returns `"{{unknown_token}}"`

### UT-014
- **Title**: `interpolate` — nested exif key resolution
- **Test Data**: template=`"ISO: {{exif.iso}}"`, context=`{ exif: { iso: 400 } }`
- **Steps**:
  1. Call `interpolate("ISO: {{exif.iso}}", { exif: { iso: 400 } })`
- **Expected Result**: Returns `"ISO: 400"`

### UT-015
- **Title**: `interpolate` — pipe fallback when value is null
- **Description**: `{{exif.author | "Unknown"}}` should return "Unknown" when exif.author is absent.
- **Test Data**: template=`'{{exif.author | "Unknown"}}'`, context=`{ exif: {} }`
- **Steps**:
  1. Call with template and context above
- **Expected Result**: Returns `"Unknown"`

### UT-016
- **Title**: `interpolate` — `{{br}}` and `{{newline}}` produce actual newline character
- **Test Data**: template=`"Line1{{br}}Line2"`, context=`{}`
- **Steps**:
  1. Call `interpolate("Line1{{br}}Line2", {})`
- **Expected Result**: Returns `"Line1\nLine2"` (contains actual newline)

### UT-017
- **Title**: `interpolate` — `\\n` literal in template is converted to newline
- **Test Data**: template=`"A\\nB"`, context=`{}`
- **Steps**:
  1. Call `interpolate("A\\nB", {})`
- **Expected Result**: Returns `"A\nB"`

### UT-018
- **Title**: `interpolate` — sidecar dotted path resolution
- **Test Data**: template=`"{{sidecar.geo.city}}"`, context=`{ sidecar: { geo: { city: "Paris" } } }`
- **Steps**:
  1. Call `interpolate("{{sidecar.geo.city}}", context)`
- **Expected Result**: Returns `"Paris"`

### UT-019
- **Title**: `interpolate` — sidecar annotation tags array joined with comma
- **Test Data**: template=`"{{sidecar.annotation.tags}}"`, context=`{ sidecar: { annotation: { tags: ["travel", "nature"] } } }`
- **Steps**:
  1. Call `interpolate` with above
- **Expected Result**: Returns `"travel, nature"`

### UT-020
- **Title**: `interpolate` — non-string template coerced safely
- **Test Data**: template=`null`, context=`{}`
- **Steps**:
  1. Call `interpolate(null, {})`
- **Expected Result**: Returns `"null"` — does not throw

### UT-021
- **Title**: `interpolate` — date pipe `date("YYYY")` formats year correctly
- **Test Data**: template=`'{{exif.dateTaken | date("YYYY")}}'`, context=`{ exif: { dateTaken: "2023-06-15" } }`
- **Steps**:
  1. Call `interpolate` with above
- **Expected Result**: Returns `"2023"`

### UT-022
- **Title**: `resolveKey` — `loop.index` returns the reserved literal (not blank)
- **Description**: Loop variables are v1.2 reserved — they must not silently swallow the token.
- **Test Data**: key=`"loop.index"`, ctx=`{}`
- **Steps**:
  1. Import `resolveKey` from `src/utils/variables.js`
  2. Call `resolveKey("loop.index", {})`
- **Expected Result**: Returns `"{{loop.index}}"` (preserved literal)

---

## subtitles.js

### UT-023
- **Title**: `parseSubtitles` — parses a standard 2-block SRT correctly
- **Test Data**: TD-SRT-001 (`basic.srt`)
- **Steps**:
  1. Import `parseSubtitles` from `src/utils/subtitles.js`
  2. Read the fixture content
  3. Call `parseSubtitles(content)`
- **Expected Result**:
  - Returns array of length 2
  - Entry 0: `{ start: 1.0, end: 4.0, text: "Hello world" }`
  - Entry 1: `{ start: 5.5, end: 8.2, text: "Second caption line" }`

### UT-024
- **Title**: `parseSubtitles` — parses WebVTT format
- **Test Data**: TD-SRT-002 (`vtt-basic.vtt`)
- **Steps**:
  1. Call `parseSubtitles` with VTT content
- **Expected Result**: Returns array of length 1 with `start: 1.0, end: 4.0, text: "Hello world"`

### UT-025
- **Title**: `parseSubtitles` — handles CRLF line endings
- **Test Data**: TD-SRT-003 (`srt-crlf.srt`)
- **Steps**:
  1. Call `parseSubtitles` with CRLF content
- **Expected Result**: Returns same result as the LF equivalent — 2 entries

### UT-026
- **Title**: `parseSubtitles` — returns empty array for non-SRT input
- **Test Data**: TD-SRT-004 (`srt-malformed.txt`)
- **Steps**:
  1. Call `parseSubtitles` with content that has no `-->` lines
- **Expected Result**: Returns `[]`

### UT-027
- **Title**: `parseSubtitles` — handles hour:minute:second.ms timing (VTT three-part)
- **Test Data**: Inline string: `"00:01:30.500 --> 00:01:35.000\nTest caption"`
- **Steps**:
  1. Call `parseSubtitles` with above
- **Expected Result**: Entry 0: `{ start: 90.5, end: 95.0, text: "Test caption" }`

### UT-028
- **Title**: `parseSubtitles` — multi-line text in a block is joined with newline
- **Test Data**:
```
1
00:00:01,000 --> 00:00:03,000
Line one
Line two
```
- **Steps**:
  1. Call `parseSubtitles` with above
- **Expected Result**: `text: "Line one\nLine two"`

---

## color-matcher.js

### UT-029
- **Title**: `getClosestColorName` — exact match returns exact CSS name
- **Description**: Pure red `#FF0000` should return `"red"`.
- **Test Data**: hex=`"#FF0000"` (or RGB 255,0,0)
- **Steps**:
  1. Import the main export from `src/utils/color-matcher.js`
  2. Call with pure red
- **Expected Result**: Returns `"red"`

### UT-030
- **Title**: `getClosestColorName` — near-white returns `"white"` or a very close variant
- **Test Data**: hex=`"#FEFFFF"`
- **Steps**:
  1. Call with near-white
- **Expected Result**: Returns `"white"` or `"ghostwhite"` (within CIE-LAB perceptual distance threshold)

### UT-031
- **Title**: `getClosestColorName` — pure black returns `"black"`
- **Test Data**: hex=`"#000000"`
- **Expected Result**: Returns `"black"`

---

## nodes.js (recipe node tree utilities)

### UT-032
- **Title**: `flattenNodes` — flat list of transforms has no branch headers
- **Test Data**: `[{ id: "n1", type: "transform" }, { id: "n2", type: "transform" }]`
- **Steps**:
  1. Import `flattenNodes` from `src/utils/nodes.js`
  2. Call `flattenNodes(nodes)`
- **Expected Result**: Returns array of length 2. Both `isBranchHeader` are `false`.

### UT-033
- **Title**: `flattenNodes` — branch node produces headers for each branch
- **Test Data**: A branch node with 2 variants, each containing 1 transform node
- **Steps**:
  1. Create: `{ id: "b1", type: "branch", branches: [{ id: "v1", label: "A", nodes: [transform1] }, { id: "v2", label: "B", nodes: [transform2] }] }`
  2. Call `flattenNodes([branchNode])`
- **Expected Result**: Array of length 5: branch node + header A + transform1 + header B + transform2. Headers have `isBranchHeader: true`.

### UT-034
- **Title**: `flattenNodes` — conditional node produces then/else headers
- **Test Data**: `{ id: "c1", type: "conditional", thenNodes: [t1], elseNodes: [t2] }`
- **Steps**:
  1. Call `flattenNodes([conditionalNode])`
- **Expected Result**: Array of length 5: conditional + "Then" header + t1 + "Else" header + t2

### UT-035
- **Title**: `countNodes` — counts all nodes in a nested tree
- **Test Data**: Branch node with 2 branches each containing 2 transforms (total: 1 branch + 4 transforms = 5)
- **Steps**:
  1. Call `countNodes([branchNode])`
- **Expected Result**: Returns `5`

### UT-036
- **Title**: `findNodeAndParent` — finds a node at top level
- **Test Data**: `[{ id: "t1", type: "transform" }, { id: "t2", type: "transform" }]`
- **Steps**:
  1. Call `findNodeAndParent(nodes, "t2")`
- **Expected Result**: Returns `{ node: { id: "t2" }, parent: nodes, index: 1 }`

### UT-037
- **Title**: `findNodeAndParent` — finds a node nested inside a branch
- **Test Data**: Branch node containing a transform node with id `"deep-node"`
- **Steps**:
  1. Build tree with deeply nested node
  2. Call `findNodeAndParent(nodes, "deep-node")`
- **Expected Result**: Returns object with `node.id === "deep-node"` and correct parent array

### UT-038
- **Title**: `findNodeAndParent` — returns null for non-existent id
- **Test Data**: Flat list of 3 nodes, searching for id `"does-not-exist"`
- **Steps**:
  1. Call `findNodeAndParent(nodes, "does-not-exist")`
- **Expected Result**: Returns `null`

### UT-039
- **Title**: `applyRunParams` — overwrites matching param keys on transform nodes
- **Test Data**: Node `{ type: "transform", params: { quality: 80, format: "jpeg" } }`, runParams=`{ quality: 95 }`
- **Steps**:
  1. Call `applyRunParams([node], runParams)`
- **Expected Result**: `node.params.quality === 95`, `node.params.format` unchanged (`"jpeg"`)

### UT-040
- **Title**: `applyRunParams` — does not mutate non-matching keys or non-transform nodes
- **Test Data**: A conditional node with no `params`, runParams=`{ quality: 95 }`
- **Steps**:
  1. Call `applyRunParams([conditionalNode], runParams)`
- **Expected Result**: No error thrown; conditional node unchanged

---

## engine/behaviors.js

### UT-041
- **Title**: `applyBehavior` — `sine` behavior returns base value at t=0 with phase=0
- **Description**: At t=0, sin(0) = 0, so the result should equal baseValue.
- **Test Data**: behaviorData=`{ id: "sine", params: { frequency: 1, amplitude: 50, phase: 0 } }`, baseValue=100, time=0
- **Steps**:
  1. Import `applyBehavior` from `src/engine/behaviors.js`
  2. Call `applyBehavior(behaviorData, 100, 0)`
- **Expected Result**: Returns `100` (sin(0) = 0, no offset added)

### UT-042
- **Title**: `applyBehavior` — `ramp` behavior increments linearly
- **Description**: ramp at rate=10 for t=3 should add 30 to baseValue.
- **Test Data**: behaviorData=`{ id: "ramp", params: { rate: 10 } }`, baseValue=0, time=3
- **Steps**:
  1. Call `applyBehavior({ id: "ramp", params: { rate: 10 } }, 0, 3)`
- **Expected Result**: Returns `30`

### UT-043
- **Title**: `applyBehavior` — non-numeric baseValue returns unchanged
- **Description**: Behaviors are only applied to numeric values — strings should pass through.
- **Test Data**: baseValue=`"text"`, time=1
- **Steps**:
  1. Call `applyBehavior({ id: "sine", params: {} }, "text", 1)`
- **Expected Result**: Returns `"text"` unchanged

### UT-044
- **Title**: `applyBehavior` — unknown behavior id returns baseValue unchanged
- **Test Data**: behaviorData=`{ id: "nonexistent", params: {} }`, baseValue=42, time=1
- **Steps**:
  1. Call `applyBehavior({ id: "nonexistent", params: {} }, 42, 1)`
- **Expected Result**: Returns `42`
