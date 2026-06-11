# Tier 5 — Manual / Exploratory Tests

**Tester**: Human (QA or developer)  
**When to run**: Before every release candidate; after significant feature changes  
**Record results in**: A release checklist (copy this file; mark Pass/Fail/N/A per item)

---

## Pre-conditions

Before running any manual test:
1. Install the latest build on a clean profile (no IndexedDB data)
2. Have a set of real test photos available (mix of portrait/landscape/GPS/non-GPS)
3. Have a short test video file (5-10 seconds, MP4)
4. Have a folder structure with sub-folders for testing folder browsing

---

## Application Startup & Initial State

### MT-001
- **Title**: App loads in under 3 seconds on first visit
- **Description**: Subjective performance check on a standard developer machine.
- **Steps**:
  1. Open app in a fresh browser tab
  2. Note the time until main UI is interactive
- **Expected Result**: UI is interactive in < 3 seconds; no visible layout jump

### MT-002
- **Title**: Dark mode theme applies correctly to all screens
- **Steps**:
  1. Enable dark mode in OS settings (or browser override)
  2. Navigate through all main screens
  3. Check that no screen has unreadable text (light text on light background) or inverted areas
- **Expected Result**: All screens are fully readable in dark mode

### MT-003
- **Title**: Light mode theme applies correctly to all screens
- **Steps**:
  1. Enable light mode
  2. Repeat the same navigation
- **Expected Result**: All screens readable; no dark-on-dark elements

---

## Folder Management (fld.js)

### MT-004
- **Title**: Select input folder via OS file picker
- **Steps**:
  1. Navigate to Folder screen
  2. Click "Select Input Folder"
  3. Use the OS dialog to select a real folder containing photos
  4. Confirm the folder is displayed
- **Expected Result**: Folder name appears in the UI; photo count is shown

### MT-005
- **Title**: Photo thumbnails generate for a folder of 20+ images
- **Test Data**: A folder containing at least 20 JPEG images
- **Steps**:
  1. Select the folder
  2. Wait for thumbnails to render
- **Expected Result**: All thumbnails visible within 10 seconds; no broken images

### MT-006
- **Title**: Sidecar drawer opens for a photo and shows EXIF data
- **Steps**:
  1. Select a folder with GPS-tagged photos
  2. Click a photo
  3. Open the sidecar/metadata panel
  4. Verify EXIF data is displayed
- **Expected Result**: Camera make/model, date, GPS coordinates visible

### MT-007
- **Title**: Rating a photo (1-5 stars) persists to the `.photo.json` sidecar file
- **Steps**:
  1. Open a folder with read/write permission
  2. Rate a photo with 4 stars
  3. Close and reopen the folder
  4. Check the photo's rating
- **Expected Result**: Rating shows as 4 stars on reopen; `.photo.jpg.json` file exists in the folder

### MT-008
- **Title**: Tag auto-complete suggests existing tags from the current folder
- **Steps**:
  1. Add tag "travel" to one photo
  2. Begin typing "tra" in the tag field of another photo
- **Expected Result**: "travel" appears in the auto-complete dropdown

### MT-009
- **Title**: Sidecar migration runs on folder open (legacy `.photo.jpg` → `.photo.jpg.json`)
- **Test Data**: A folder containing files with the old `.photo.jpg` naming format (no `.json` extension)
- **Steps**:
  1. Open the folder
  2. Check folder contents after opening
- **Expected Result**: Legacy sidecar files are renamed to the new format; data is preserved

---

## Recipe Editor — Node Editor (ned.js)

### MT-010
- **Title**: Add a transform node to a recipe via the search/browse panel
- **Steps**:
  1. Open the NED screen with a new recipe
  2. Click "Add Transform" or "+"
  3. Search for "contrast"
  4. Click "Add" on "Standard Tuning"
  5. Verify the node appears in the recipe
- **Expected Result**: Node added to the recipe; parameter controls visible in the inspector

### MT-011
- **Title**: Drag to reorder recipe nodes
- **Steps**:
  1. Add 3 transform nodes
  2. Drag the second node above the first
- **Expected Result**: Node order changes; recipe updates correctly

