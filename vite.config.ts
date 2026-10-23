import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // This app is served next to the console, which owns /assets: its files live under /itsm-static/ (its pages keep their usual addresses).
  base: '/itsm-static/',
  plugins: [react(), tailwindcss()],
  define: {
    global: 'globalThis',
  },
  // Production stack traces are otherwise minified garbage (e.g. "at lh
  // (index-Bfd0Mtbl.js:20:47959)") with no way to tell which component threw -
  // sourcemaps let the browser's devtools resolve those back to real
  // file/line/component names. vite preview serves the .map files
  // automatically alongside the JS, so this needs no other config to take
  // effect once rebuilt.
  build: {
    sourcemap: true,
  },
  server: {
    port: 5174,
    allowedHosts: ['localhost', 'dex.sntecx.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      }
    }
  },
  // `vite preview` serves the production build (npm run build && npm run
  // preview) - used when frontend+backend are colocated on one machine
  // (e.g. a deployment VM) without a separate reverse proxy in front. Mirrors
  // the dev server's proxy so the built app can still call the API and
  // WebSocket via a relative /api, /ws path instead of a baked-in absolute
  // URL - the proxy runs server-side in this same Node process, so
  // "localhost:8080" here always means "this machine's own backend",
  // correct regardless of what host/IP a browser used to reach this page.
  // host: true binds 0.0.0.0 so it's reachable from other machines on the
  // network, not just this one.
  preview: {
    host: true,
    port: 4174,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8080',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
