import "@testing-library/jest-dom"
import { createRequire } from "node:module"
import { beforeAll, beforeEach, afterAll, afterEach } from "vitest"

// happy-dom replaces globalThis.fetch with a stub that throws
// "Failed to execute fetch() on Window". Restore the real Node.js fetch
// (undici-backed) so MSW's FetchInterceptor can patch it properly in
// server.listen(), and direct fetch() calls in test mocks work too.
const _require = createRequire(import.meta.url)
const undici = _require("undici") as typeof import("undici")
const dbg = (label: string) => {
  if (process.env.CI) {
    const f = globalThis.fetch?.toString().slice(0, 50) ?? "undefined"
    console.log(`[setup.ts ${label}] fetch=${f}`)
  }
}

function restoreRealFetch() {
  if (undici.fetch) {
    Object.defineProperty(globalThis, "fetch", {
      value: undici.fetch,
      writable: true,
      configurable: true,
    })
  }
}

dbg("module-load-before")
restoreRealFetch()
dbg("module-load-after")

beforeAll(() => { dbg("beforeAll-before-restore"); restoreRealFetch(); dbg("beforeAll-after-restore") })
beforeEach(() => { dbg("beforeEach-before-restore"); restoreRealFetch(); dbg("beforeEach-after-restore") })
afterEach(() => { dbg("afterEach") })
afterAll(() => { dbg("afterAll") })
