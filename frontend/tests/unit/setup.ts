import "@testing-library/jest-dom"
import { createRequire } from "node:module"

// happy-dom replaces globalThis.fetch (and Request, Response, Headers)
// with its own browser-like implementations. When axios uses the
// "fetch" adapter (forced via apiClient's VITEST branch), it reads
// Request/Response from globalThis and passes them to globalThis.fetch.
// If the Request is happy-dom's but fetch is undici's, undici rejects
// it with "Failed to parse URL from [object Request]".
//
// Restore all the fetch-related globals to the real Node.js (undici)
// versions so axios, MSW, and direct fetch() calls all use the same
// implementation. This runs at setup-file load time, before any test
// file's lifecycle hooks.
const _require = createRequire(import.meta.url)
const undici = _require("undici") as typeof import("undici")

function restoreRealFetchGlobals() {
  const props: Array<keyof typeof undici> = [
    "fetch",
    "Request",
    "Response",
    "Headers",
  ]
  for (const name of props) {
    const value = undici[name]
    if (value) {
      Object.defineProperty(globalThis, name, {
        value,
        writable: true,
        configurable: true,
      })
    }
  }
}

restoreRealFetchGlobals()
