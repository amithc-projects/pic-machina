# ShowCase Screen — Implementation Plan

## Context

The user wants a new first-level nav screen called **ShowCase** that lets them highlight a specific run's output as a visual portfolio entry. Each showcase entry is tied to a single run and captures: a user-editable title/description, up to 5 sample output images (auto-picked from the first 5, swappable), a horizontal pipeline diagram of the recipe steps with params, and links back to the recipe. The list view is a large visual card grid. Clicking a card opens the full detail view. Both image and video output are supported. In-app only (no export/share for now).

---

## Data Model

Add a new `showcases` store to IndexedDB (in `src/data/db.js`):

```js
{
  id:              string,        // uuid
  runId:           string,        // which run
  recipeId:        string,
  recipeName:      string,
  title:           string,        // user-editable, defaults to recipeName
  description:     string,        // user-written
  sampleFileNames: string[],      // up to 5 filenames from the run's output folder
  createdAt:       number,
  updatedAt:       number,
}
```

Create `src/data/showcases.js` with: `getAllShowcases()`, `getShowcase(id)`, `saveShowcase(entry)`, `deleteShowcase(id)` — following the pattern in `src/data/recipes.js`, using `dbGetAll / dbGet / dbPut / dbDelete` from `src/data/db.js`.

---

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/data/db.js` | Add `showcases` object store (`keyPath: 'id'`, index on `createdAt`) |
| `src/data/showcases.js` | New — CRUD helpers |
| `src/screens/shc.js` | New — ShowCase screen (list + detail) |
| `src/main.js` | Add `shc` to SCREENS map |
| `index.html` | Add nav item for ShowCase |
| `src/screens/out.js` | Add "Add to ShowCase" button on run rows and in gallery header |
| `src/screens/fld.js` | Add "Add to ShowCase" button in browse toolbar |

---

## Screen Structure (`src/screens/shc.js`)

### List View (default)
- Header: "ShowCase" title + icon (`star`)
- Grid of large cards (`repeat(auto-fill, minmax(280px, 1fr))`)
- Each card:
  - Hero image (first sampleFileName, loaded as blob URL from `outputHandleObj` via `getOrCreateOutputSubfolder` + `listImages`) — full card-width, ~200px tall, `object-fit: cover`
  - Recipe name + date
  - Short description excerpt (truncated to 2 lines)
  - Hover overlay: Edit + Delete icon buttons
- Empty state with prompt to go to Output History

### Detail View (replaces list, back button returns to list)
Triggered by clicking a card. URL: `#shc?id=<showcaseId>`

Layout (two-column on wide screens, single-column on narrow):
1. **Left/top**: Sample images strip — up to 5 thumbnails, click to open lightbox (reuse `ImageWorkspace` pattern from `out.js`)
2. **Right/top**: Title (editable inline), description textarea, recipe name link (`navigate('#bld?id=...')`), "Run Again" button
3. **Below**: Horizontal pipeline diagram (see below)
4. **Footer**: Delete showcase button

### Inline Editing
Title and description are editable in place (`contenteditable` or `<input>`/`<textarea>`) with a save debounce that calls `saveShowcase()`.

---

## Pipeline Diagram

Fetch the recipe with `getRecipe(showcaseEntry.recipeId)` from `src/data/recipes.js`.  
Fetch all transform definitions by importing `getTransforms()` from `src/engine/registry.js` (or equivalent) to resolve `transformId → { name, icon, category }`.

Render `recipe.nodes` as a horizontal scrollable strip:

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  ⟳ icon  │ ──▶ │  ⟳ icon  │ ──▶ │  ⟳ icon  │
│ Step name│     │ Step name│     │ Step name│
│ key: val │     │ key: val │     │ key: val │
└──────────┘     └──────────┘     └──────────┘
```

- Each `transform` node: card with icon (from TransformDef), name, and up to 3 key params shown as `label: value` pills
- `branch`/`conditional` nodes: simplified diamond-shaped card labeled "Branch" or "If/Else"
- `block-ref` nodes: card labeled with block name + a "⧉" icon
- Disabled nodes: shown with muted/strikethrough style
- Cards are connected by `──▶` arrows (CSS `::after` or SVG line)
- Clicking a step card expands a popover/tooltip showing all params

---

## "Add to ShowCase" Entry Points

### In `src/screens/out.js`
- Add a star button (`star` icon) to `.out-run-actions` for completed runs (alongside existing View Files / Browse buttons)
- Handler: calls `addRunToShowcase(run)` which:
  1. Gets the run's `outputHandleObj`, navigates to the subfolder
  2. Calls `listImages(subHandle)` (and `listVideos` if available), takes first 5 filenames
  3. Creates and saves a new showcase entry via `saveShowcase()`
  4. Shows a toast: "Added to ShowCase" with a link `navigate('#shc?id=...')`
- Also add the button in the gallery header (`out-gallery-header`) after "Browse Folder"

### In `src/screens/fld.js`
- Add an "Add to ShowCase" button in the folder browser toolbar (only when viewing a run's output folder, i.e. when `run` param is present in the hash)

---

## Nav & Routing

**`index.html`** — add before or after the `#out` nav item:
```html
<li>
  <a href="#shc" class="app-nav__item" data-screen="shc" title="ShowCase">
    <span class="material-symbols-outlined">star</span>
    <span class="app-nav__label">ShowCase</span>
  </a>
</li>
```

**`src/main.js`** — add to SCREENS map:
```js
shc: () => import('./screens/shc.js'),
```

---

## Verification

1. Navigate to `#out` — each completed run row has a star button; clicking it creates a showcase entry and shows a toast
2. Navigate to `#shc` — grid shows large card(s) with hero image, recipe name, date
3. Click a card → detail view loads: sample thumbnails, editable title/description, pipeline diagram, recipe link
4. Edit title/description → changes persist after navigating away and back
5. Click a pipeline step card → all params shown in popover
6. "Run Again" button → navigates to `#set?recipe=...`
7. Recipe name link → navigates to `#bld?id=...`
8. Delete button → removes entry, returns to list
9. Test with a run that has video output files — thumbnails show video icon / first frame if extractable
