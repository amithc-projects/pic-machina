# Migration Plan: Folder-Based Project Architecture

This document outlines the step-by-step implementation plan for migrating PicMachina's Video Timeline (`tme.js`) and Audio (`aud.js`) workspaces away from IndexedDB, moving them toward a "Self-Contained Folder" architecture using the File System Access API.

## 🎯 Goal
Treat projects like professional NLEs (Non-Linear Editors). A project is a user-selected folder on disk. All imported media is copied into this folder. The project state is saved as a `project.json` file alongside the media. Zipping the folder backs up the entire project natively.

---

## Phase 1: Core I/O Utilities (`src/utils/project-io.js`)

We need a dedicated utility to handle the File System Access API operations specifically for these project bundles.

1.  **`createProject()`**:
    *   Calls `showDirectoryPicker({ mode: 'readwrite' })`.
    *   Creates a base `project.json` file inside the selected folder.
    *   Optionally creates a `media/` subfolder.
    *   Returns the `FileSystemDirectoryHandle`.
2.  **`openProject()`**:
    *   Calls `showDirectoryPicker({ mode: 'readwrite' })`.
    *   Verifies the presence of `project.json`.
    *   Reads and parses the JSON.
    *   Returns `{ dirHandle, projectData }`.
3.  **`importMediaToProject(fileHandle, dirHandle)`**:
    *   Reads the file from the source `fileHandle`.
    *   Writes a physical copy of the file into the project's `dirHandle` (or its `media/` subfolder).
    *   Returns the relative filename (e.g., `media/clip_01.mp4`).
4.  **`resolveMediaUrl(filename, dirHandle)`**:
    *   Retrieves the file from the directory handle.
    *   Creates and returns a transient `URL.createObjectURL(file)` so the browser can play/render it in `<video>` or `<img>` tags.

---

## Phase 2: Refactoring Data Models (`timeline-store.js`)

Decouple the timeline from IndexedDB.

1.  **Remove IDB Dependencies**: Strip out `dbPut`, `dbGet`, `dbGetAll` from `timeline-store.js`.
2.  **Update the Schema**:
    *   Remove `fileHandle` from `mediaPool` items.
    *   Replace it with `filename` (relative string path).
3.  **Rewrite Save Logic**:
    *   Update `saveTimeline(timeline, dirHandle)` to `JSON.stringify` the timeline object and write it directly to the `project.json` file handle within the `dirHandle`.

---

## Phase 3: Timeline UI Refactor (`tme.js` & `timeline-view.js`)

The UI needs to shift from a "List of projects from DB" model to a "File Menu" model.

1.  **Startup Screen**:
    *   Replace the IndexedDB project list with a simple landing screen: **"Create New Project"** and **"Open Existing Project"**.
2.  **State Management**:
    *   Hold the active `dirHandle` in the screen's state.
3.  **Adding to Media Pool**:
    *   When the user selects a file to add, intercept it.
    *   Display a "Copying media..." loading state.
    *   Call `importMediaToProject()`.
    *   Add the resulting `filename` to the timeline's `mediaPool` array.
4.  **Playback & Rendering**:
    *   Update `timeline-view.js` and the canvas renderer to resolve `filename` strings into `Object URLs` via `resolveMediaUrl()` before attempting to draw them to the screen.

---

## Phase 4: Exporting Output

Ensure the generated outputs live within the project bundle.

1.  **Update `stitcher.js` / Video Exporter**:
    *   When the final video is compiled, default the save location to the project's `dirHandle`.
    *   Save it as `output.mp4` (or similar) directly into the root of the project folder.

---

## Phase 5: Audio / VoiceCraft Migration (`aud.js` & `voices.js`)

Apply the exact same pattern to the Audio studio.

1.  **Create Audio Projects**:
    *   Users create a folder for their audio project.
2.  **Raw Bytes to Files**:
    *   Instead of saving generated `Float32Array` bytes to IndexedDB, convert them to `.wav` files using the Web Audio API or a simple WAV encoder utility.
    *   Write the `.wav` files directly into the project folder.
3.  **Project State**:
    *   Save a `voices.json` or `audio-project.json` that maps script lines to the corresponding `.wav` filenames in the folder.

---

## Execution Strategy

We should build this linearly. 
*   **Step 1:** Build `project-io.js` and test the folder creation/file copying logic in isolation.
*   **Step 2:** Refactor `timeline-store.js` and wire it up to `tme.js` to get a working video project saving to disk.
*   **Step 3:** Handle the media copying and playback resolution within the timeline.
*   **Step 4:** Replicate the pattern for `aud.js`.
