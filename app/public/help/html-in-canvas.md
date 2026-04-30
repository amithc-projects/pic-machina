# HTML-in-Canvas Feature

The **Animated Timer** and certain other advanced overlays require the browser to support rendering rich DOM elements directly into a Canvas context. 

Pic-Machina uses an experimental approach via SVG `foreignObject` to achieve buttery-smooth, hardware-accelerated HTML rendering inside your videos.

## Requirements
Due to strict browser security constraints regarding "tainted canvases," this feature requires experimental web platform features to be enabled.

### Google Chrome / Edge
Currently, you need to enable the Experimental Web Platform Features flag:
1. Open your browser and navigate to `chrome://flags` (or `edge://flags`).
2. Search for **"Experimental Web Platform features"**.
3. Set the dropdown to **Enabled**.
4. Relaunch your browser.

### Safari
Safari does not fully support the required `foreignObject` rendering pipeline without tainting the canvas, which prevents Pic-Machina from exporting the video. We recommend using Chrome for recipes that rely on this feature.

## Need Help?
If you've enabled the flags and this node is still disabled, ensure your browser is updated to the latest version.
