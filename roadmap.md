# PicMachina — Product Roadmap

## Architecture

Client-side only (Chrome/Edge 86+). Vanilla JS ES modules + Vite. Dark Pro Studio theme.

The file browser / media library is powered by the **`<sidekick-manager>` web component** from [ux-file-manager](../ux-file-manager). Each screen that needs a file picker embeds this component and communicates via DOM events and imperative properties. See [INTEGRATION_GUIDE](../ux-file-manager/INTEGRATION_GUIDE.md).

---

## Screens

| Abbr | Screen | Status |
|------|--------|--------|
| FLD | Folder / Library view | ✅ migrated to sidekick-manager |
| SET | Batch Setup | ✅ migrated to sidekick-manager |
| NED | Node Editor (transform compare) | 🔲 pending sidekick migration |
| BLD | Recipe Builder (transform compare + custom toolbar) | 🔲 pending sidekick migration |
| LIB | Recipe Library | ✅ stable |
| BKB | Block Builder | ✅ stable |
| INS | Block Inspector | ✅ stable |
| PVW | Recipe Preview | ✅ stable |
| QUE | Processing Queue | ✅ stable |
| OUT | Output Browser | ✅ stable |
| CMP | Comparison View | ✅ stable |

---

## Sidecar Format

Sidecars use **dot-prefix naming** (aligned with ux-file-manager): `.{filename}`

Example: `photo.jpg` → `.photo.jpg.json`

The sidecar JSON schema:

```json
{
  "$version": 2,
  "annotation": {
    "rating": 4,
    "flag": "pick",
    "tags": ["portrait", "selects"],
    "caption": "Final hero shot",
    "title": "My title"
  },
  "geo": {
    "city": "London",
    "country": "United Kingdom",
    "region": "England",
    "countryCode": "GB"
  },
  "exif": { "...": "read-only EXIF mirror" },
  "computed": { "...": "written by transforms" },
  "processing": [ "...append-only processing log" ]
}
```

**Migration**: Existing `filename.json` sidecars (v1 format) are renamed to `.filename` on folder open via a one-time idempotent migration in `fld.js`.

---

## Remaining Work: Phase 3 — Sidekick Migration

### Phase 3C — ned.js (transform compare + video scrubber)

- Set `compare-mode="transform"` on `<sidekick-manager>`
- Pass `compareRender` async callback: `async (file) => { beforeUrl, afterUrl }`
- Pass `compareInfo` callback for the info button
- Mount video scrubber UI in ned.js host
- Call `sk.triggerProcess()` when scrub position changes

### Phase 3D — bld.js (transform compare + custom toolbar)

- Set `compare-mode="transform"`
- Pass `compareControls` HTML string ("Original / Prev Step" buttons)
- Pass `compareBindControls` to wire button click → state update + `triggerProcess()`
- Pass `compareRender` and `compareInfo` callbacks

---

## Remaining Work: FLD enhancements

- `sidekick:file-focus` event → drive the right-hand EXIF / sidecar panel
- Thumbnail badge overlays (★ rating, Pick/Reject flag) sourced from sidecar

---

## Out of Scope (handled by sidekick-manager)

The following are fully provided by the embedded `<sidekick-manager>` component and do not need custom code in pic-machina screens:

- File grid / filmstrip / list views
- Thumbnail generation and persistence
- Folder navigation, breadcrumb, bookmarks, collection
- Multi-select, search, sort, type filters
- Copy / move / delete (with sidecar pairing)
- Properties panel (hidden via `hide-inspector` in screens that have their own panel)
