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
