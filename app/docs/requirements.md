# PicMachina Core Requirements
This is a comprehensive reference containing the client and browser constraints, UI/UX policies, and architectural requirements for PicMachina, ensuring that end-users understand the environment necessary to leverage the application to its fullest.

## Browser Requirements
- **Chromium Only:** PicMachina utilizes modern, cutting-edge Web APIs that currently lack uniform vendor support. **Google Chrome (v113+)** or a Chromium equivalent (e.g. Edge, Brave) is strictly required. 
- **WebCodecs API:** Used for encoding H.264 video natively (`VideoEncoder`) and extracting video frames natively (`VideoDecoder`). Required for all video processing — format conversion, trimming, per-frame effects, and slideshow aggregation. Browsers without this built-in will not be able to generate or process videos using PicMachina.
- **WebAssembly (WASM):** Advanced image filters, including the Kuwahara paint effect, execute in WebAssembly memory environments. WASM must be enabled and permitted by browser sandboxing.
- **File System Access API:** PicMachina requires permission to read from directories and write export files back into nested sub-directories on the user's local disk directly.

## Hardware Requirements
- **GPU Acceleration:** Creating WebGL Video Stitchers and executing MediaPipe Tasks AI pipelines rely heavily on WebGL/WebGPU hardware acceleration. A dedicated GPU is highly recommended for stable video exports avoiding memory timeouts.
- **Concurrency & Threads:** Image processing is deployed via Web Workers (`worker.js`). Systems with higher core counts will notice significantly reduced batch processing times due to parallel image evaluation.

## Known Limitations & Considerations
- **iOS/Safari:** Safari does not support the File System Access API required for PicMachina's "Batch Folder" approach. iOS clients are currently unsupported.
- **MediaPipe `NORM_RECT` Log Warnings:** Advanced geometry crops (like `geo-face-crop`) may trigger `landmark_projection_calculator` warnings in the console log regarding non-square image dimensions. This is a non-fatal, underlying C++ warning that will not impact your generated outputs.
- **Cross-Origin Assets:** Background images or assets fetched externally MUST be properly configured with CORS headers. Otherwise, canvas operations will be tainted by the browser, throwing security exceptions upon image export.
