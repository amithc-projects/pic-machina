# PWA Roadmap — PicMachina

## Overview

PicMachina can be packaged as a full Progressive Web App (PWA), installable on the user's desktop directly from the browser. All existing technology — Web Workers, File System Access API, IndexedDB, WebCodecs, MediaPipe, Canvas API, gif.js — is fully compatible with PWA installation. No architectural changes are required.

---

## Compatibility Notes

| Technology | PWA Compatible? | Notes |
|---|---|---|
| Web Workers (`engine/worker.js`) | ✅ Yes | Completely unaffected — separate from Service Workers |
| File System Access API | ✅ Yes (desktop) | Works in installed PWAs on Chrome/Edge desktop. Not supported on iOS/Firefox |
| IndexedDB | ✅ Yes | Persists across installs and relaunches |
| WebCodecs API | ✅ Yes | Same browser APIs, no change |
| MediaPipe (WASM/TFLite) | ⚠️ Partial | Models fetched from CDN; AI transforms need network on first use, then cached |
| Canvas API | ✅ Yes | No change |
| gif.js | ✅ Yes | No change |

**Target platform**: Chrome / Edge on desktop. This matches the existing File System Access API requirement and is the only platform that supports the full feature set.

---

## What PWA Requires

PWAs need three things:

1. **A `manifest.json`** — app name, icons, display mode, theme colour
2. **A Service Worker** — intercepts network requests to enable offline use
3. **HTTPS** — required for both service workers and File System Access API (`localhost` counts, so development works today)

`vite-plugin-pwa` (powered by Workbox) handles items 2 and 3 automatically from a single config block.

---

## Implementation Steps

### Step 1 — Create icon files

The animated `animated_logo.gif` cannot be used for homescreen icons. Create three static PNGs and place them in `public/icons/`:

| File | Size | Purpose |
|---|---|---|
| `public/icons/icon-192.png` | 192×192 | Standard homescreen icon |
| `public/icons/icon-512.png` | 512×512 | Splash screen / install prompt |
| `public/icons/icon-512-maskable.png` | 512×512 | Android adaptive icon (subject safe-zone: centre 80% safe area) |

---

### Step 2 — Install `vite-plugin-pwa`

```bash
npm install -D vite-plugin-pwa
```

---

### Step 3 — Update `vite.config.js`

```javascript
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',   // SW auto-updates when a new build is deployed
      workbox: {
        // Cache all static assets on install
        globPatterns: ['**/*.{js,css,html,ico,png,gif,svg,woff2,wasm}'],
        // Raise the 2 MB default limit — MediaPipe models are large
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: 'PicMachina',
        short_name: 'PicMachina',
        description: 'Local-first batch image processing',
        theme_color: '#0077ff',
        background_color: '#121212',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png',          sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png',          sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
```

---

### Step 4 — Deploy to a static host

Build the app:

```bash
npm run build
```

The output in `dist/` is a fully self-contained static site. Deploy it to any of the following (all free for static apps):

| Host | How to deploy |
|---|---|
| **Netlify** | Drag-and-drop `dist/` at netlify.com, or `npx netlify-cli deploy --prod --dir dist` |
| **Vercel** | `npx vercel --prod` from the project root |
| **GitHub Pages** | Push `dist/` contents to a `gh-pages` branch; enable Pages in repo settings |
| **Cloudflare Pages** | Connect the repo; set build command `npm run build`, output dir `dist` |

All of these serve over HTTPS automatically.

---

### Step 5 — Test installation

1. Open the deployed URL in Chrome or Edge
2. Look for the install icon (⊕) in the address bar, or go to **⋮ → Install PicMachina**
3. Confirm installation — the app opens in a standalone window with no browser chrome
4. Disconnect from the internet — the app should still load and function (except AI transforms on first use)
5. Re-grant folder permissions if prompted — File System Access handles survive across sessions

---

## Gotcha: MediaPipe model files

MediaPipe downloads WASM and TFLite model files from CDN at runtime the first time an AI transform is used. These are not pre-bundled.

**Behaviour:**
- First use of any AI transform (`ai-face-privacy`, `ai-remove-bg`, `ai-silhouette`, `ai-smart-redact`) requires internet to fetch the model
- After the first successful fetch the browser caches the model, and subsequent runs work offline
- All non-AI transforms work fully offline immediately after installation

**Optional future improvement**: Copy MediaPipe model files into `public/models/` and update import paths to point to the local copies. This enables fully-offline AI transforms from first use, at the cost of a larger initial download (~20–80 MB depending on models included).

---

## Summary

| Task | Effort |
|---|---|
| Create 3 icon PNG files | Trivial |
| `npm install vite-plugin-pwa` + update `vite.config.js` | ~30 minutes |
| Choose a static host and deploy | ~30 minutes |
| Test install and offline behaviour in Chrome | ~10 minutes |

Total implementation effort is small. Workbox handles all service worker complexity. No changes to app logic, workers, or data layer are needed.
