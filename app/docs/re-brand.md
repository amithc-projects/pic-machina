# Rebrand Plan: Pic-Machina → ZumiLabs

## 1. Code references (~110 hits across ~50 files)

Most src files contain just **1 reference** (banner comments like `* PicMachina — module name`). The substantive ones:

### High-impact (functional)
- **app/src/data/db.js:14** — `DB_NAME = 'PicMachina'` (IndexedDB name). **Migration required** (see §2).
- **app/src/utils/backup.js** — 7 hits. The string `'PicMachinaExport'` is the **checksum/magic value** in JSON backup files (lines 87, 110, 150). Also `.PicMachina/` shadow directory (line 25) and download filename `PicMachina_Backup_*.json` (line 134). Renaming the checksum will **break import of all existing user backups** unless you accept both.
- **app/src/data/folders.js** — 8 hits. `.PicMachina/` is the **marker directory** dropped into output folders to identify PicMachina-produced output (controls archive visibility in the folder browser). Also the export function `hasPicMachinaMarker()`.
- **app/src/engine/batch.js** — 5 hits. Writes `.PicMachina/` sidecar folder in every output (line 286, 888). This is the same marker as above — coupled with folders.js.
- **app/src/screens/fld.js** — uses `hasPicMachinaMarker`, `isPicMachinaFolder` flag, and downloads zip as `picmachina-export.zip`.
- **app/public/sw.js:16** — `CACHE_NAME = 'picmachina-shell-v1'`. Bump to a Zumi cache name; old cache will be cleaned up by the existing activate-handler.
- **app/public/manifest.json** — `name`, `short_name`, screenshot label. PWA install identity changes.
- **app/index.html** — 7 hits: `apple-mobile-web-app-title`, OG/Twitter URLs (`picmachina.netlify.app`), titles, social image paths. SEO + social cards affected; deploy URL is a separate hosting concern.
- **app/package.json** — `"name": "PicMachina"`.
- **app/src/main.js:71** — user-facing toast: "requires a Pic-Machina Pro license".

### User-facing copy (mechanical rename)
- **app/src/screens/get.js** (7), **pow.js** (7), **fld.js** (12), marketing/landing copy. Pure text.
- **app/src/engine/batch.js:795** — Notification title `"PicMachina Batch Complete"`.

### Schemas / data formats
- **app/docs/sidecar.schema.json** — `"title": "Pic-Machina Image Sidecar"`, descriptions reference Pic-Machina. Sidecars are written alongside user images. Renaming descriptions is safe; no `const`/enum value depends on the brand.
- **app/docs/recipe-bundle-schema.json** — has `"const": "PicMachinaRecipeBundle"` discriminator. **Renaming this constant breaks reading existing exported recipe bundles** unless you accept both old and new values.
- `sidecar.schema.json` at repo root and `app/translated-subtitles-recipe.json`, `app/eval.html`, `app/getting-started-page-designed-by-claude.html` — auxiliary.

### Comments / banner headers
~30 files have a single header comment referencing PicMachina — purely cosmetic.

## 2. Persistent data / storage migration

| Surface | Key/Name | Migration concern |
|---|---|---|
| **IndexedDB** | `PicMachina` (db.js:14) | Renaming creates a fresh empty DB for every existing user. **Must write a one-time migration**: open old DB, copy stores into new, delete old. Or keep `DB_NAME` unchanged (recommended — internal, invisible). |
| **localStorage** | `ic-*` prefix (theme, view modes, run-params, global-settings, etc.) | None reference the brand. Safe — no migration needed. |
| **sessionStorage** | `lib-tag-filter-open` | Brand-free. Safe. |
| **Service Worker cache** | `picmachina-shell-v1` (sw.js:16) | Existing activate handler deletes non-matching caches, so a rename auto-evicts old cache on next activation. Safe. |
| **PWA manifest identity** | `name`/`short_name` change | Existing installed PWAs may show old name until reinstalled; Chrome can treat as same app since `start_url` is unchanged. Acceptable. |
| **File-system shadow backups** | `.PicMachina/` dir inside user-chosen folders (backup.js:25) | Users have these folders on disk now. If you rename to `.ZumiLabs/`, **`hasPicMachinaMarker` won't recognise existing output folders** → archives stop appearing in the browser; new shadows duplicate alongside the old. Recommended: check for **either** marker, write the new one. |
| **Output sidecar marker** | `.PicMachina/` written by batch.js:286 | Same as above — couple the two. |
| **JSON backup files** | `checksum: 'PicMachinaExport'` (backup.js:150) | Hard fail on import of old backups if value changes. **Accept both old and new** on import; write new on export. |
| **Recipe bundle exports** | `type: "PicMachinaRecipeBundle"` in recipe-bundle-schema.json | If validated anywhere, accept both values for backward compatibility. |
| **Backup filename** | `PicMachina_Backup_YYYY-MM-DD.json` | Cosmetic; doesn't affect import. |

