# Plan: Image Sidecar Metadata System

## Overview

A `.json` sidecar file stored alongside each image (e.g. `photo.jpg` → `photo.jpg.json`)
that persists everything the app knows or the user has annotated about that image. Sidecars
survive re-processing, are human-readable, and integrate with the recipe/transform variable
system so recipe steps can branch or label based on sidecar values.

---

## Sidecar File Schema (v1)

```json
{
  "$version": 1,
  "source": {
    "filename": "photo.jpg",
    "sha256": "abc123…",
    "sizeBytes": 4200000
  },
  "exif": {
    "cameraMake": "Sony",
    "cameraModel": "A7R V",
    "focalLength": 85,
    "aperture": 1.8,
    "iso": 400,
    "shutterSpeed": "1/500",
    "dateTaken": "2024-03-15T10:23:00Z",
    "gpsLat": 51.5074,
    "gpsLng": -0.1278,
    "gpsAltitude": 12
  },
  "geo": {
    "city": "London",
    "country": "United Kingdom",
    "region": "England",
    "countryCode": "GB"
  },
  "annotation": {
    "rating": 4,
    "flag": "pick",
    "tags": ["portrait", "client-abc", "selects"],
    "caption": "Final hero shot"
  },
  "computed": {
    "sharpnessScore": 78,
    "blurLabel": "Sharp",
    "bgRemoved": { "model": "inspyrenet-swinb-fp16", "at": "2024-03-15T11:00:00Z" }
  },
  "processing": [
    {
      "recipe": "Portrait Pack",
      "recipeId": "rec_abc123",
      "at": "2024-03-15T11:00:00Z",
      "output": "output/photo.jpg"
    }
  ]
}
```

### Field tiers

| Tier | Fields | Editable by user |
|---|---|---|
| `source` | filename, sha256, sizeBytes | No — set on first write |
| `exif` | All EXIF fields mirrored from image | No — read-only mirror |
| `geo` | city, country, region, countryCode | **Yes** — derived from GPS but user-editable |
| `annotation` | rating, flag, tags, caption | **Yes** — fully user-editable |
| `computed` | sharpnessScore, blurLabel, bgRemoved, etc. | No — written by transforms |
| `processing` | Array of processing run records | No — append-only log |

### `annotation.flag` values
`"pick"` | `"reject"` | `null` (unflagged)

### `annotation.rating` values
`1`–`5` or `null` (unrated)

---

## Geo Reverse-Geocoding

GPS lat/lng → city/country lookup happens **lazily** the first time the sidecar panel is
opened for an image that has GPS EXIF but no `geo` block yet.

**API**: Nominatim (`https://nominatim.openstreetmap.org/reverse`) — free, no key required.
Rate-limit: 1 req/s; a simple in-memory debounce queue handles this.

The `geo` block is pre-populated from the API result but all four fields (`city`, `country`,
`region`, `countryCode`) remain **user-editable** in the drawer. The user saves explicitly;
no auto-save on geocode.

---

## Variable Integration

Sidecar fields are exposed to the transform/recipe variable system with the `sidecar.` prefix:

```
{{sidecar.annotation.rating}}
{{sidecar.annotation.tags}}         ← comma-joined string
{{sidecar.annotation.caption}}
{{sidecar.annotation.flag}}
{{sidecar.geo.city}}
{{sidecar.geo.country}}
{{sidecar.geo.countryCode}}
{{sidecar.exif.cameraMake}}
{{sidecar.exif.dateTaken}}
{{sidecar.computed.blurLabel}}
{{sidecar.computed.sharpnessScore}}
```

Flat dotted paths. Any field in the schema is accessible. Transforms can also **write**
to `sidecar.computed.*` via a new `meta-sidecar-write` transform (see D3 below).

Conditional branch support — example:
- `sidecar.annotation.rating gte 4` → route to `selects/` subfolder
- `sidecar.geo.country eq "France"` → apply French watermark overlay
- `sidecar.annotation.flag eq "reject"` → skip processing (flow-skip)

---

## UI: Right-Hand Drawer in `#fld`

### Trigger

A small **ⓘ** info button appears on each thumbnail on hover (top-right corner).
Clicking it opens the sidecar drawer **without navigating away** from the grid.
The drawer can also be opened from the preview screen (`#pvw`) via a toolbar button.

When the drawer is open, left/right arrow keys (or prev/next buttons in the drawer header)
advance through images without closing the drawer.

### Drawer layout

