import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'chrome94',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep WASM-heavy AI libs in their own chunks for lazy loading
          'ai-bgremoval': ['@imgly/background-removal'],
          'ai-mediapipe': ['@mediapipe/tasks-vision'],
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
    exclude: ['@imgly/background-removal', '@mediapipe/tasks-vision'],
  },
  server: {
    headers: {
      // Required for SharedArrayBuffer (used by some WASM libs)
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
