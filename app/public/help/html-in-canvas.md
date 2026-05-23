# HTML-in-Canvas Feature

The **Hyperframe Template**, **Animated Timer**, and other advanced overlay steps require your browser to support the WICG **HTML-in-Canvas** API — a Chrome experimental feature that renders live DOM elements directly into a Canvas context for smooth, frame-accurate video output.

## Enabling the feature in Chrome

You need to turn on **two flags** in `chrome://flags`:

### 1. HTML-in-Canvas (required)
1. Open Chrome and go to `chrome://flags/#canvas-draw-element`
2. Set the dropdown to **Enabled**

### 2. Experimental Web Platform Features (required)
1. In the same flags page, search for **"Experimental Web Platform features"**  
   (or go to `chrome://flags/#enable-experimental-web-platform-features`)
2. Set the dropdown to **Enabled**

3. Click **Relaunch** to restart Chrome with both flags active.

### Tell Zumilabs Studio you've done it

After relaunching, open **Settings → Browser Capabilities** and check  
**"HTML-in-Canvas enabled"**, then save. This removes the setup warning from Hyperframe recipes.

---

## Why two flags?

The `#canvas-draw-element` flag enables the `ctx.drawElement()` / `ctx.drawElementImage()` API itself.  
The `#enable-experimental-web-platform-features` flag unlocks the broader platform primitives it depends on (layout containment, cross-origin isolation helpers, etc.).  
Both must be on for Hyperframe rendering to work.

## Safari / Firefox

Neither browser currently supports this API. Use Chrome or Edge (Chromium-based) for recipes that include Hyperframe steps.

## Still seeing the warning after enabling the flags?

Chrome's auto-detection can be unreliable because the API is only exposed on DOM-attached canvas instances. Use the manual override in **Settings → Browser Capabilities** to bypass the check entirely.