```
┌─────────────────────────────────────────────┐
│  ← ▶ photo.jpg                    [×]       │  ← header: prev/next, filename, close
├─────────────────────────────────────────────┤
│  ★ ★ ★ ★ ☆    [Pick] [Reject] [Unflag]      │  ← rating + flag row
├─────────────────────────────────────────────┤
│  Tags                                        │
│  [portrait ×] [client-abc ×] [+]            │  ← chip input with autocomplete
├─────────────────────────────────────────────┤
│  Caption                                     │
│  ┌──────────────────────────────────────┐   │
│  │ Final hero shot                      │   │
│  └──────────────────────────────────────┘   │
├─────────────────────────────────────────────┤
│  ▼ Location                                  │
│  City       [London              ]           │
│  Region     [England             ]           │
│  Country    [United Kingdom      ]           │
│  Code       [GB                  ]           │
│  GPS        51.5074, -0.1278  (read-only)   │
├─────────────────────────────────────────────┤
│  ▼ Camera                        (readonly) │
│  Sony A7R V · 85mm · f/1.8 · 1/500 · ISO400 │
│  2024-03-15 10:23                            │
├─────────────────────────────────────────────┤
│  ▼ Computed                      (readonly) │
│  Sharpness  78 (Sharp)                       │
│  BG Removed  ✓ inspyrenet · 15 Mar 2024      │
├─────────────────────────────────────────────┤
│  ▼ Processing log                (readonly) │
│  Portrait Pack · 15 Mar 2024 · output/…      │
├─────────────────────────────────────────────┤
│              [Cancel]  [Save sidecar]        │  ← explicit save only
└─────────────────────────────────────────────┘
```

### Tag input UX
- Chips rendered inline; click `×` to remove
- Type in the chip input → dropdown hints showing tags used on **other** images in the
  current folder (sourced by scanning `*.json` sidecars in the folder at drawer open time)
- Press `Enter` or `,` to confirm a new tag
- Tags are stored lowercase, trimmed

### Save behaviour
- Sidecar is **only created/written** when the user clicks **"Save sidecar"**
- If no sidecar exists yet, saving creates `photo.jpg.json` in the **same folder** as the image
- If the image is in a read-only location, show a toast error
- After save: toast "Sidecar saved · photo.jpg.json"

### EXIF write-back
On save, if `annotation` fields have changed, optionally write back to the JPEG headers:
- `annotation.caption` → EXIF `ImageDescription` + IPTC `Caption`
- `annotation.tags` → IPTC `Keywords`
- `annotation.rating` → XMP `xmp:Rating`

Uses `piexifjs` (already in the dependency tree). Write-back is **opt-in** — a checkbox
"Also write to image EXIF" in the drawer footer (default: on). Does not apply to RAW files.

---

## Variable Autocomplete in Step Editor

When the user types `{{sidecar.` in any param text field in the node editor (`#ned`), a
dropdown appears showing all known sidecar keys. "Known keys" are sourced from:

1. The static schema (always available): all `exif.*`, `geo.*`, `annotation.*`, `computed.*` paths
2. Any sidecar file found in the **currently selected input folder** (scanned lazily)

The autocomplete dropdown shows `key → current value` for the active test image (if one is
loaded in the preview), making it easy to verify the right field is targeted.

This integrates with the existing `{{variable}}` autocomplete system in `param-fields.js`.

---

## New Files

### 1. `app/src/data/sidecar.js`

Core read/write module. Uses the **File System Access API** (`FileSystemDirectoryHandle`)
to read/write `.json` files alongside images.

```js
export async function readSidecar(dirHandle, filename)     // → parsed object | null
export async function writeSidecar(dirHandle, filename, data) // → void
export async function listSidecarTags(dirHandle)           // → string[] (deduped, sorted)
export async function reverseGeocode(lat, lng)             // → { city, country, region, countryCode }
export function flattenSidecarVars(sidecar)                // → Map<string, string> for variable substitution
export function buildSidecarPatch(existing, formValues)    // → merged sidecar object
```

### 2. `app/src/components/sidecar-drawer.js`

Self-contained drawer component.

```js
export class SidecarDrawer {
  constructor(container, { dirHandle, onSaved })
  open(file)       // open for a specific File object
  close()
  next()           // advance to next image (caller provides file list)
  prev()
}
```

Injects its own scoped `<style>` tag on first use. Mounts as a fixed right-side panel
(width 320px, z-index above grid, with overlay backdrop on mobile).

### 3. `app/src/screens/fld.js` (modify)