### MT-012
- **Title**: Disable a node and verify it is skipped visually (greyed out)
- **Steps**:
  1. Add a color-invert node
  2. Right-click or use the context menu to disable it
  3. Verify the node appearance
- **Expected Result**: Node appears dimmed/disabled; disable badge or icon shown

### MT-013
- **Title**: Branch node creates separate variant paths in the recipe
- **Steps**:
  1. Add a branch node
  2. Verify two branches appear (Variant A, Variant B)
  3. Add different transforms to each branch
- **Expected Result**: Both branches visible; each can have independent nodes

### MT-014
- **Title**: Conditional node — evaluating `IsPortrait` on a portrait image routes to "Then" branch
- **Steps**:
  1. Add a conditional node: if IsPortrait
  2. Add a distinctive node in the Then branch (e.g. add label "PORTRAIT")
  3. Run the recipe against a portrait image
- **Expected Result**: Only the Then branch's transform is applied

### MT-015
- **Title**: Time-range strip — dragging handles updates the start/end timestamps
- **Steps**:
  1. Add a transform that supports time-range (e.g. overlay-text with timeline support)
  2. Enable Time Range
  3. Load a video file
  4. Drag the start handle to ~20% of the timeline
  5. Check the Start field value
- **Expected Result**: Start value updates to approximately 20% of video duration

---

## Batch Processing (bld.js + que.js)

### MT-016
- **Title**: Run a simple batch job on 5 images and verify all 5 are exported
- **Test Data**: 5 JPEG images in an input folder; simple recipe (resize + export)
- **Steps**:
  1. Select input folder (5 images)
  2. Select/create output folder
  3. Choose a recipe
  4. Click "Run"
  5. Monitor the queue
  6. Check output folder
- **Expected Result**: 5 output files appear in the output folder; queue shows 5/5 complete

### MT-017
- **Title**: Batch run with branch node produces multiple outputs per input image
- **Test Data**: 2-image input; recipe with 2-variant branch
- **Steps**:
  1. Select recipe with 2 branches
  2. Run on 2 images
- **Expected Result**: 4 output files (2 images × 2 branches)

### MT-018
- **Title**: Cancelling a running batch job stops processing cleanly
- **Steps**:
  1. Start a large batch (20+ images)
  2. After ~5 files processed, click Cancel
  3. Check queue state and output folder
- **Expected Result**: Processing stops; only already-processed files appear in output; app remains stable

### MT-019
- **Title**: Run log is saved and viewable after completion
- **Steps**:
  1. Complete a batch run
  2. Navigate to the run history / queue
  3. Open the run details
- **Expected Result**: Run log shows file count, duration, per-file status

---

## Sound Studio / Audio (aud.js)

### MT-020
- **Title**: Voice Studio TTS generates audio with Kokoro (local model)
- **Test Data**: Kokoro model downloaded
- **Steps**:
  1. Navigate to Voice Studio screen
  2. Select Kokoro engine
  3. Type a short sentence: "Hello, this is a test."
  4. Click Generate
  5. Play the audio
- **Expected Result**: Audio plays clearly; text is spoken naturally; no distortion

### MT-021
- **Title**: Voice Studio TTS generates audio with Chatterbox (local model)
- **Steps**: Same as MT-020 but select Chatterbox engine
- **Expected Result**: Distinct voice from Kokoro; clear speech

### MT-022
- **Title**: ElevenLabs cloud TTS generates audio (requires API key)
- **Pre-condition**: ElevenLabs API key configured in Settings
- **Steps**:
  1. Select ElevenLabs engine
  2. Generate text
- **Expected Result**: Audio generated and plays within 5 seconds

### MT-023
- **Title**: Local TTS gateway generates audio (requires local Python server)
- **Pre-condition**: `localTts.url` set in Settings; local server running
- **Expected Result**: Audio generates and plays; no network errors

---

## Image Editor (ime.js)

### MT-024
- **Title**: Image editor opens a photo for pixel-level editing
- **Steps**:
  1. Right-click a photo in the library
  2. Select "Edit in Image Editor"
  3. Apply a brush stroke
- **Expected Result**: Editor opens; brush stroke appears on canvas

