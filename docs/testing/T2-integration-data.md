# Tier 2 — Integration Tests: Data Layer

**Tool**: Vitest + `fake-indexeddb`  
**File location**: `tests/integration/data/`  
**Run command**: `npx vitest run tests/integration/data/`  
**Setup**: Each test file does `import 'fake-indexeddb/auto'` before any DB imports to intercept IndexedDB calls.

---

## db.js — Core Database Operations

### IT-001
- **Title**: `initDB` — initialises successfully and creates all required object stores
- **Description**: After initDB(), the database should contain all 10 object stores defined in the schema.
- **Dependencies**: fake-indexeddb, seed data (system recipes and blocks will be seeded)
- **Steps**:
  1. Call `initDB()`
  2. Get the db reference
  3. Assert `db.objectStoreNames` contains each expected store
- **Expected Result**: Object store names include: `recipes`, `blocks`, `runs`, `folders`, `assets`, `templates`, `showcases`, `models`, `timelines`, `voices`

### IT-002
- **Title**: `initDB` — second call returns the same db instance (singleton)
- **Steps**:
  1. Call `initDB()` twice
  2. Compare returned references
- **Expected Result**: Both calls return the same object (no second open attempt)

### IT-003
- **Title**: `dbPut` + `dbGet` — round-trip for a recipe record
- **Test Data**: `{ id: "test-1", name: "My Recipe", nodes: [], createdAt: 1000, updatedAt: 1000 }`
- **Steps**:
  1. Call `initDB()`
  2. Call `dbPut("recipes", record)`
  3. Call `dbGet("recipes", "test-1")`
- **Expected Result**: Retrieved record is deeply equal to what was put

### IT-004
- **Title**: `dbGetAll` — returns all records from a store
- **Test Data**: 3 recipe records
- **Steps**:
  1. Put 3 records
  2. Call `dbGetAll("recipes")`
- **Expected Result**: Array length ≥ 3 (may include seeded system recipes)

### IT-005
- **Title**: `dbDelete` — removes a record; subsequent get returns null
- **Test Data**: A recipe with id `"del-me"`
- **Steps**:
  1. Put record
  2. Call `dbDelete("recipes", "del-me")`
  3. Call `dbGet("recipes", "del-me")`
- **Expected Result**: Returns `null`

### IT-006
- **Title**: `dbGet` on non-existent key returns null (not undefined or error)
- **Steps**:
  1. Call `dbGet("recipes", "does-not-exist")`
- **Expected Result**: Returns `null`

### IT-007
- **Title**: `dbSaveFolderHistory` — adds a handle to MRU list and caps at 5
- **Test Data**: 6 mock folder handles with distinct `.name` properties
- **Steps**:
  1. Call `dbSaveFolderHistory("input", handle)` 6 times with different handles
  2. Call `dbGetFolderHistory("input")`
- **Expected Result**: Returns array of length 5 (oldest entry evicted)

### IT-008
- **Title**: `dbSaveFolderHistory` — bubbles a repeated handle to the top
- **Test Data**: 3 handles (A, B, C), then add A again
- **Steps**:
  1. Add A, B, C
  2. Add A again
  3. Get history
- **Expected Result**: History is `[A, C, B]` — A is at position 0

---

## data/recipes.js — Recipe CRUD

### IT-009
- **Title**: `saveRecipe` — auto-assigns `id`, `createdAt`, `updatedAt` on first save
- **Test Data**: `{ name: "New Recipe", nodes: [] }` (no id)
- **Steps**:
  1. Call `initDB()`
  2. Call `saveRecipe({ name: "New Recipe", nodes: [] })`
  3. Assert returned recipe
- **Expected Result**: `id` is a valid UUID string; `createdAt` and `updatedAt` are non-zero epoch ms

### IT-010
- **Title**: `saveRecipe` — updates `updatedAt` but preserves `createdAt` on re-save
- **Test Data**: Existing recipe with known `createdAt`
- **Steps**:
  1. Save a recipe, capture `createdAt`
  2. Wait 1ms, re-save with a name change
  3. Assert timestamps
- **Expected Result**: `createdAt` unchanged; `updatedAt` ≥ original `createdAt`

### IT-011
- **Title**: `getRecipe` — returns null for non-existent id
- **Steps**:
  1. Call `getRecipe("no-such-id")`
- **Expected Result**: Returns `null`

### IT-012
- **Title**: `getUserRecipes` — returns only non-system recipes
- **Description**: System recipes are seeded at startup; user recipes must be filtered.
- **Steps**:
  1. Save one recipe with `isSystem: false`
  2. Call `getUserRecipes()`
