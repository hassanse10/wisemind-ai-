import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: resolve(__dirname, 'src'),
  // root is src/, so Vite's default publicDir would be src/public. Point it at
  // the real top-level public/ so manifest.json + icons/ are copied into dist/.
  publicDir: resolve(__dirname, 'public'),
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: resolve(__dirname, 'src/background/index.ts'),
        popup: resolve(__dirname, 'src/popup.html'),
        newtab: resolve(__dirname, 'src/newtab.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel.html'),
        settings: resolve(__dirname, 'src/settings.html'),
        activityMonitor: resolve(__dirname, 'src/content/activityMonitor.ts'),
        shortVideoDetector: resolve(__dirname, 'src/content/shortVideoDetector.ts'),
        mindfulOverlay: resolve(__dirname, 'src/content/mindfulOverlay.ts'),
        windDownTint: resolve(__dirname, 'src/content/windDownTint.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name].[ext]',
        // Isolate React (and friends) into its own chunk. Otherwise Rollup
        // merges React with other shared code (e.g. idb) into one chunk, and
        // because the background service worker imports the db layer — which
        // shares that chunk — the worker would load React's module-level code,
        // which references `document`. A service worker has no `document`, so
        // it crashes on registration ("document is not defined"). Keeping React
        // in a dedicated chunk that the worker never imports prevents this.
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|scheduler|react\/jsx-runtime)[\\/]/.test(id)) {
            return 'react-vendor'
          }
          return undefined
        },
      },
    },
  },
})
