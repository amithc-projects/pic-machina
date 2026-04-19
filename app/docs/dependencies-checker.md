# Plan: Transform Dependency & Availability System

## Context

Many transforms have prerequisites the user must fulfil before they work — most immediately, the 12 InSPyReNet-based AI transforms require the `inspyrenet-swinb-fp16` model (~200 MB) to be downloaded via the Model Manager. Today this is communicated only at runtime (a silent skip + console warn). Users see no upfront indication in the recipe library, node editor, or builder that setup is needed — leading to confusion when transforms silently do nothing.

The goal is a clean, extensible system where:
1. Each transform **declares** its requirements in its registry entry.
2. A central **capabilities module** checks those requirements asynchronously and caches results.
3. Four UI surfaces surface the status early: recipe cards, node picker, inspector, and pre-run gate.
4. The architecture also accommodates future requirement types (Chrome experimental flags, premium licence) without further structural changes.

---

## A. Data Model — `requires` field on transform definitions

Add an optional `requires` array to `registry.register()` objects. The field lives only in the runtime registry (never persisted to IndexedDB).

```js
requires: [
  {
    type:       'model',                      // 'model' | 'chrome-ai' | 'flag' | 'premium'
    id:         'inspyrenet-swinb-fp16',      // unique ID within type
    label:      'InSPyReNet model (~200 MB)', // human-readable, shown in UI
    actionHref: '#mdl',                       // where to send user to fix it
  }
]
```

`type + id` forms the session-cache key (`"model:inspyrenet-swinb-fp16"`). Transforms with no `requires` field (or empty array) are always considered available.

---

## B. New file: `app/src/engine/capabilities.js`

Exports five functions. Uses a module-level `Map` as a session cache.

```js
const _cache = new Map(); // key: "type:id" → boolean

// Resolvers for each requirement type
const RESOLVERS = {
  'model':     async (req) => { const r = await getModelRecord(req.id); return !!(r?.bytes); },
  'chrome-ai': async (req) => typeof window !== 'undefined' && !!window.ai,
  'flag':      async (req) => false,   // no auto-detection; always false until user confirms
  'premium':   async (req) => false,   // always false until licence module exists
};

export async function checkRequirement(req)
  // Checks cache first; resolves via RESOLVERS if not cached.
  // Returns: { met: boolean, req }

export async function checkTransformAvailability(transformId)
  // Calls checkRequirement for each entry in def.requires.
  // Returns: { available: boolean, unmet: Requirement[] }

export async function checkRecipeAvailability(recipe)
  // Walks recipe.nodes recursively via flattenNodes() from utils/nodes.js.
  // Collects transformIds from all type==='transform' nodes.
  // Calls checkTransformAvailability per unique transformId.
  // Deduplicates unmet requirements by "type:id".
  // Returns: { available: boolean, unmet: Requirement[] }

export function invalidate(type, id)
  // Deletes "type:id" from _cache. Call from mdl.js after download/delete.

export function invalidateAllModels()
  // Deletes all keys starting with "model:" from _cache.
  // Belt-and-braces: call when navigating away from #mdl.
```

**Imports:** `registry` from `./registry.js`; `getModelRecord` from `../data/models.js`; `flattenNodes` from `../utils/nodes.js`.

---

## C. Registry annotation — transforms to update

### `app/src/engine/transforms/ai.js` — 10 transforms
Add `requires: [{ type: 'model', id: 'inspyrenet-swinb-fp16', label: 'InSPyReNet model (~200 MB)', actionHref: '#mdl' }]`:
- `ai-remove-bg-hq` · `ai-portrait-bokeh` · `ai-drop-shadow` · `ai-sticker-outline`
- `ai-subject-glow` · `ai-export-matte` · `ai-subject-vignette` · `ai-subject-sharpen`
- `ai-silhouette` · `ai-smart-redact`

### `app/src/engine/transforms/geometry.js` — 1 transform (line 506)
- `ai-subject-crop`

