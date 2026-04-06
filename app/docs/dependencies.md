# PicMachina Dependencies
This document outlines the core libraries and dependencies that power PicMachina.

## Core Framework
- **Vite** (`vite`): Used as the next-generation frontend build tool and development server, ensuring rapid HMR (Hot Module Replacement) and optimized production builds.

## AI & Computer Vision
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`): Powers browser-native machine learning tasks, including background removal (`ImageSegmenter`), face and body pose detection/cropping (`FaceLandmarker`, `PoseLandmarker`), and dynamic coordinate extraction.
- **Transformers.js** (`@xenova/transformers`): Enables on-device, WASM-accelerated NLP and vision transformers for tasks like semantic captioning and scene analysis.
- **Tesseract.js** (`tesseract.js`): Pure Javascript port of the Tesseract OCR engine for reading text and extracting semantic labels directly from input images.

## Image Processing & Exif
- **Photon (Rust/WASM)** (`photon_rs`): An incredibly high-performance image processing library compiled to WebAssembly. Heavy computational filters (like Kuwahara oil painting, Color adjustments, and Edge Detection) bypass standard JS and execute near-natively using this module. *(Note: Sourced as a bundled vendor dependency rather than via NPM).*
- **Smartcrop.js** (`smartcrop`): Content-aware image cropping algorithm that uses entropy and face detection to find good crops automatically.
- **ExifReader** (`exifreader`): In-depth metadata extraction library that reads EXIF, IPTC, and XMP data from image formats like JPEG, PNG, HEIC, and WebP.
- **Piexifjs** (`piexifjs`): Used strictly for *writing* and injecting modified EXIF GPS and metadata chunks back into exported JPEG canvases.

## Video & Animation
- **MP4-Muxer** (`mp4-muxer`): Creates MP4 containers natively in the browser by packaging H.264 streams encoded via the WebCodecs `VideoEncoder` API.
- **MP4Box** (`mp4box`): Used for parsing and manipulating existing MP4 files for timeline aggregation and video extraction.
- **gif.js** (`gif.js`): A JavaScript GIF encoder that relies on Web Workers to compile canvas frames into animated GIFs efficiently.

## Utilities & Rendering
- **JSZip** (`jszip`): Client-side ZIP file creation for batch downloading multiple processed outputs at once.
- **Leaflet** (`leaflet`): Lightweight mapping library used to visualize geo-temporal nodes and coordinate paths in Geotagging UI features.
- **QRCode** (`qrcode`): Generates 2D barcodes for the application.
- **HEIC2Any / UTIF**: Fallback libraries used to ingest and decode Apple's HEIC image format and TIFF formats natively in the browser before processing.