### MT-025
- **Title**: Image workspace — lasso select and crop
- **Steps**:
  1. Open an image in the workspace
  2. Use lasso tool to select a region
  3. Apply crop to selection
- **Expected Result**: Image is cropped to the selection; dimensions update

---

## Timeline Video Editor (tme.js)

### MT-026
- **Title**: Create a new timeline project
- **Steps**:
  1. Navigate to Timeline screen
  2. Click "New Timeline"
  3. Add a clip from the file browser
- **Expected Result**: Clip appears on the timeline; thumbnail visible

### MT-027
- **Title**: Timeline playback plays the video at correct speed
- **Steps**:
  1. Add TD-VID-001 (5s video) to timeline
  2. Press Play
  3. Time the playback with a stopwatch
- **Expected Result**: Playback reaches 5 seconds in approximately 5 real seconds

### MT-028
- **Title**: Timeline project saves and reloads correctly
- **Steps**:
  1. Create a timeline with 2 clips and a text overlay
  2. Save
  3. Navigate away
  4. Return to Timeline screen and open the saved project
- **Expected Result**: Both clips and text overlay are restored correctly

---

## Keyboard Shortcuts (shc.js)

### MT-029
- **Title**: Global shortcut `?` opens the keyboard shortcuts help overlay
- **Steps**:
  1. Press `?` from any screen
- **Expected Result**: Shortcuts overlay or modal appears

### MT-030
- **Title**: Navigation shortcuts route to the correct screen
- **Steps**:
  1. Check the shortcuts list for navigation keys
  2. Press each one (e.g. `L` for Library, `B` for Build, etc.)
- **Expected Result**: Each shortcut navigates to the correct screen

---

## Internationalisation (i18n)

### MT-031
- **Title**: German locale — all main screen headings display in German
- **Steps**:
  1. Switch browser/OS language to German
  2. Reload the app
  3. Navigate to Library, Build, Settings screens
  4. Verify headings are in German
- **Expected Result**: No English placeholder strings visible; headings correctly translated

### MT-032
- **Title**: German locale — no missing translation keys (no `[missing: key]` visible)
- **Steps**:
  1. Set language to German
  2. Navigate through all screens
  3. Search for `[missing:` in the rendered page text
- **Expected Result**: Zero missing translation strings visible

---

## Media Import (get.js)

### MT-033
- **Title**: Import image from Unsplash search
- **Pre-condition**: Unsplash API key configured in Settings
- **Steps**:
  1. Navigate to Get Media screen
  2. Search for "mountains"
  3. Click Download on the first result
- **Expected Result**: Image downloads and appears in the library / asset panel

### MT-034
- **Title**: Import video from Pexels search
- **Pre-condition**: Pexels API key configured
- **Steps**:
  1. Search for "nature" in Pexels videos
  2. Download a short clip
- **Expected Result**: Video appears in asset library; thumbnail visible

---

## Backup & Restore (bup.js)

### MT-035
- **Title**: Manual backup export creates a downloadable archive
- **Steps**:
  1. Create 2-3 user recipes
  2. Navigate to Backup screen
  3. Click "Export Backup"
- **Expected Result**: Browser initiates a download of a `.zip` or `.json` backup file

### MT-036
- **Title**: Restore from backup imports recipes correctly
- **Steps**:
  1. Export backup (MT-035)
  2. Clear all user data (Settings → Clear Data)
  3. Navigate to Backup → Import
  4. Select the backup file
- **Expected Result**: Recipes restored; count matches what was backed up

---

## Performance

### MT-037
- **Title**: Batch run on 100 JPEG images completes in a reasonable time
- **Test Data**: 100 JPEG images ~3MB each; recipe: resize to 1920px + JPEG export at 85%
- **Steps**:
  1. Run batch
  2. Time the total processing
- **Expected Result**: Completes in < 5 minutes; no browser tab crash or OOM error

### MT-038
- **Title**: Application remains responsive during a large batch run
- **Steps**:
  1. Start a large batch (100+ images)
  2. While processing, navigate to Settings screen
  3. Scroll through the Settings page
- **Expected Result**: UI remains responsive; no frozen frames > 500ms; navigation works