### `app/src/engine/transforms/color.js` — 1 transform (line 983)
- `ai-selective-grade`

**No changes to `apply()` bodies.** Runtime guards stay as-is.

**Do NOT annotate:** `ai-remove-bg`, `ai-face-privacy`, `ai-ocr-tag`, `ai-analyse-people` — these load from CDN automatically, no user action required.

---

## D. UI Surfaces

### D1. Library — `app/src/screens/lib.js`
**Recipe card "Needs setup" badge.**

After the existing grid `innerHTML` is set, run an async post-render pass:
```js
// After container.querySelector('.lib-grid').innerHTML = cards...
(async () => {
  for (const recipe of allRecipes) {
    const { available, unmet } = await checkRecipeAvailability(recipe);
    if (available) continue;
    const card = container.querySelector(`.lib-card[data-id="${recipe.id}"]`);
    if (!card) continue;
    const badges = card.querySelector('.lib-card__badges');
    const tip = unmet.map(r => r.label).join(', ');
    badges.insertAdjacentHTML('beforeend',
      `<span class="ic-badge ic-badge--amber" title="Needs setup: ${tip}">
         <span class="material-symbols-outlined" style="font-size:11px">warning</span>
         Needs setup
       </span>`);
    // Also dim the "Use Recipe" CTA
    card.querySelector('.lib-card__use')?.setAttribute('title', `Needs setup: ${tip}`);
  }
})();
```
This runs after initial paint — cards appear immediately, badges fill in shortly after.

### D2. Builder — `app/src/screens/bld.js`
**Two surfaces:**

**Node row** (after `renderNodes()` — which already re-renders on every add/delete/reorder):
```js
// After renderNodes() updates the DOM:
(async () => {
  for (const item of flattenedNodes) {
    if (item.node.type !== 'transform') continue;
    const { available, unmet } = await checkTransformAvailability(item.node.transformId);
    if (available) continue;
    const row = container.querySelector(`.bld-node-row[data-id="${item.node.id}"]`);
    const tip = unmet.map(r => r.label).join(', ');
    row?.insertAdjacentHTML('beforeend',
      `<span class="material-symbols-outlined bld-node-warn"
             title="Needs setup: ${tip}"
             style="font-size:14px;color:#f59e0b;flex-shrink:0">warning</span>`);
  }
})();
```

**Node picker modal** (run once, after the modal is first opened):
- After the modal grid HTML is set, iterate each `.bld-add-item[data-transform-id]`.
- Call `checkTransformAvailability(el.dataset.transformId)`.
- If unavailable, insert a small amber `warning` icon inside the tile and add class `bld-add-item--needs-setup`.
- Modal is built once; the async pass runs once after first open.

### D3. Inspector — `app/src/screens/ins.js`
After the steps list `innerHTML` is set (inside `render()`, after the `.ins-step-row` elements exist):
```js
(async () => {
  for (const [idx, item] of flatItems.entries()) {
    if (item.node.type !== 'transform') continue;
    const { available } = await checkTransformAvailability(item.node.transformId);
    if (available) continue;
    const row = container.querySelector(`.ins-step-row[data-idx="${idx}"]`);
    row?.insertAdjacentHTML('beforeend',
      `<span class="material-symbols-outlined" title="Needs setup"
             style="font-size:12px;color:#f59e0b;margin-left:auto">warning</span>`);
  }
})();
```

### D4. Pre-run gate — `app/src/screens/set.js`
Insert inside the `#btn-run` click handler (line 350), **before** `location.hash = '#que'` (line 394):

```js
// Availability gate — check before navigating to queue
const { available, unmet } = await checkRecipeAvailability(currentRecipe);
if (!available) {
  const labels = unmet.map(r => `• ${r.label}`).join('\n');
  const proceed = await showCapabilityDialog(container, labels, unmet[0]?.actionHref);
  if (!proceed) return;  // user chose "Fix now" → already navigated
}
```

