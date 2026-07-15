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
    // VITE_API_URL must be set here (not via vi.stubEnv in test files)
    // because apiClient.ts evaluates import.meta.env.VITE_API_URL at
    // module-load time, before any test-file top-level code runs.
    // Without it, baseURL is undefined and the fetch adapter cannot
    // resolve relative URLs like "/api/categories".
    env: {
      VITE_API_URL: "http://localhost:5117",
    },
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
  },
})
