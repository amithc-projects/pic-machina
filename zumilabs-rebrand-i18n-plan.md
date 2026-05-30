# Plan: ZumiLabs Studio rebrand · File-manager integration · i18n

_Drafted from a read-only review of `pic-machina/app` (vanilla-JS Vite app, no React, no i18n library yet). No code changed._

## TL;DR of findings

1. **Rebrand is ~90% done already.** The product is called "Zumilabs Studio" in 111 places, but the canonical brand is **`ZumiLabs Studio`** (capital L) — only 1 occurrence is correct today. The real work is **casing normalization**, plus retiring the remaining 12 `PicMachina` references — _most of which are intentional legacy/back-compat hooks that must be preserved._
2. **The file manager is already embedded** — `<sidekick-manager>` is loaded in `index.html` and used in 3 screens. But the **latest** ux-file-manager build has since **renamed the element and its events**, so "integrating the latest" is a *breaking upgrade*, not a drop-in.
3. **i18n does not exist** and the app is **vanilla JS**, so `react-i18next` (what we used in ux-file-manager) does **not** apply. This is the largest piece: ~518 string-bearing lines across 26 screens + components + `index.html`. Needs a vanilla i18n layer and a phased rollout.

---

## Part 1 — Rebrand to "ZumiLabs Studio"

### 1a. Display-string casing (safe, mechanical)
- `Zumilabs Studio` → `ZumiLabs Studio` (111 occurrences across `src/`, `index.html`, `public/`).
- Check `index.html` meta: `<title>` already says "ZumiLabs Studio…" (good); `apple-mobile-web-app-title` = `ZumilabsStudio` and `og:title` = `Zumilabs Studio…` need fixing.
- Branding assets already exist at `branding/zumilabs-studio/` (icon, logo-horizontal/mono/stacked, preview.html) — verify they're wired into `public/` and `manifest.json`.

### 1b. `PicMachina` references — **handle with care, do NOT blanket-replace**
These are split into two groups:

**MUST preserve (legacy data compatibility) — leave as-is, they read old user data:**
- `src/data/db.js` — IndexedDB named `PicMachina`, plus the migration that opens/deletes the legacy `PicMachina` DB. Renaming breaks migration of existing users.
- `src/utils/backup.js` — reads `.PicMachina/` hidden marker dir and accepts `PicMachinaExport` checksum.
- `src/screens/lib.js` & `src/data/recipes.js` — accept legacy `PicMachinaRecipeBundle` bundle type.
- `src/screens/fld.js`, `src/data/folders.js` — detect legacy `.PicMachina/` folder marker.

> Action: keep the legacy *readers*, ensure all *writers* emit the new identifiers (`.zumilabs-studio/`, `ZumilabsStudioExport`, `ZumilabsStudioRecipeBundle`) — confirm writers were already migrated (they appear to be). Add a short code comment marking each legacy reader as "back-compat, do not remove."

**Verification:** `grep -rinE "pic[ -]?machina" src index.html public` should return only the documented back-compat readers.

---

## Part 2 — File-manager integration (reconcile the drift)

### Current state (working)
- `index.html` loads `/sidekick-manager.iife.js` (served from `app/public/`, dated May 19) + `/send-to-cloud.js`.
- Used in **3 screens** via `document.createElement('sidekick-manager')` / inline `<sidekick-manager>`:
  - `src/screens/set.js` (most complete integration)
  - `src/screens/bld.js`
  - `src/screens/ned.js`
- Integration contract relied upon:
  - **Attributes:** `no-hash-routing`, `allowed-types`, (compare-mode="transform" workspace)
  - **Methods:** `getDirectoryHandle()`, `setRoot(handle)`, `navigate(path)`
  - **Events:** `sidekick:ready`, `sidekick:selection`, `sidekick:workspace`, `sidekick:file-focus`, `sidekick:action`, `sidekick:error`

### The drift (breaking)
The latest `ux-file-manager` build:
- Registers **`<zumilabs-file-browser>`** (not `<sidekick-manager>`).
- Emits **`filebrowser:*`** events (not `sidekick:*`) — e.g. `filebrowser:ready`, `filebrowser:selection`.
- Still exposes `getDirectoryHandle()` / `setRoot()` / `navigate()` and the same attributes (`no-hash-routing`, `allowed-types`, plus new `lang`, `force-theme`, `disable-office-viewer`, `hide-inspector`).
- Now also internationalized (the work we just shipped) and outputs `zumilabs-file-browser.iife.js`.