- **Expected Result**: Array contains the user recipe; no recipe with `isSystem: true`

### IT-013
- **Title**: `getSystemRecipes` — returns only system recipes (seeded from system-recipes.js)
- **Steps**:
  1. Call `getSystemRecipes()`
- **Expected Result**: Array of length > 0; all items have `isSystem: true`

### IT-014
- **Title**: `cloneRecipe` — creates a deep copy with new id and name
- **Test Data**: An existing recipe with nodes
- **Steps**:
  1. Save original recipe
  2. Call `cloneRecipe(originalId, "Copy Name")`
  3. Assert clone
- **Expected Result**: Clone has different `id`, `name === "Copy Name"`, `isSystem === false`, same `nodes` shape (deep copied)

### IT-015
- **Title**: `cloneRecipe` — modifying the clone's nodes does not affect original
- **Steps**:
  1. Clone a recipe
  2. Push a new node to clone.nodes
  3. Re-fetch original
- **Expected Result**: Original nodes array unchanged

### IT-016
- **Title**: `deleteRecipe` — removes recipe from DB
- **Steps**:
  1. Save recipe
  2. Delete it
  3. Call `getRecipe(id)`
- **Expected Result**: Returns `null`

---

## data/runs.js — Run logs

### IT-017
- **Title**: Save a run record and retrieve it by recipeId
- **Description**: Runs are the audit log of batch processing. They must be stored and queried by recipe.
- **Test Data**: `{ id: "run-1", recipeId: "rec-1", startedAt: Date.now(), status: "completed", fileCount: 10 }`
- **Steps**:
  1. Call `dbPut("runs", runRecord)`
  2. Call `dbGetAllByIndex("runs", "recipeId", "rec-1")`
- **Expected Result**: Returns array containing the run record

### IT-018
- **Title**: Multiple runs for same recipe are all returned
- **Test Data**: 3 run records with the same `recipeId`
- **Steps**:
  1. Put all 3
  2. Call `dbGetAllByIndex("runs", "recipeId", recipeId)`
- **Expected Result**: Array of length 3

---

## data/assets.js — Asset metadata store

### IT-019
- **Title**: Save asset metadata and retrieve by hash
- **Test Data**: `{ hash: "abc123", filename: "photo.jpg", ingestedAt: Date.now() }`
- **Steps**:
  1. `dbPut("assets", assetRecord)`
  2. `dbGet("assets", "abc123")`
- **Expected Result**: Retrieved record matches input

### IT-020
- **Title**: Retrieve assets by filename index
- **Test Data**: 2 records with same filename (different hash — same file ingested twice, simulating duplicates)
- **Steps**:
  1. Put both records
  2. `dbGetAllByIndex("assets", "filename", "photo.jpg")`
- **Expected Result**: Returns both records

---

## data/settings.js — Settings persistence

### IT-021
- **Title**: `getSettings` — returns default settings when localStorage is empty
- **Steps**:
  1. Clear localStorage (use `localStorage.clear()` in test setup)
  2. Call `getSettings()`
- **Expected Result**: Returns object with `license: "Free"`, `telemetry.enabled: true`, and other defaults

### IT-022
- **Title**: `saveSettings` + `getSettings` — round-trip persists to localStorage
- **Test Data**: Modified settings with `license: "Pro"`, `pexels.apiKey: "test-key"`
- **Steps**:
  1. Call `saveSettings(modifiedSettings)`
  2. Call `getSettings()`
- **Expected Result**: Returns settings with `license: "Pro"` and `pexels.apiKey: "test-key"`

### IT-023
- **Title**: `getSettings` — merges saved partial settings with defaults (no lost keys)
- **Description**: If localStorage has a partial settings object (missing new keys added in an update), defaults must fill in the gaps.
- **Test Data**: localStorage contains `{ license: "Pro" }` only
- **Steps**:
  1. Write partial settings to localStorage
  2. Call `getSettings()`
- **Expected Result**: Returns object with `license: "Pro"` AND all other default keys present

---

## System Recipe Seeding (db.js → system-recipes.js)

### IT-024
- **Title**: System recipes are seeded on `initDB()` and present in the store
- **Steps**:
  1. Call `initDB()` on a fresh (fake) database
  2. Call `dbGetAll("recipes")`
  3. Filter for system recipes
- **Expected Result**: Array length > 0; all have `isSystem: true`; no duplicates by id
