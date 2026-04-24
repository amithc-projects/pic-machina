# Pic Machina Development Roadmap: HTML-in-Canvas Integration

This document outlines the strategic implementation of the `drawElementImage` API and the WICG "HTML in Canvas" proposal. By leveraging the browser's ability to render a layout subtree directly into the canvas bitmap, Pic Machina will transition from a flat image generator to a semantic design and video composition engine.

## Phase 1: High-Fidelity Typography & UI (Short-Term)
*Goal: Use CSS for professional design overlays that are difficult to achieve with standard Canvas API text.*

### 1. Node: `Typography_Engine`
- **Implementation**: Renders an invisible `<div>` within the canvas `layoutsubtree`.
- **Capability**: Enables native CSS features: kerning, `line-height`, `text-shadow`, and custom variable fonts.
- **User Benefit**: Users can change text styling in real-time without rerendering the base image or video.

### 2. Node: `Glass_Morphism`
- **Implementation**: Utilizes CSS `backdrop-filter: blur()` on an HTML element within the canvas layout.
- **Capability**: Automatically blurs pixels from the underlying canvas layer (video or image) to create a "frosted glass" effect for captions and info cards.
- **Use Case**: Professional "lower-thirds" for City and Date stamps in short-form content.

---

## Phase 2: Content-Aware Interaction (Mid-Term)
*Goal: Bridge the gap between the AI-generated content and the design layers.*

### 3. Node: `Subject_Occlusion` (Z-Indexing)
- **Implementation**: Combines the `Segmentation_Mask` node with the `drawElementImage` render order.
- **Capability**: Places HTML-based text or graphics *behind* a detected subject but *in front* of the background.
- **Use Case**: "Large text behind subject" trends popular in TikTok and Instagram Reels.

### 4. Node: `Shader_Warp_Text`
- **Implementation**: Uploads the HTML layout as a texture via `texElementImage2D()`.
- **Capability**: Applies WebGL fragment shaders to the HTML design layer.
- **Use Case**: Distorting, liquefying, or animating text as if it were a physical object within the video environment.

---

## Phase 3: High-Performance Video Pipeline (Long-Term)
*Goal: Native browser encoding and responsive video formatting.*

### 5. Node: `Responsive_Layout_Engine`
- **Implementation**: Uses `ResizeObserver` within the canvas to trigger HTML layout recalculations.
- **Capability**: Automatically shifts nodes (logos, captions, watermarks) to "Safe Zones" when switching between 9:16 (Shorts) and 16:9 (YouTube) aspect ratios.

### 6. Node: `WebCodecs_Export`
- **Implementation**: Direct stream piping from the Canvas into the `VideoEncoder` API.
- **Capability**: Bypasses the limitations of `MediaRecorder`. Supports high-bitrate **H.264/AV1** encoding directly in the browser.
- **User Benefit**: Near-instant export of processed short-form videos with baked-in AI effects and HTML overlays.

---

## Technical Summary: Why HTML-in-Canvas?
- **Zero Server Overhead**: All rendering occurs on the client GPU.
- **Semantic Editing**: Users interact with text as strings and CSS, not just static pixels.
- **Accessibility**: The layout subtree allows screen readers to interpret the content inside the canvas.


