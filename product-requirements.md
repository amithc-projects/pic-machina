# Product Requirements Document: ImageChef

## 1. Project Overview
[cite_start]ImageChef is a local-first desktop application designed for high-performance, batch media processing[cite: 1, 38]. [cite_start]It enables users to build and execute complex "Recipes" via a visual node-based engine, emphasizing non-destructive editing, professional "Pro Studio" aesthetics, and advanced logic for creative automation[cite: 6, 21, 38].

## 2. Functional Requirements

### 2.1 Environment & File Access
* [cite_start]**Local-Only Operation**: All transformations occur entirely on the user's machine[cite: 1].
* [cite_start]**Persistent Folder Access**: Users grant access to local directories for input and output, which can be modified at any time[cite: 53].
* **Output Specifications**:
    * [cite_start]**Non-Destructive**: Original files remain untouched; processed assets are saved to an `/output` subfolder[cite: 50].
    * **Format Support**: JPEG, PNG, WEBP, Animated GIF, and Video (MP4/MOV).
    * [cite_start]**Logging**: Every batch run generates a terminal-style log with technical feedback[cite: 103, 109].

### 2.2 Recipe & Logic Architecture
* [cite_start]**Tree-Based Processing**: Recipes are fundamentally trees of operations where nodes can be individual transformations or "Blocks" (reusable sub-sets of operations)[cite: 38].
* **Advanced Flow Control**:
    * [cite_start]**Variant Branching**: Supports parallel output paths (e.g., creating a high-res main file and a low-res thumbnail simultaneously)[cite: 81, 82, 122].
    * [cite_start]**Conditional Logic**: "If/Then" branching based on image metadata (e.g., orientation or presence of GPS)[cite: 86, 123].
    * [cite_start]**Loop Nodes**: Iterative processing for multi-pass AI upscaling or parameter sweeps (e.g., exposure bracketing)[cite: 89, 101].
    * [cite_start]**Break Conditions**: Logic to exit a loop early based on specific metadata signals (e.g., target noise level achieved)[cite: 107, 108].

### 2.3 Variables & Metadata
* [cite_start]**Metadata Integration**: Supports internal EXIF/IPTC/XMP data and external sidecar files (CSV/JSON)[cite: 55, 126].
* [cite_start]**Dynamic Variables**: Settings fields allow `{{variable}}` syntax for data injection during processing[cite: 97].

## 3. Screen Definitions (Desktop 1280x1024)

| Abbr. | Screen Name | Key Features |
| :--- | :--- | :--- |
| **LIB** | **Recipe Library** | [cite_start]Visual grid of saved workflows with rich imagery and node counts[cite: 42, 116]. |
| **SET** | **Batch Setup** | [cite_start]Local folder selection and output destination configuration[cite: 126]. |
| **NED** | **Node Editor** | [cite_start]Drag-and-drop canvas with a categorized, color-coded sidebar for tools[cite: 43, 48]. |
| **BLD** | **Recipe Builder** | [cite_start]High-contrast list view for sequencing steps and testing flows[cite: 44, 120]. |
| **BKB** | **Block Builder** | [cite_start]Specialized workspace for creating reusable blocks with branching and loops[cite: 73, 101, 121]. |
| **INS** | **Block Inspector** | [cite_start]Detailed sidebar for fine-tuning individual node parameters with previews[cite: 76, 125]. |
| **PVW** | **Recipe Preview** | [cite_start]Quick-look view for before/after comparison and Clone/Edit actions[cite: 66, 117]. |
| **QUE** | **Processing Queue** | [cite_start]Real-time monitor for active batches with a terminal-style log[cite: 103, 127]. |
| **OUT** | **Output Browser** | [cite_start]Gallery for exploring processed folders and detailed run metadata[cite: 51, 128]. |
| **CMP** | **Comparison View** | [cite_start]Side-by-side "Before & After" workspace with a split-slider and histogram[cite: 58, 129]. |

## 4. Design & Technical Constraints

### 4.1 "Pro Studio" Aesthetic
* [cite_start]**Interface**: Dark-mode first with deep charcoal backgrounds (#121212 range)[cite: 7, 62].
* [cite_start]**Accents**: High-vibrancy electric blue for active states, primary buttons, and node highlights[cite: 32, 45, 115].
* [cite_start]**Typography**: Clean sans-serif for UI elements paired with technical monospace fonts for metadata and logs[cite: 8, 77, 110].
* [cite_start]**Visualized Logic**: Color-coded nodes (GEO, CLR, OVL, etc.) and explicit visual split-points for variants and loops[cite: 48, 68, 83].

### 4.2 Performance
* [cite_start]**Background Execution**: Batch processing must utilize multi-threading (Web Workers) to keep the UI responsive[cite: 127].
* [cite_start]**State Persistence**: Auto-saves to IndexedDB every 5 seconds; separate "System" (read-only) and "User" (writable) local folders for recipe JSON files[cite: 70].

## 5. User Workflow Flow

**Discovery [LIB]** ──> **Inspection [PVW]** ──> **Configuration [SET]**
  │                                           │
  ▼                                           ▼
**Modification [NED/BKB/BLD]** <──────────> **Validation [CMP]**
  │                                           │
  ▼                                           ▼
**Execution [QUE]** ───────────> **Review & Export [OUT]**


