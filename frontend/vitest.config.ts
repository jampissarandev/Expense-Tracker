import path from "path"
import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "src": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "happy-dom",
    pool: "threads",
    // happy-dom installs a Window-level fetch stub that throws
    // "Failed to execute fetch() on Window". unstubGlobals restores
    // the real Node.js (undici) fetch before each test so MSW can
    // intercept it. We keep setup.ts as a fallback for the initial
    // environmentbootstrap phase before the first test runs.
    unstubGlobals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
})
