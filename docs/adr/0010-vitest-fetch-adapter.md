# ADR-0010: Vitest + happy-dom Fetch-Adapter Quirks for the API Client

## Status

Accepted

## Date

2026-07-16

## Context

The frontend unit-test environment ([`frontend/vitest.config.ts`](../../frontend/vitest.config.ts)) runs under `vitest` with `environment: "happy-dom"` and `pool: "threads"`. Two pieces of the [API client](../../frontend/src/lib/apiClient.ts) interact with that environment in non-obvious ways, and both used to be documented as a 21-line inline comment at the call site of `axios.create(...)`. That comment made the file harder to read without changing the underlying decisions, so this ADR captures the reasoning once and reduces the inline note to a single-line pointer.

The two quirks are:

1. **`baseURL` is captured at module-load time, not at request time.**
   `import.meta.env.VITE_API_URL` is read once when [`apiClient.ts`](../../frontend/src/lib/apiClient.ts) is first imported, before any test-file top-level code runs. Test files that try to override it via `vi.stubEnv("VITE_API_URL", ...)` therefore set the value too late — `apiClient` has already been initialized with `baseURL === undefined`, and relative URLs like `/api/categories` cannot be resolved.

2. **The default axios adapter order is wrong for the happy-dom + MSW combination.**
   axios's default adapter preference is `["xhr", "http", "fetch"]`. Happy-dom defines `XMLHttpRequest`, so axios happily picks the `xhr` adapter. Happy-dom's XHR is implemented on top of its **own** internal `Fetch` class, which is *not* the same `fetch` that MSW patches via `setupServer()`. Requests therefore leave the test process and MSW never sees them, producing the cryptic error `Failed to execute 'fetch' on Window: Invalid request` (or similar, depending on MSW version).

## Decision

We make two minimal, non-invasive changes:

1. **Set `VITE_API_URL` in `vitest.config.ts` under `test.env`.**
   This guarantees the value is present in `import.meta.env` before the API client module is evaluated. Tests must not rely on `vi.stubEnv` for `VITE_API_URL`.

2. **Force the `fetch` adapter when `import.meta.env.VITEST` is truthy.**
   This is done by spreading `{ adapter: "fetch" }` into the `axios.create` config in the `VITEST` branch only. The `setupFiles` entry in [`tests/unit/setup.ts`](../../frontend/tests/unit/setup.ts) additionally restores the **real** Node.js (undici) `fetch`, `Request`, `Response`, and `Headers` on `globalThis`, so the fetch adapter has matching constructors and MSW can intercept requests uniformly.

The inline comment in `apiClient.ts` is reduced to a single line pointing at this ADR.

## Consequences

### Positive

- `apiClient.ts` stays focused on production behavior; the test-environment workaround is one self-explanatory line.
- Anyone debugging MSW or adapter issues finds the full reasoning here, with cross-links to the relevant config files.
- The decisions are reviewable as a single document, independent of the implementation file.

### Negative / constraints

- The `VITEST` environment flag is set automatically by `vitest` ([docs](https://vitest.dev/config/#environment)), so this branch is only ever taken in test runs — production bundles keep the default adapter order.
- If we ever change the test runner (e.g. move to Node's native test runner + a different DOM shim), the adapter selection must be revisited. The ADR should be updated or superseded at that point.

## How to verify

- `npx vitest run tests/unit/apiClient.test.ts` should pass and exercise MSW-intercepted requests.
- Removing the `...(import.meta.env.VITEST ? { adapter: "fetch" } : {})` spread should make the same tests fail with a fetch/XHR mismatch error.
- Removing `VITE_API_URL` from `test.env` in `vitest.config.ts` should make relative URLs fail to resolve.

## Related

- [`frontend/vitest.config.ts`](../../frontend/vitest.config.ts) — sets `VITE_API_URL` in `test.env` and `environment: "happy-dom"`.
- [`frontend/tests/unit/setup.ts`](../../frontend/tests/unit/setup.ts) — restores undici `fetch`/`Request`/`Response`/`Headers` on `globalThis`.
- [`frontend/src/lib/apiClient.ts`](../../frontend/src/lib/apiClient.ts) — the only consumer; inline comment reduced to a pointer at this ADR.