`showCapabilityDialog` is a small inline helper that creates a native `<dialog>` (consistent with line 1112's `modal.showModal()` pattern already in `set.js`):
```js
function showCapabilityDialog(container, labels, actionHref) {
  return new Promise(resolve => {
    const dlg = document.createElement('dialog');
    dlg.innerHTML = `
      <h3 style="...">Recipe needs setup</h3>
      <p>These requirements are not yet met:</p>
      <pre style="...">${labels}</pre>
      <p>Steps needing them will be silently skipped if you run anyway.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button id="cap-fix">Fix now</button>
        <button id="cap-run" class="btn-primary">Run anyway</button>
      </div>`;
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('#cap-run').onclick = () => { dlg.close(); dlg.remove(); resolve(true); };
    dlg.querySelector('#cap-fix').onclick = () => {
      dlg.close(); dlg.remove();
      location.hash = actionHref || '#mdl';
      resolve(false);
    };
  });
}
```

### D5. Cache invalidation — `app/src/screens/mdl.js`
Import `invalidate` from `../engine/capabilities.js`. Call after download and delete:
- **After successful download** (inside `startDownload`, after `refreshCard`): `invalidate('model', meta.id)`
- **After successful delete** (inside `handleAction` delete path, after `refreshCard`): `invalidate('model', meta.id)`

---

## Files to create / modify

| File | Change |
|---|---|
| `app/src/engine/capabilities.js` | **Create** — full capability resolver + session cache |
| `app/src/engine/transforms/ai.js` | Add `requires` to 10 transforms |
| `app/src/engine/transforms/geometry.js` | Add `requires` to `ai-subject-crop` (line 506) |
| `app/src/engine/transforms/color.js` | Add `requires` to `ai-selective-grade` (line 983) |
| `app/src/screens/lib.js` | Async post-render pass for recipe badges |
| `app/src/screens/bld.js` | Async passes for node rows + node picker |
| `app/src/screens/ins.js` | Async pass for step-row warnings |
| `app/src/screens/set.js` | Pre-run gate before `location.hash = '#que'` (line 394) |
| `app/src/screens/mdl.js` | `invalidate()` calls after download + delete |

**Reused utilities:**
- `flattenNodes` from `app/src/utils/nodes.js` (handles branches, conditionals, thenNodes, elseNodes)
- `getModelRecord` from `app/src/data/models.js`
- `registry.get()` from `app/src/engine/registry.js`

---

## Verification

1. **Model not downloaded** → open `#lib` → any recipe containing an InSPyReNet transform shows amber "Needs setup" badge. Recipes with only basic transforms show none.
2. **Builder** → open a recipe with `ai-portrait-bokeh` → node row shows amber warning icon. Open node picker → InSPyReNet transforms show warning badge; e.g. `geo-rotate` does not.
3. **Inspector** → view a block containing `ai-drop-shadow` → that step row shows warning icon.
4. **Pre-run gate** → select a recipe with `ai-subject-glow`, click Run Batch → dialog appears listing "InSPyReNet model (~200 MB)". "Fix now" navigates to `#mdl`. "Run anyway" proceeds to queue; batch runs but those steps skip silently (existing behaviour).
5. **Cache invalidation** → download model on `#mdl` → navigate back to `#lib` → badges gone. Delete model → badges re-appear.
6. **No regression** → recipes with only color/geometry transforms show no badges, no pre-run dialog, run straight through.
7. **Future requirement** → add `{ type: 'chrome-ai', ... }` to any transform and verify the badge and pre-run gate surface it without any new code beyond the resolver.

---

# Plan: Transform Dependency & Availability System

## Context

Many transforms have prerequisites the user must fulfil before they work — most immediately, the 12 InSPyReNet-based AI transforms require the `inspyrenet-swinb-fp16` model (~200 MB) to be downloaded via the Model Manager. Today this is communicated only at runtime (a silent skip + console warn). Users see no upfront indication in the recipe library, node editor, or builder that setup is needed — leading to confusion when transforms silently do nothing.

The goal is a clean, extensible system where:
1. Each transform **declares** its requirements in its registry entry.
2. A central **capabilities module** checks those requirements asynchronously and caches results.
3. Four UI surfaces surface the status early: recipe cards, node picker, inspector, and pre-run gate.
4. The architecture accommodates future requirement types (Chrome experimental flags, premium licence) without further structural changes.

---

## A. Data Model — `requires` field on transform definitions

Add an optional `requires` array to `registry.register()` objects. Lives only in the runtime registry — never persisted to IndexedDB.

```js
requires: [
  {
    type:       'model',                      // 'model' | 'chrome-ai' | 'flag' | 'premium'
    id:         'inspyrenet-swinb-fp16',
    label:      'InSPyReNet model (~200 MB)',
    actionHref: '#mdl',                       // where to send user to fix it
  }
]
```

Cache key = `"type:id"`. Transforms with no `requires` (or empty array) are always available.

---

## B. New file: `app/src/engine/capabilities.js`

```js
const _cache = new Map(); // "type:id" → boolean

const RESOLVERS = {
  'model':     async (req) => { const r = await getModelRecord(req.id); return !!(r?.bytes); },
  'chrome-ai': async (req) => typeof window !== 'undefined' && !!window.ai,
  'flag':      async (_)   => false,   // no auto-detection
  'premium':   async (_)   => false,   // always false until licence module exists
};

export async function checkRequirement(req)          // → { met: bool, req }
export async function checkTransformAvailability(id) // → { available: bool, unmet: Requirement[] }
export async function checkRecipeAvailability(recipe)// → { available: bool, unmet: Requirement[] } (deduped)
export function invalidate(type, id)                 // delete one cache entry
export function invalidateAllModels()                // delete all "model:*" cache entries
```

**Imports:** `registry` from `./registry.js`; `getModelRecord` from `../data/models.js`; `flattenNodes` from `../utils/nodes.js` (handles branch/conditional/thenNodes/elseNodes).

`checkRecipeAvailability` walks `recipe.nodes` via `flattenNodes()`, collects all `type==='transform'` nodes, calls `checkTransformAvailability` per unique `transformId`, deduplicates unmet by `"type:id"`.

---

## C. Registry annotation

Add `requires: [{ type: 'model', id: 'inspyrenet-swinb-fp16', label: 'InSPyReNet model (~200 MB)', actionHref: '#mdl' }]` to:

**`app/src/engine/transforms/ai.js`** (10 transforms):
`ai-remove-bg-hq`, `ai-portrait-bokeh`, `ai-drop-shadow`, `ai-sticker-outline`, `ai-subject-glow`, `ai-export-matte`, `ai-subject-vignette`, `ai-subject-sharpen`, `ai-silhouette`, `ai-smart-redact`

**`app/src/engine/transforms/geometry.js`** (line 506):
`ai-subject-crop`

**`app/src/engine/transforms/color.js`** (line 983):
`ai-selective-grade`

**Do NOT annotate** (CDN auto-load, no user action needed): `ai-remove-bg`, `ai-face-privacy`, `ai-ocr-tag`, `ai-analyse-people`

No changes to `apply()` bodies — runtime guards stay as-is.

---

## D. UI Surfaces

### D1. Library — `app/src/screens/lib.js`
After the card grid `innerHTML` is set, run an async post-render pass over all recipes. For each recipe where `checkRecipeAvailability` returns `!available`, inject into `.lib-card__badges`:
```html
<span class="ic-badge ic-badge--amber" title="Needs setup: InSPyReNet model (~200 MB)">
  <span class="material-symbols-outlined" style="font-size:11px">warning</span>
  Needs setup
</span>
```
Cards render immediately; badges fill in shortly after (non-blocking).

### D2. Builder — `app/src/screens/bld.js`
**Node rows:** After `renderNodes()` (called on every add/delete/reorder), async-pass over each `.bld-node-row[data-id]` — if unmet, append amber `warning` icon before the delete button.

**Node picker modal:** After the modal grid is first built, async-pass over each `.bld-add-item[data-transform-id]` — if unmet, insert amber `warning` icon inside the tile + add class `bld-add-item--needs-setup`. Modal is built once, pass runs once.

### D3. Inspector — `app/src/screens/ins.js`
After steps list `innerHTML` is set, async-pass over `.ins-step-row[data-idx]` — if unmet, append amber `warning` icon (margin-left:auto to right-align it).

### D4. Pre-run gate — `app/src/screens/set.js`
Inside the `#btn-run` click handler (line 350), **before** `location.hash = '#que'` (line 394):

```js
const { available, unmet } = await checkRecipeAvailability(currentRecipe);
if (!available) {
  const proceed = await showCapabilityDialog(unmet);
  if (!proceed) return; // user chose "Fix now" → already navigated to actionHref
}
```

`showCapabilityDialog` is a small inline helper using a native `<dialog>` (consistent with existing `modal.showModal()` pattern at line 1112 of set.js). Two buttons: **"Run anyway"** (returns `true`) and **"Fix now"** (navigates to `unmet[0].actionHref`, returns `false`).

### D5. Cache invalidation — `app/src/screens/mdl.js`
Import `invalidate` from `../engine/capabilities.js`. Call:
- After successful model download (after `refreshCard` in `startDownload`): `invalidate('model', meta.id)`
- After successful model delete (after `refreshCard` in `handleAction` delete path): `invalidate('model', meta.id)`

---

## Files to create / modify

| File | Change |
|---|---|
| `app/src/engine/capabilities.js` | **Create** — capability resolver + session cache |
| `app/src/engine/transforms/ai.js` | Add `requires` to 10 transforms |
| `app/src/engine/transforms/geometry.js` | Add `requires` to `ai-subject-crop` (line 506) |
| `app/src/engine/transforms/color.js` | Add `requires` to `ai-selective-grade` (line 983) |
| `app/src/screens/lib.js` | Async post-render badge pass |
| `app/src/screens/bld.js` | Async passes for node rows + node picker |
| `app/src/screens/ins.js` | Async pass for step-row warnings |
| `app/src/screens/set.js` | Pre-run gate before line 394 |
| `app/src/screens/mdl.js` | `invalidate()` after download + delete |

**Key reused utilities:**
- `flattenNodes()` — `app/src/utils/nodes.js`
- `getModelRecord()` — `app/src/data/models.js`
- `registry.get()` — `app/src/engine/registry.js`

---

## Verification

1. **Model absent** → `#lib` → recipes with InSPyReNet transforms show amber "Needs setup" badge; pure color/geometry recipes show none.
2. **Builder node row** → add `ai-portrait-bokeh` → amber warning icon on that row; `geo-rotate` shows none.
3. **Node picker** → InSPyReNet transforms show warning badge; CDN-loaded AI transforms do not.
4. **Inspector** → block with `ai-drop-shadow` step shows warning icon on that row.
5. **Pre-run gate** → select recipe with `ai-subject-glow`, click Run Batch → dialog lists "InSPyReNet model". "Fix now" → navigates to `#mdl`. "Run anyway" → batch proceeds, steps silently skip.
6. **Cache invalidation** → download model → return to `#lib` → badges gone. Delete → badges return.
7. **No regression** → color/geometry-only recipes: no badges, no pre-run dialog, immediate run.
8. **Future type** → add `{ type: 'chrome-ai', ... }` to any transform → badge and gate surface it with no further structural changes.

---

# Plan: Add InSPyReNet High-Quality Background Removal

## Context

The current `ai-remove-bg` transform uses MediaPipe's `selfie_segmenter` model (~5 MB, float16 TFLite), which is optimized for people and produces rough edges on non-human subjects, complex hair, fur, transparent objects, and cluttered backgrounds. For high-quality subject isolation — particularly non-selfie imagery — we need a heavier-weight model.

**InSPyReNet (SwinB-Plus-Ultra)** is a state-of-the-art salient-object segmentation model that produces pixel-accurate alpha mattes on arbitrary subjects. It is available as ONNX on Hugging Face ([OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX](https://huggingface.co/OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX)) in both FP32 (395 MB) and FP16 (199 MB). FP16 gives near-identical quality at half the download and half the runtime RAM.

Because the model is ~200 MB, it cannot ship bundled — the user must opt in to download it. This plan introduces:

1. A new **"Models"** screen in the left-hand nav where the user manages downloads (download, progress, delete, re-download, inspect size/status).
2. A new persistent **IndexedDB `models` store** holding the raw ONNX bytes (not just metadata, unlike `assets`).
3. A new **`ai-remove-bg-hq`** transform that lazily loads the cached model into an `onnxruntime-web` session (WebGPU with WASM fallback) and produces a high-quality alpha matte. Falls back with a clear user message if the model isn't downloaded.

The existing `ai-remove-bg` MediaPipe transform stays unchanged for the fast/selfie path.

---

## Outcome

- Users can go to the new `#mdl` screen, click **Download** next to "InSPyReNet SwinB (FP16)", watch progress, and once complete the `ai-remove-bg-hq` transform becomes available.
- Running `ai-remove-bg-hq` on a 1024² image takes ~1–2 s on WebGPU hardware and ~6–15 s on CPU/WASM, producing clean alpha mattes superior to MediaPipe for general imagery.
- Model bytes persist in IndexedDB across sessions and survive storage-pressure eviction better than the HTTP/Cache API.
- Architecture leaves room for adding additional models later (InSPyReNet FP32, Res2Net50 variant, BiRefNet, etc.) by extending one registry.

---

## Files to create

### 1. `app/src/data/models.js` — Model blob storage
Thin wrapper over the new `models` IndexedDB store. Exports:
- `MODEL_REGISTRY` — hard-coded list of known models with `{ id, name, description, url, sizeBytes, sha256?, backend: 'onnx', precision: 'fp16' }`. For v1, contains a single entry:
  ```
  id: 'inspyrenet-swinb-fp16'
  name: 'InSPyReNet SwinB (FP16)'
  url: 'https://huggingface.co/OS-Software/InSPyReNet-SwinB-Plus-Ultra-ONNX/resolve/main/onnx/model_fp16.onnx'
  sizeBytes: 199_000_000
  ```
- `getModelRecord(id)` → returns `{ id, downloadedAt, sizeBytes, bytes: ArrayBuffer } | null`
- `getModelBytes(id)` → returns `ArrayBuffer | null`
- `downloadModel(id, onProgress)` → fetches with streaming reader, reports `{ loaded, total }`, stores `{ id, downloadedAt, sizeBytes, bytes }` in IDB, returns record
- `deleteModel(id)` → removes from IDB
- `listDownloadedModels()` → `[{ id, downloadedAt, sizeBytes }]` (never returns the raw bytes — use `getModelBytes` when needed)

### 2. `app/src/engine/ai/inspyrenet.js` — Inference wrapper
Module-level cached session. Exports:
- `isModelReady()` → `Promise<boolean>` (checks if bytes are in IDB)
- `runInspyrenet(canvas, { mode, edgeSmoothing }, onLog)` → mutates canvas with transparent/silhouette output. Internally:
  1. Lazy `await getOrCreateSession()` which: reads bytes from IDB → `ort.InferenceSession.create(arrayBuffer, { executionProviders: ['webgpu', 'wasm'] })`. Session cached at module scope.
  2. Preprocess: draw canvas → offscreen 1024×1024 → ImageData → normalize with ImageNet mean `[0.485, 0.456, 0.406]` / std `[0.229, 0.224, 0.225]` → NCHW `Float32Array` tensor.
  3. `session.run({ input: tensor })` → single-channel mask tensor, shape `[1,1,1024,1024]`.
  4. Upscale mask to canvas size via an intermediate canvas (`drawImage` with bilinear), apply edge smoothing threshold, write per-pixel alpha into the main canvas `ImageData`.
- `disposeSession()` → for the Model Manager to call when the user deletes the model.

### 3. `app/src/screens/mdl.js` — Model Manager screen
Standard screen module. `render(container, hash)`:
- Lists `MODEL_REGISTRY` as cards. For each card:
  - Name, description, size (`199 MB`).
  - Status badge: **Not downloaded** / **Downloaded** (with date) / **Downloading…** (with progress bar).
  - Actions: **Download** / **Delete** / **Re-download**.
- Top info strip showing WebGPU availability (`navigator.gpu ? 'WebGPU available' : 'WASM fallback'`) and total IndexedDB usage if `navigator.storage.estimate` is available.
- Download uses `downloadModel(id, onProgress)`; `onProgress` updates the progress bar via DOM mutation (no framework).
- Delete calls `disposeSession()` then `deleteModel(id)`.
- Returns a cleanup function that aborts any in-flight `AbortController` used for the fetch.

Scoped styles injected via `<style>` tag following the pattern in other screens (e.g. `set.js`).

---

## Files to modify

### 4. `app/src/data/db.js`
- Bump `DB_VERSION` from `4` → `5`.
- Add to `onupgradeneeded`:
  ```js
  if (!db.objectStoreNames.contains('models')) {
    db.createObjectStore('models', { keyPath: 'id' });
  }
  ```
- Add `'models'` mention to the schema comment block at the top.

### 5. `app/src/engine/transforms/ai.js`
- Register a new transform `ai-remove-bg-hq` modeled on the existing `ai-remove-bg` registration (lines 126–261). Shares the same mode / edgeSmoothing / bgFill / bgColor / bgImage param shape so the existing `bg-swap.js` compositing can be reused untouched. Its `apply` function:
  1. Guards worker context (same `WorkerGlobalScope` check as `ai-remove-bg` at line 149).
  2. `const ready = await isModelReady(); if (!ready) { context.log('warn', 'InSPyReNet model not downloaded — visit #mdl'); return; }`
  3. `await runInspyrenet(ctx.canvas, { mode, edgeSmoothing }, context.log)`.
  4. Re-uses the existing bg-fill compositing branch (factor out into a small helper if needed, or copy the ~20 lines — prefer factoring once both transforms are in).
  5. Writes `vision.bgRemoved = { model: 'inspyrenet-swinb-fp16', at: Date.now() }` via `patchAsset` like the existing transform.
- Icon suggestion: `auto_awesome_motion`, category `'AI & Composition'`, name `"Remove BG (High Quality)"`.

### 6. `app/src/engine/batch.js`
- Add `'ai-remove-bg-hq'` to the `MAIN_THREAD_TRANSFORMS` set (same reason as MediaPipe — `onnxruntime-web` with WebGPU must run on the main thread; WASM+threads worker is technically possible but adds complexity we don't need now).

### 7. `app/src/main.js`
- Add `mdl: () => import('./screens/mdl.js'),` to the `SCREENS` map (line 11+).

### 8. `app/index.html`
- Add a new nav `<li>` near the existing Settings-area items (above the `help`/`settings` buttons), hash `#mdl`, Material icon `smart_toy` or `neurology`, label **Models**.

### 9. `app/package.json`
- Add dependency: `"onnxruntime-web": "^1.19.0"` (latest stable with WebGPU EP).

### 10. `app/vite.config.js`
- Add `onnxruntime-web` as its own manual chunk alongside the existing `ai-mediapipe` chunk, so the ~5 MB runtime isn't pulled into the main bundle.
- Ensure the onnxruntime-web WASM artefacts (`ort-wasm-simd-threaded.wasm`, etc.) are copied to the public output — `onnxruntime-web` ships them via its `dist/` folder; either use `vite-plugin-static-copy` (add as devDep) or set `ort.env.wasm.wasmPaths` to a CDN URL (e.g. `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19/dist/`). CDN path is simpler and sidesteps build complexity — prefer it for v1.
- Verify COOP/COEP headers are set in the dev server config (already needed for MediaPipe threading; confirm they exist).

---

## Explicitly out of scope

- Quantized INT8 InSPyReNet build (not published; self-quantization deferred).
- FP32 variant as a separate downloadable option (add later via `MODEL_REGISTRY`).
- Offering the model to Web Workers (MAIN_THREAD_TRANSFORMS handles this).
- Upgrading `@xenova/transformers` to v3 — not needed; using `onnxruntime-web` directly.
- Removing the unused `@imgly/background-removal` dep — separate cleanup task.
- Migrating existing `ai-remove-bg` recipes (MediaPipe transform is preserved unchanged).

---

## Critical files reference

| Path | Role |
|---|---|
| `app/src/engine/transforms/ai.js:126-261` | Existing `ai-remove-bg` — template for new transform |
| `app/src/engine/batch.js:33-74` | `MAIN_THREAD_TRANSFORMS` set |
| `app/src/engine/registry.js` | Transform registration API |
| `app/src/engine/bg-swap.js` | Reusable bg-fill compositing |
| `app/src/data/db.js:14` | `DB_VERSION` constant to bump |
| `app/src/data/assets.js:14-31` | `hashFile` (used only for optional post-hoc SHA-256 verification of downloaded bytes) |
| `app/src/main.js:11` | Screen registry (`SCREENS` map) |
| `app/index.html:67-142` | Left-hand nav markup |
| `app/src/screens/set.js` | Good template for a settings-like screen with scoped styles and cleanup |
| `app/src/utils/settings.js` | Not used here (settings are localStorage; model state lives in IDB) — pattern reference only |

---

## Verification

1. **Build & dev server:** `cd app && npm install && npm run dev`. Confirm dev server starts with COOP/COEP headers (open DevTools → Network → any asset → response headers). Confirm `crossOriginIsolated === true` in console.
2. **New nav item:** Navigate to `#mdl`; Model Manager screen renders with the InSPyReNet card in "Not downloaded" state.
3. **Download:** Click **Download**. Progress bar updates. After completion, status flips to "Downloaded (just now)" with the byte size. In DevTools → Application → IndexedDB → PicMachina → `models` store, confirm one record with an `ArrayBuffer` of ~199 MB.
4. **Reload persistence:** Hard-refresh. Model Manager still shows "Downloaded". Confirms IDB persistence works.
5. **Transform availability:** Open Node Editor, add a node, confirm **Remove BG (High Quality)** appears under **AI & Composition**.
6. **Run transform:** In the preview screen (`#pvw`), apply the new transform to a test image with a non-selfie subject (e.g., a product photo with complex edges). Confirm the output has a clean alpha channel. Side-by-side compare against `ai-remove-bg` on the same image — edges should be markedly sharper.
7. **WebGPU path:** Open DevTools console while running; expect a log line indicating `webgpu` EP selected. Inference time should be ~1–2 s on a WebGPU-capable browser.
8. **WASM fallback:** Disable WebGPU via `chrome://flags` or test on Safari (no WebGPU by default). Re-run — log line should show `wasm` EP, inference ~6–15 s, output still correct.
9. **Missing-model guard:** Delete the model from Model Manager, then try to run the transform. Console should log the warn message; image should pass through untouched (not crash).
10. **Re-download:** Click **Re-download**; progress bar restarts, new record replaces old, transform works again.
11. **Batch run:** Put the transform into a recipe and run a 3-image batch through `#set` → `#que`. Confirm all three process on the main thread without errors and produce correct alpha.
12. **DB migration:** Open the app with an existing DB at v4 (simulate by clearing `models` store only). Confirm `onupgradeneeded` creates the `models` store without data loss in other stores (`recipes`, `assets`, etc. — check in DevTools).