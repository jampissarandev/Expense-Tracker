import "@testing-library/jest-dom"
import { createRequire } from "node:module"

// happy-dom replaces globalThis.fetch with a stub that throws
// "Failed to execute fetch() on Window". Restore the real Node.js fetch
// (undici-backed) so MSW's FetchInterceptor can patch it properly in
// server.listen(), and direct fetch() calls in test mocks work too.
const _require = createRequire(import.meta.url)
const undici = _require("undici") as typeof import("undici")
Object.defineProperty(globalThis, "fetch", {
  value: undici.fetch,
  writable: true,
  configurable: true,
})
