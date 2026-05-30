import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifestFilename: 'manifest.json',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,gif,svg,woff2,wasm,json,tflite,task}'],
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
      },
      manifest: {
        name: "ZumiLabs Studio",
        short_name: "ZumiLabs Studio",
        description: "Pro Studio Batch Media Processor — local-first, no uploads.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#0B1020",
        theme_color: "#0B1020",
        lang: "en",
        icons: [
          {
            src: "/branding/brand-pack/pwa/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/branding/brand-pack/pwa/icon-192-maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/branding/brand-pack/pwa/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/branding/brand-pack/pwa/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        screenshots: [
          {
            src: "/branding/brand-pack/store-badges/app-store-landscape-1280x720.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "ZumiLabs Studio"
          }
        ],
        categories: ["photo", "productivity", "utilities"]
      }
    })
  ],
  build: {
    target: 'chrome94',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep WASM-heavy AI libs in their own chunks for lazy loading
          'ai-bgremoval': ['@imgly/background-removal'],
          'ai-mediapipe': ['@mediapipe/tasks-vision'],
          'ai-onnx': ['onnxruntime-web'],
          'ai-ocr': ['tesseract.js'],
          // Media output
          'media': ['mp4-muxer', 'gif.js'],
          // Map
          'map': ['leaflet'],
        }
      }
    }
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // These ship their own WASM bundles - exclude from Vite's pre-bundling
    exclude: ['@imgly/background-removal', '@mediapipe/tasks-vision', 'onnxruntime-web', '@xenova/transformers'],
  },
  server: {
    // Respect PORT/HOST set by portless (or other proxy tools)
    port:       parseInt(process.env.PORT) || 5173,
    host:       process.env.HOST           || 'localhost',
    strictPort: !!process.env.PORT,  // error instead of silently picking another port
    headers: {
      // Required for SharedArrayBuffer (used by some WASM libs)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