### Approach — ✅ LOCKED: Option A (upgrade + adapt)
Concrete steps:
1. Rebuild ux-file-manager (`npm run build`) → produces `dist/zumilabs-file-browser.iife.js` (+ `dist/vendor/**` for docMentis/officeparser, and the send-to-cloud bundle).
2. Copy the new bundle (and required vendor files) into `app/public/`, replacing the old `sidekick-manager.iife.js`.
3. Update `index.html`: change the `<script src>` to `/zumilabs-file-browser.iife.js`; keep/verify the send-to-cloud script. (Confirm send-to-cloud bundle filename after its own rebrand.)
4. Update the **3 screens** (`set.js`, `bld.js`, `ned.js`):
   - Tag: `document.createElement('sidekick-manager')` / inline `<sidekick-manager>` → `zumilabs-file-browser`.
   - Events: `sidekick:ready|selection|workspace|file-focus|action|error` → `filebrowser:ready|selection|workspace|file-focus|action|error`. (Verify exact new names against `App.tsx` — confirmed `filebrowser:ready`, `filebrowser:selection`; check the rest match before swapping.)
   - Attributes/methods are unchanged (`no-hash-routing`, `allowed-types`, `getDirectoryHandle()`, `setRoot()`, `navigate()`); new optional `lang` attribute will be wired in Part 3.
5. Delete the stale duplicate `app/sidekick-manager.iife.js`.
6. Smoke-test all 3 screens (selection sync, workspace navigation, file focus, ready handshake).

> ⚠️ **Cross-repo follow-up (per D2):** `cx-tab-recorder-plus` also embeds the file manager via `<sidekick-manager>` + `sidekick:*`. Once the renamed bundle is published, apply the **same** tag/event migration there. Track as a separate task in that repo.

### Housekeeping
- Delete the stale duplicate `app/sidekick-manager.iife.js` (May 14) — only `public/` is served.

---

## Part 3 — Internationalization (i18n)

### Why it's different here
ux-file-manager is React → we used `react-i18next`. **pic-machina is vanilla JS** with template-literal `innerHTML` rendering across 26 screens. So:
- No `useTranslation()` hook model.
- Strings are baked into template literals returned by screen render functions.

### Architecture — ✅ LOCKED: i18next core
- Add deps to `app/package.json`: `i18next`, `i18next-browser-languagedetector`.
- `src/i18n/index.js` — `await i18next.use(LanguageDetector).init({ resources, fallbackLng: 'en', supportedLngs: ['en','de'], interpolation:{escapeValue:false}, detection:{ order:['localStorage','navigator'], lookupLocalStorage:'zl-fm-lang', caches:['localStorage'] } })`. Export `t` (bound), `changeLanguage()`, `SUPPORTED_LANGUAGES`.
- `src/i18n/locales/en.json` + `de.json` — mirror the key-namespacing convention from ux-file-manager: `screen.key`, `common.*`, plural via `_one`/`_other`, interpolation via `{{var}}`. (DE can start as a copy of EN and be translated in a pass.)
- **Bootstrap order:** `await` i18n init in `src/main.js` **before** the first screen render, so `t()` is reliable from the first paint.
- **Re-render on language change:** because screens render to `innerHTML` once, switching language must re-invoke the active screen's render. Hook `changeLanguage()` → re-render current route. Confirm the router/screen-mount mechanism in `src/main.js` supports a clean re-render (it appears screen functions are re-callable).
- **Language picker:** add to the settings/help UI; persist to `localStorage` (reuse the `zl-fm-lang` key so the embedded file manager and the host app share one language via the `lang` attribute).
- **Wire the file manager's own i18n:** pass `lang="<code>"` to `<zumilabs-file-browser>` so host + embedded FM stay in sync.