- Import `SidecarDrawer`
- Add ⓘ hover button to each thumbnail
- Instantiate drawer, pass current `dirHandle`
- On drawer `onSaved`: refresh thumbnail badge (e.g. show star rating overlay)

---

## Modified Files

| File | Change |
|---|---|
| `app/src/data/sidecar.js` | **Create** |
| `app/src/components/sidecar-drawer.js` | **Create** |
| `app/src/screens/fld.js` | Add ⓘ button on thumbnails, mount `SidecarDrawer` |
| `app/src/screens/pvw.js` | Add toolbar ⓘ button to open drawer for current image |
| `app/src/engine/processor.js` | In `resolveVariable()`, handle `sidecar.*` prefix by reading from context |
| `app/src/engine/batch.js` | On each file, read sidecar from `dirHandle`, add `sidecar` object to processor context |
| `app/src/utils/param-fields.js` | Extend `{{variable}}` autocomplete to offer `sidecar.*` completions |
| `app/src/components/ned-node.js` (or ned.js) | Pass known sidecar keys to autocomplete |
| `app/src/engine/transforms/metadata.js` | Add `meta-sidecar-write` transform (write arbitrary key to `sidecar.computed`) |

---

## New Transform: `meta-sidecar-write`

Allows a recipe step to write a computed value into the sidecar's `computed` block,
so it persists for future runs.

```
id:       meta-sidecar-write
name:     Write Sidecar Field
category: Metadata
icon:     edit_note

params:
  key    (text)  — field name under sidecar.computed, e.g. "myScore"
  value  (text)  — value to write; supports {{variables}}
```

During batch processing the processor accumulates writes; after the image is processed,
`batch.js` flushes the updated sidecar back to disk.

---

## Batch Processing Integration

`batch.js` flow per image:

1. `const sidecar = await readSidecar(dirHandle, file.name) ?? {}`
2. Inject `sidecar` object into processor context
3. `flattenSidecarVars(sidecar)` → merge into variable map so `{{sidecar.*}}` resolves
4. Process all nodes (transforms may append to `context.sidecarWrites`)
5. After processing: if `context.sidecarWrites` has entries, merge and call `writeSidecar()`

Note: sidecar writes during batch are **only** to `computed` fields — `annotation` fields
are never touched by automated processing, preserving user intent.

---

## Folder View Thumbnail Badges

After sidecars are loaded (lazily, in a background pass), thumbnails get small overlay badges:

- **★ n** — amber star count if rated
- **P** — green chip if flagged pick
- **R** — red chip if flagged reject

These are cosmetic only and don't affect batch selection.

---

## `#pvw` Integration

The preview screen already has a toolbar. Add an **ⓘ** button that opens the `SidecarDrawer`
for the currently previewed image. The drawer mounts as an overlay panel rather than
narrowing the preview canvas.

In the "step scrubber" / result view, add a **Variables** tab alongside the EXIF tab
(if one exists) showing all resolved `sidecar.*` values for the loaded image.

---

## Verification Checklist

1. **No sidecar exists** → open drawer → all fields empty → click Cancel → no file created
2. **Fill annotation fields** → click Save → `photo.jpg.json` appears in OS Finder next to image
3. **Re-open drawer** → previously saved values pre-populated
4. **GPS present in EXIF** → opening drawer triggers reverse-geocode → city/country pre-filled
5. **Edit city manually** → save → `geo.city` in JSON reflects manual value (not API value)
6. **Tags autocomplete** → type partial tag → dropdown shows tags from other images in folder
7. **Variable in recipe step** → `{{sidecar.geo.city}}` resolves to the saved city during batch
8. **Conditional branch** → `sidecar.annotation.rating gte 4` routes correctly
9. **Star rating display** → rated image shows ★ overlay on thumbnail in `#fld` grid
10. **EXIF write-back** → after save with "write to EXIF" checked, open image in another app → caption/keywords present
11. **Batch sidecar write** → run `meta-sidecar-write` step → after batch, `.json` contains new `computed` field
12. **Read-only folder** → attempt save → toast error, no crash
13. **RAW file** → EXIF write-back checkbox disabled/greyed, JSON sidecar still saves fine

---

## Out of Scope (for now)

- XMP sidecar format (`.xmp`) — JSON only for v1
- Bulk tag editing across multiple selected images
- Sidecar search / filter in `#fld` (e.g. "show only 5-star picks")
- Cloud sync of sidecars
- Import from Lightroom XMP sidecars
