import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import compression from 'vite-plugin-compression'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
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
