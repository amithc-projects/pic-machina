# Tier 3 — E2E Smoke Tests

**Tool**: Playwright (Chromium)  
**File location**: `tests/e2e/`  
**Run command**: `npx playwright test`  
**Config**: `playwright.config.ts` — headless Chromium, localhost dev server  
**Notes**:
- These tests only verify critical paths do not catastrophically break.
- They do NOT validate AI output quality or visual appearance.
- Each test is independent — runs in a fresh browser context (isolated IndexedDB).
- App must be running at `http://localhost:5173` (or whatever `vite dev` uses).
- Some tests interact with FSA (File System Access API) — use Playwright's `page.route` or special Chromium CDP commands to provide mock directory handles where needed.

---

## App Initialisation

### E2E-001
- **Title**: App loads without JavaScript errors
- **Description**: The most fundamental smoke test — the app must boot cleanly.
- **Test Data**: None
- **Steps**:
  1. Open `http://localhost:5173`
  2. Wait for the main container to be visible (e.g. `[data-testid="app-root"]` or the navigation)
  3. Collect browser console errors
  4. Assert no `console.error` calls
- **Expected Result**: Page loads; main navigation visible; zero console errors

### E2E-002
- **Title**: App displays the library/home screen by default
- **Description**: On first load, the user should see the Library screen (or equivalent landing screen).
- **Steps**:
  1. Navigate to app root
  2. Wait for page load
  3. Assert `#lib` or `#fld` hash in URL, or the library heading is visible
- **Expected Result**: Library or Folder screen is displayed

---

## Folder / Project Management (fld.js)

### E2E-003
- **Title**: Folder screen loads and prompts for input folder selection
- **Steps**:
  1. Navigate to `#fld`
  2. Wait for the folder selection UI to appear
  3. Assert the "Select Input Folder" button is visible
- **Expected Result**: Folder selection button rendered; no crashes

---

## Recipe Editor — NED screen (ned.js)

### E2E-004
- **Title**: Node editor (NED) screen loads with empty state
- **Steps**:
  1. Navigate to `#ned`
  2. Wait for the recipe editor container
  3. Assert the "Add Transform" or recipe toolbar is visible
- **Expected Result**: NED screen renders; recipe tool area visible

### E2E-005
- **Title**: Recipe list screen loads and shows system recipes
- **Steps**:
  1. Navigate to `#lib` (recipe library)
  2. Wait for recipe cards to render
  3. Count visible recipe cards
- **Expected Result**: At least one recipe card visible (system recipes are seeded on startup)

### E2E-006
- **Title**: Creating a new recipe opens the NED editor
- **Steps**:
  1. Navigate to `#lib`
  2. Click "New Recipe" (or equivalent create button)
  3. Wait for navigation to `#ned`
  4. Assert the recipe editor title area is present
- **Expected Result**: URL changes to `#ned`; editor UI visible

---

## Batch Run — Build screen (bld.js)

### E2E-007
- **Title**: Build screen loads and shows recipe selection
- **Steps**:
  1. Navigate to `#bld`
  2. Wait for the build configuration UI
  3. Assert recipe picker and run button are visible
- **Expected Result**: Build screen renders without errors

---

## Queue / Progress screen (que.js)

### E2E-008
- **Title**: Queue screen loads without error when there are no active runs
- **Steps**:
  1. Navigate to `#que`
  2. Wait for queue container
- **Expected Result**: Screen loads; empty state message or empty list shown

---

## Settings screen (set.js)

### E2E-009
- **Title**: Settings screen loads and key sections are visible
- **Steps**:
  1. Navigate to `#set`
  2. Wait for settings container
  3. Assert at least one settings section heading is visible (e.g. "API Keys", "Appearance")
- **Expected Result**: Settings screen renders; at least one section visible

### E2E-010
- **Title**: A settings preference can be changed and persists after page reload
- **Description**: Verify the settings save/load cycle using a simple toggle that has no external dependencies.
- **Test Data**: Toggle "Telemetry" off
- **Steps**:
  1. Navigate to `#set`
  2. Find the telemetry toggle
  3. Click to disable it
  4. Reload the page
  5. Navigate back to `#set`
  6. Assert the toggle is still off
- **Expected Result**: Telemetry toggle remains off after reload

---

## Models screen (mdl.js)

### E2E-011
- **Title**: Models screen loads and shows available models list
- **Steps**:
  1. Navigate to `#mdl`
  2. Wait for model list to render
  3. Assert at least one model card is visible
- **Expected Result**: Model screen shows downloadable AI models list

---

## Timeline screen (tme.js)

### E2E-012
- **Title**: Timeline editor loads without error
- **Steps**:
  1. Navigate to `#tme`
  2. Wait for timeline container
- **Expected Result**: Timeline editor renders; no console errors

---

## Help screen (hlp.js)

### E2E-013
- **Title**: Help screen loads and displays content
- **Steps**:
  1. Navigate to `#hlp`
  2. Wait for help content
- **Expected Result**: Help articles or sections visible

---

## Keyboard Shortcuts (shc.js)

### E2E-014
- **Title**: Keyboard shortcuts screen loads and lists shortcuts
- **Steps**:
  1. Navigate to `#shc`
  2. Wait for shortcuts list
- **Expected Result**: Table or list of keyboard shortcuts visible

---

## Critical Navigation Flow

### E2E-015
- **Title**: Full navigation round-trip across all main screens without error
- **Description**: Navigate to every major screen in sequence; none should crash or show an error state.
- **Steps**:
  1. Start at `#lib`
  2. Navigate to: `#fld`, `#ned`, `#bld`, `#que`, `#set`, `#mdl`, `#tme`, `#hlp`
  3. After each navigation, wait 1 second and check `console.error` count
- **Expected Result**: Zero console errors across all navigations; each screen renders a visible UI element

---

## Backup / Restore Awareness

### E2E-016
- **Title**: App starts without errors even when no project_root folder is set
- **Description**: Shadow backup logic must gracefully handle the case where no folder handle is stored.
- **Steps**:
  1. Open app in a fresh browser context (cleared IndexedDB, cleared localStorage)
  2. Check for errors
- **Expected Result**: App loads normally; no unhandled promise rejections in console
