# AI Assisted Features in InSPyReNet

Roadmap for features that can reuse the InSPyReNet SwinB model shipped in
[PR #6](https://github.com/amithc-projects/pic-machina/pull/6). The model
produces a 0–1 saliency matte — "where is the subject?" — which is a
reusable primitive for far more than background removal.

## Status

| Phase | Feature | PR | Status |
|---|---|---|---|
| 1 | Shared refactor — split `runInspyrenet`, mask cache, bbox persistence | [#7](https://github.com/amithc-projects/pic-machina/pull/7) | ✅ Shipped |
| 2 | Portrait Bokeh — `ai-portrait-bokeh` | [#7](https://github.com/amithc-projects/pic-machina/pull/7) | ✅ Shipped |
| 3 | Subject-Aware Cropping — `ai-subject-crop` | [#8](https://github.com/amithc-projects/pic-machina/pull/8) | ✅ Shipped |
| 4 | Drop Shadow + Sticker Outline — `ai-drop-shadow`, `ai-sticker-outline` | [#9](https://github.com/amithc-projects/pic-machina/pull/9) | ✅ Shipped |
| 5 | Selective Color Grade + Subject Vignette + Sharpen | *(local)* | ✅ Shipped |
| 6 | Template Aggregator `isolateSubject` | — | 📋 Planned |
| 7 | Content-Aware Thumbnails | — | 📋 Planned |

Current integration lives at:
- `app/src/data/models.js` — model registry + IDB blob storage
- `app/src/engine/ai/inspyrenet.js` — ORT session (WebGPU / WASM), inference
- `app/src/engine/transforms/ai.js` — `ai-remove-bg-hq` transform
- `app/src/screens/mdl.js` — Model Manager screen (`#mdl`)

---

## Shared Refactor (prerequisite) — ✅ Shipped in #7

Every feature below wants the **raw saliency matte**, not the finished "alpha
channel replaced" canvas. One small refactor upfront makes the rest cheap:

**In `app/src/engine/ai/inspyrenet.js`:**

1. Split `runInspyrenet` into two exports:
   - `getSaliencyMask(canvas, { size? }) → { mask: Uint8ClampedArray, width, height }`
   - `applyMaskAsAlpha(ctx, mask, { mode, edgeSmoothing })` (the current alpha
     write-back logic)
2. Add an in-memory **last-mask cache** keyed by a cheap canvas signature
   (dimensions + corner pixel sample + hash of a 16×16 downsample).
   Invalidate on dimension change or signature mismatch.
3. When multiple saliency-using transforms run in sequence on the same
   image, inference happens **once** per image instead of once per transform.

This turns every feature below from "+1–2 s per transform" into "+1–2 s per
image, no matter how many saliency transforms are stacked."

Also expose on the asset record (via `patchAsset(hash, { vision: {...} })`):
- `vision.subjectBBox` — `{ x, y, w, h }` in source pixels
- `vision.subjectArea` — % of frame above threshold
- `vision.subjectCentroid` — `{ x, y }`
- `vision.matteAt` — timestamp

So batch re-runs with different params read the bbox back instead of
re-running inference.

---

## 1. Subject-Aware Cropping — `ai-subject-crop` — ✅ Shipped in #8

**Module:** `app/src/engine/transforms/geometry.js`

Crops to a target aspect ratio while keeping the subject composed correctly.
Fills the gap between `geo-face-crop` (people only) and the `smartcrop`
heuristic dep (no semantic understanding).

**Params:**
| name | type | default | notes |
|---|---|---|---|
| aspectRatio | select | `original` | `1:1`, `4:5`, `3:4`, `4:3`, `16:9`, `9:16`, `custom` |
| customRatio | text | `1.618` | shown when `aspectRatio=custom` |
| padding | range 0–50 | 10 | % of subject bbox, not image |
| anchor | select | `center` | `center`, `thirds-tl/tr/bl/br`, `top`, `bottom` |
| zoomMode | select | `fit` | `fit` / `fill` / `pad` |
| threshold | range 10–90 | 50 | matte confidence % for bbox |

**Algorithm:**
1. Get matte → compute bbox from `mask[i] > threshold`.
2. Inflate bbox by `padding`% of its own dimensions.
3. Fit target aspect: largest rectangle of requested ratio containing the
   inflated bbox, clamped to image bounds.
4. Slide rectangle so subject centroid lands on `anchor` point.
5. Apply crop; preserve source resolution unless `zoomMode=fit` downscales.

**Graceful fallback:** if model is not downloaded, log `console.info` and
use existing `smartcrop` behavior. Document-type assets should stay on
`smartcrop` (saliency is trained on photographic subjects).

**Unlocks:**
- Content-aware thumbnails (§2) are `ai-subject-crop` with fixed params.
- Template aggregator gets per-slot smart fitting.
- Social-media batch recipes: 1:1 + 9:16 + 16:9 from one source, all three
  share the cached bbox.

---

## 2. Content-Aware Thumbnails

**Module:** new `app/src/utils/thumbnails.js`