## 3. External / non-code

- **Domain**: `picmachina.netlify.app` referenced in OG/Twitter tags. New deploy URL needed; redirect old → new for SEO.
- **Social/branding assets**: `public/branding/brand-pack/...` already updated (icons, logos modified). Open-graph/twitter-card images referenced in index.html should be regenerated.
- **README / docs**: `roadmap-pwa.md`, `VIDEO_ROADMAP.md`, `implementation_plan.md`, `.ai-enhancenments.md` — text only.

## 4. Recommended approach

1. **Keep internal identifiers stable** where users won't see them: `DB_NAME='PicMachina'`, `.PicMachina/` marker, backup checksum. Renaming these forces data migration with no user benefit.
2. **If you must rename them**, build a compatibility layer:
   - DB: open-and-copy migration on first run.
   - Marker dir: probe for both `.PicMachina` and `.ZumiLabs`; write new.
   - Backup checksum: accept both on import; write new on export.
   - Recipe bundle `type` const: accept both.
3. **Rename freely** (no migration): all UI copy, comments, package name, manifest, HTML metadata, SW cache, notification titles, schema titles/descriptions, download filenames.
4. **Watch out**: ~30 single-line banner comments — easy mass replace, but verify the Notification API permission flow still works after the title change (cosmetic only).

## 5. Rough effort

- Mechanical rename of UI/comments/branding: **~1 hour** with sed + review.
- Compatibility shims for marker dir + backup checksum + recipe-bundle const: **~2-3 hours** including tests.
- IndexedDB rename + migration (if pursued): **~half day** including verifying no data loss across schema versions.
- Total: **half-day** if you keep internal identifiers; **1-1.5 days** for a full rename with migrations.

---

# Manual Migration Steps (one-time, per user)

Do these **before** deploying the rebrand, or have users run them once after.

## 1. IndexedDB rename (`PicMachina` → `ZumiLabs`)

Easiest path: **export, rename, import**.

1. In the current app (still branded PicMachina), open **Settings → Backup → Export** to download `PicMachina_Backup_YYYY-MM-DD.json`.
2. Deploy the rebrand (with `DB_NAME='ZumiLabs'`).
3. In the new app, **Settings → Backup → Import** and select the file.
4. Once verified, delete the old DB: open DevTools → Application → IndexedDB → right-click `PicMachina` → Delete.

> If you want zero user action: keep `DB_NAME='PicMachina'`. It's invisible.

## 2. Backup file checksum (`PicMachinaExport`)

If you exported in step 1 above, edit the JSON before re-importing:

```
"checksum": "PicMachinaExport"  →  "checksum": "ZumiLabsExport"
```

Or, simpler: in `backup.js:150` accept both values on import (one-line change), then no edit needed.

## 3. Output folder marker (`.PicMachina/`)

For each folder on disk that contains PicMachina-produced output (zips, pptx, sidecars):

```bash
# macOS / Linux — from a parent folder
find . -type d -name ".PicMachina" -execdir mv {} .ZumiLabs \;
```

```powershell
# Windows PowerShell
Get-ChildItem -Recurse -Force -Directory -Filter ".PicMachina" |
  ForEach-Object { Rename-Item $_.FullName ".ZumiLabs" }
```

> Alternative: have `hasPicMachinaMarker()` probe for **both** names and write the new one. No filesystem work needed.

## 4. Recipe bundle constant (`PicMachinaRecipeBundle`)

If you have exported `.json` recipe bundles on disk, find/replace:

```bash
grep -rl '"PicMachinaRecipeBundle"' /path/to/recipes |
  xargs sed -i '' 's/PicMachinaRecipeBundle/ZumiLabsRecipeBundle/g'
```

> Or accept both values wherever the const is read.

## 5. Service Worker cache

Nothing to do — the existing activate handler in `sw.js` already deletes caches that don't match `CACHE_NAME`, so bumping to `zumilabs-shell-v1` self-cleans on first load after deploy.

## 6. localStorage / sessionStorage

Nothing to do — all keys use the brand-free `ic-*` prefix.

## 7. PWA reinstall

For users who installed PicMachina as a PWA: uninstall the old icon, reinstall from the new manifest. Functionally equivalent; cosmetic only.

---

**Minimal-pain summary**: skip steps 1, 2, 4 by leaving the three internal identifiers (`DB_NAME`, backup checksum, recipe-bundle const) unchanged. Only step 3 (folder marker) and step 7 (PWA) involve anything on the user's machine, and step 3 is optional if you make the marker check accept both.
