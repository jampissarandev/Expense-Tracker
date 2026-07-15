import "@testing-library/jest-dom"

// happy-dom replaces globalThis.fetch with a non-functional stub that
// throws "Failed to execute fetch() on Window". MSW's setupServer only
// patches Node.js http modules — not globalThis.fetch. Direct fetch()
// calls (e.g. in test mock dialog components) hit the broken stub.
// Restore Node.js native fetch (available since Node 18, backed by
// undici in Node 22+) so both MSW-handled and direct fetch() calls work.
Object.defineProperty(globalThis, "fetch", {
  value: globalThis.fetch,
  writable: true,
  configurable: true,
})
