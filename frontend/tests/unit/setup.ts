import "@testing-library/jest-dom"
import { createRequire } from "node:module"

// happy-dom replaces globalThis.fetch with a stub that throws
// "Failed to execute fetch() on Window". Restore the real Node.js fetch
// (undici-backed) so MSW's FetchInterceptor can patch it properly in
// server.listen(), and direct fetch() calls in test mocks work too.
//
// This runs at setup-file load time, before any test file's lifecycle
// hooks. The apiClient forces the "http" axios adapter in test env
// (VITEST) so requests flow through the real Node HTTP stack that MSW
// intercepts, rather than happy-dom's XMLHttpRequest which uses its
// own internal Fetch (bypassing MSW).
const _require = createRequire(import.meta.url)
const undici = _require("undici") as typeof import("undici")
if (undici.fetch) {
  Object.defineProperty(globalThis, "fetch", {
    value: undici.fetch,
    writable: true,
    configurable: true,
  })
}
