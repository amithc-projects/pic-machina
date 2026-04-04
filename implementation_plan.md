# PicMachina Master Architecture & Product Roadmap

To support the massive flexibility and advanced use-cases you outlined, PicMachina's architecture needs to evolve from a **sequential image pipeline** into a **Layer-Based, Metadata-Driven Media Compositor**. 

Below is the updated architectural roadmap that groups your feature requests into manageable, technical pillars.

## Open Questions & Feasibility Answers

> [!NOTE]
> **Can we do automated CC using Web Audio Recognition?**
> The native `Web Speech API` in browsers is heavily restricted and typically only works by hooking into a live Microphone. Relying on it for video files is a frustrating hack. **However, it is highly possible using WebAssembly (WASM).** We can run a lightweight version of whisper (like `Transformers.js` or `whisper.cpp`) entirely locally in the browser to extract text from video audio tracks. This guarantees exact sync and offline privacy, and is definitely fast enough for small/medium clips.

> [!NOTE]
> **Video splitting via AI analysis?**
> Yes. Basic scene splitting can be done instantly by comparing color histograms of adjacent video frames in Canvas 2D. For AI/Transcript-based splitting, we can use the local Whisper transcript and potentially pass it to the local browser Chrome Gemini/AI API to find semantic scene shifts.

---

## 🚀 Photon Migration & Capabilities

By integrating `photon-rs` (WebAssembly image processing), we gain a near-native processing backend for the client.

### Migrating Existing Transforms to Photon
Operations currently handled in standard Canvas 2D loops (e.g., in `color.js`) will migrate to WASM for massive speed boosts, especially on high-res batch images:
* Brightness, Contrast, Saturation, Exposure 
* Hue Rotation, Sepia, Grayscale
* Basic Convolutions: Gaussian Blur, Sharpening, Edge Detection

### New Capabilities Unlocked by Photon
* **Advanced Blending Modes**: WebAssembly-fast computation for standard Photoshop blending (Multiply, Overlay, Dodge, Burn, Difference)—critical for Layering effects and Masks.
* **Stacking Operations**: Photon's incredibly fast multi-image iterators enable **Median Stacking** (removing people) and **Focus Stacking**.
* **Halftoning & Dithering**: Creating retro/comic book dot patterns natively.
* **Color Space Manipulation**: Direct access to HSV, HSL, and LCh channels for advanced feature extraction (e.g., dominant color mosaic logic).
* **Liquid Rescaling**: Content-aware seam carving.

---

## The Architectural Roadmap

To build this cleanly, we need to restructure the core engine in phases.

### Phase 1: Decentralized Data Model & Layering System
Before adding UI or effects, the internal engine data structures need an upgrade.

* **[NEW] Sidecar Metadata Store**: Avoid central databases. Every asset (e.g., `image.jpg`) will generate a sibling JSON sidecar file (e.g., `image.jpg.json`). The app will operate on folders, parsing sidecars alongside images, ensuring data stays with the file across file systems/transfers.
* **[NEW] Variable Substitution**: Implement global placeholder parsing so any text input in a recipe or UI can consume `{{metadata.title}}` or `{{metadata.location}}` from the sidecar.
* **[MODIFY] The Layering Compositor**: Move away from simple linear filters. The compositor must support absolute **Layers**. A layer has Z-index, X/Y, rotation, transparency, and a Photon-backed blending mode. This foundation is required for Triptychs, rotatable video templates, and cutout masks.

### Phase 2: In-Browser Media Intelligence & AI
We will implement "Extractor Nodes" that don't output images, but rather populate the JSON Sidecars automatically.

* **OCR Node (`Tesseract.js`)**: Extract raw text and use regex to identify dates/prices on assets like receipts to populate metadata.
* **Audio Transcription Node (`Transformers.js` Whisper)**: Extract audio channels via Web Audio API, transcribe to WebVTT, and save to metadata.
* **Scene Detection Node**: Analyze video buffers for hard cuts or use Edge AI to chunk based on dialogue.
* **Depth Map Generator**: Use TensorFlow.js (TFJS) or MediaPipe to process depth models, storing the depth map URL/data into the metadata.

### Phase 3: Hardware Acceleration Pipeline
To pull off math-heavy aggregations, we will lean heavily into WASM and Canvas APIs.

* **WASM Pixel Stacking**: Using Photon to generate Median Stacks (removing moving objects) and Focus Stacks.
* **Video Wall Templates (Canvas 2D)**: Implement arbitrary templating using native Canvas 2D Affine Transforms (translation, scale, rotation, skew/shear) to map videos to user-defined screen templates without the overhead of WebGL.
* **Relighting**: Use the generated depth maps alongside WebGPU or WebGL shaders to simulate dynamic lighting sources.

### Phase 4: Data-Driven UI & Authoring Tools
Once the engine supports layers and sidecar metadata, we unblock the authoring interfaces.

* **The Metadata Workbench**: A UI side-panel attached to the library displaying the JSON sidecar metadata, allowing folder-based CSV/XLSX bulk imports, Geolocation maps, and color pickers.
* **Template & Comic Book Visual Editor**: A canvas-based UI allowing users to physically drag Handles over backgrounds to define placement coordinates. 
* **Mosaic Configurator**: UI to select dominant colors and map the grid.

### Phase 5: The "Aggregator" Video Generators
Dynamic VideoEncoder loops driven by math and metadata.

* **Timeline linear view & Map Traveller**: Generate a moving canvas camera that pans between coordinates attached to metadata sidecars.
* **Scrolling Shop Windows**: Carousel generators looping through assets, pulling `{{metadata.price}}` from sidecars to render animated text/titles on top of the frames.

### User Review Required
The plan has been updated to reflect Sidecar JSON Metadata, explicit Photon migrations, and dropping WebGL for Video Walls.  **Which Phase or specific feature group is your immediate #1 priority to tackle first?**
