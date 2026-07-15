import "@testing-library/jest-dom"
import { createRequire } from "node:module"
import { beforeEach } from "vitest"

// happy-dom replaces globalThis.fetch with a stub that throws
// "Failed to execute fetch() on Window". Restore the real Node.js fetch
// (undici-backed) so MSW's FetchInterceptor can patch it properly in
// server.listen(), and direct fetch() calls in test mocks work too.
//
// The restoration must run both at setup-file load time (for the initial
// bootstrap) and before each test via beforeEach, because happy-dom may
// re-install its Window.fetch stub when vitest reinitializes the
// environment between test files in isolated mode.
const _require = createRequire(import.meta.url)
const undici = _require("undici") as typeof import("undici")

function restoreRealFetch() {
  if (undici.fetch) {
    Object.defineProperty(globalThis, "fetch", {
      value: undici.fetch,
      writable: true,
      configurable: true,
    })
  }
}

restoreRealFetch()
beforeEach(restoreRealFetch)
