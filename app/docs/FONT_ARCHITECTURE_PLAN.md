# Typography & Font Architecture Plan

This document outlines the architecture for unifying font management and text styling across the Pic-Machina application.

## Feasibility of Variable Fonts in HTML5 Canvas
Variable fonts are fully supported by HTML/CSS and SVG rendering (using `font-variation-settings`). However, HTML5 Canvas `ctx.font` does not directly accept variation settings. The standard workaround we will use is dynamically generating an `@font-face` rule in the DOM, applying the `font-variation-settings` inside that rule, and giving it a unique `font-family` alias (e.g., `"Brand Heading Font"`). Canvas can then use `ctx.font = '48px "Brand Heading Font"'` and the variable axes will render correctly.

## Phase 1: Consolidation & Master Font List (Current Phase)
**Goal:** Eliminate hardcoded options and free-form text inputs, routing all typography through a single source of truth.

### 1. Master Font List (Settings)
- Update `src/utils/settings.js` to include a `masterFonts` array (defaulting to standard ones like `Inter`, `Outfit`, `Monospace`, `Serif`).
- Update `src/screens/sys.js` to add a new "Master Fonts" manager section where users can view and manage the available fonts.
- Update the existing "Global Text Styles" section so that its "Font Family" input is a dropdown populated exclusively by the Master Font List.

### 2. Standardize Node Parameters
- **Remove Free-form Inputs:** Update `overlay-timer`, `video-overlay-timer`, and `flow-trigger-title` to remove the `type: 'text'` font input.
- **Remove Hardcoded Dropdowns:** Update `overlay-html-block` and `overlay-subtitles` to remove their hardcoded font arrays.
- **Apply Text Styles Globally:** Convert all of these nodes to use the `textStyleOverride: true` parameter UI hook. This ensures that whenever a user needs to add text, they select a pre-defined Global Text Style (which encapsulates font, size, weight, shadow, etc.) rather than manually tweaking font parameters per node.

### 3. Consolidate the UI Component
- Expand the logic in the configurator to act as a universal "Text Style Selector" component, ensuring the UI is identical across image overlays, video overlays, and flow triggers.

---

## Phase 2: Custom & Variable Fonts (Future)
**Goal:** Allow users to import custom fonts (specifically Google Fonts) and configure variable axes under custom brand names.

### 1. The "Import Font" UI
- In the Global Settings "Master Fonts" section, add an "Import Custom Font" button.
- Provide a text area where the user can paste the Google Fonts embed snippet (the `<link rel="...">` and the CSS class rules).
- Add a parser that extracts the `href` from the `<link>` tag and the `font-family` string from the CSS.

### 2. Variable Font Configuration
- When importing a variable font, provide UI fields to define `font-weight`, `font-style`, and custom `font-variation-settings` (like `wdth`, `slnt`, `opsz`).
- Allow the user to save this specific configuration under a custom alias (e.g., `Brand Heading Font`).

### 3. Dynamic DOM & SVG Injection Engine
- **DOM Injection:** Create a utility (e.g., `src/utils/fonts.js`) that takes the Master Font List and dynamically builds a `<style>` block in the `index.html` `<head>`. It will generate `@font-face` definitions mapping their custom aliases to the imported URLs and variable axes.
- **SVG Rendering:** For the SVG-based nodes (`html-overlay` and `subtitles`), the renderer will inject these same `@font-face` rules directly into the `<svg><style>` block so the `foreignObject` renders correctly before being painted to the canvas.