### Rollout (phased — this is the big one)
1. **Harness first:** build `src/i18n/`, the `t()` helper, the re-render-on-change hook, and the language picker. Prove it end-to-end on **one pilot screen** (suggest `hlp.js` or `set.js`).
2. **Extract screen-by-screen** (26 screens), same disciplined pattern we used in ux-file-manager: one screen per batch, keep keys namespaced by screen, leave decorative/technical strings alone, verify the app still renders after each.
3. **Components & utils:** `src/components/*`, `src/utils/dialogs.js`, `toast.js`, `info-modal.js`, etc.
4. **index.html** static strings + meta.
5. **Add a second locale** (e.g. `de.json`, matching the German we added to ux-file-manager) to validate the plumbing and catch layout overflow.

### Tooling to add (learned from ux-file-manager retro)
- A **key-validation script** (diff each locale's keys vs `en.json`) — vanilla JS has no compiler to catch missing keys, so this matters even more here.
- A quick **non-English smoke test** to catch layout overflow.

---

## Execution order
1. **Rebrand casing pass** (1a) — fast, low-risk baseline: `Zumilabs Studio` → `ZumiLabs Studio`, fix `index.html` meta, verify branding assets + manifest.
2. **PicMachina audit** (1b) — annotate back-compat readers, confirm writers emit new IDs. `grep` should leave only documented legacy readers.
3. **File-manager upgrade** (Part 2, Option A) — rebuild ux-file-manager, swap bundle into `app/public/`, update `index.html`, adapt the 3 screens to `<zumilabs-file-browser>` + `filebrowser:*`. Delete stale duplicate bundle. Smoke-test.
4. **i18n harness + pilot screen** (Part 3 step 1) — add deps, build `src/i18n/`, re-render-on-change hook, language picker, `lang` attr → file manager. Prove on one screen.
5. **i18n full rollout** (Part 3 steps 2–5) — all 26 screens + components/utils + index.html, screen-by-screen; add `de.json`; key-validation script + non-English smoke test.
6. **Cross-repo follow-up (D2)** — migrate `cx-tab-recorder-plus` to `<zumilabs-file-browser>` + `filebrowser:*` once the renamed bundle is published. (Separate task in that repo.)

## Add to project memory
Once the i18n approach is implemented, mirror the convention notes into `pic-machina`'s `CLAUDE.md` / `AGENTS.md` (as we did for ux-file-manager): i18next-core setup, `t()` usage in vanilla template-literal screens, re-render-on-`changeLanguage`, the 4-step "add a language" recipe, and the `zl-fm-lang` shared-language contract with the embedded file manager.

## Decisions (LOCKED)
- **D1 — File-manager upgrade approach: ✅ Option A — upgrade + adapt.** Rebuild ux-file-manager, swap in the new bundle, adapt the 3 screens to the new tag + `filebrowser:*` events.
- **D2 — Canonical element name: ✅ `zumilabs-file-browser` everywhere.** Migrate both pic-machina **and** cx-tab-recorder-plus to the new tag; retire `<sidekick-manager>`. One bundle, one contract across all consumers.
- **D3 — i18n engine: ✅ i18next core** (standalone, no React adapter). Chosen for catalog-format consistency with ux-file-manager + cx-tab-recorder-plus, free CLDR pluralization for future locales, and `i18next-browser-languagedetector` reuse (`localStorage` key `zl-fm-lang`). Cost: one `await i18next.init(...)` in `main.js` bootstrap.
- **D4 — Locales: ✅ EN + DE** (match ux-file-manager; DE also validates the plumbing).
- **D5 — i18n scope: ✅ all 26 screens** (plus components, utils, index.html). Still rolled out screen-by-screen in batches, but the target is full coverage, not a pilot subset.

### Consequences of these decisions (added to the execution plan)
- **D2 ripple → cx-tab-recorder-plus:** after standardizing the element name, cx-tab-recorder-plus must also be updated (its embedded bundle + any `<sidekick-manager>` / `sidekick:*` references). Track as a follow-up task in that repo once ux-file-manager publishes the renamed bundle.
- **ux-file-manager already registers `<zumilabs-file-browser>` and emits `filebrowser:*`** — so no upstream change is needed there for D2; it's the *consumers* (pic-machina, cx-tab-recorder-plus) that move.
- **D3 dependency:** add `i18next` + `i18next-browser-languagedetector` to `app/package.json`. Init in `src/i18n/index.js`; gate first screen render on init resolving.
