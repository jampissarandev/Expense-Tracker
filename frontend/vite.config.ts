import path from 'path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'
import { buildCspPolicy } from './src/lib/csp'

// https://vite.dev/config/

/**
 * Vite plugin that injects a Content-Security-Policy `<meta>` tag into
 * `index.html` at build time. In dev it also emits a
 * `Content-Security-Policy-Report-Only` response header so we observe
 * violations without breaking HMR (HMR uses inline scripts which would
 * otherwise be blocked by `script-src 'self'`).
 *
 * See R13 / Phase D1 in `docs/plans/security-hardening.md`.
 */
function injectCspPlugin(): Plugin {
  return {
    name: 'inject-csp',
    // Runs during dev (transformIndexHtml) and at build time.
    transformIndexHtml: {
      order: 'pre',
      handler(_html, ctx) {
        const isDev = ctx.server !== undefined
        // 'self' is always allowed; in dev we add the localhost API origin
        // and the HMR websocket. In production the API is on the same
        // origin (reverse proxy), so 'self' alone is enough.
        const policy = buildCspPolicy({
          connectSrc: ["'self'"],
          isDev,
        })

        return [
          {
            tag: 'meta',
            attrs: {
              'http-equiv': 'Content-Security-Policy',
              content: policy,
            },
            injectTo: 'head',
          },
        ]
      },
    },
    configureServer(server) {
      // Dev-only: attach a REPORT-ONLY header so we see violations in the
      // browser console / report-uri, but the browser still loads scripts
      // that would otherwise be blocked. This is the recommended way to
      // roll out CSP incrementally.
      server.middlewares.use((_req, res, next) => {
        const policy = buildCspPolicy({
          connectSrc: ["'self'"],
          isDev: true,
        })
        res.setHeader('Content-Security-Policy-Report-Only', policy)
        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    injectCspPlugin(),
    react(),
    tailwindcss(),
    // Generate .gz + .br siblings at build time so a static server (e.g.
    // http-server --brotli --gzip) can serve compressed assets with no
    // runtime cost. This is what production CDNs do, but doing it at
    // build time lets us audit the bundle with the same compression
    // profile that ships to users.
    compression({ algorithm: 'gzip', ext: '.gz', threshold: 1024 }),
    compression({ algorithm: 'brotliCompress', ext: '.br', threshold: 1024 }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'src': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Split heavy vendor code (Recharts = ~400 kB) out of the main bundle
    // so the dashboard route loads only what it needs. This is the single
    // biggest lever for the "unused-javascript" Lighthouse audit.
    rollupOptions: {
      output: {
        manualChunks: (id: string) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('recharts')) return 'vendor-recharts'
          if (id.includes('react-day-picker') || id.includes('date-fns')) return 'vendor-dates'
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('zod')
          )
            return 'vendor-forms'
          if (
            id.includes('@radix-ui') ||
            id.includes('@base-ui')
          )
            return 'vendor-radix'
          if (
            id.includes('react-router') ||
            id.includes('/react/') ||
            id.includes('/react-dom/')
          )
            return 'vendor-react'
          return 'vendor-misc'
        },
      },
    },
    // Raise the chunk-size warning limit so the existing single 1 MB
    // chunk (Recharts) doesn't fail the build.
    chunkSizeWarningLimit: 1500,
  },
})
