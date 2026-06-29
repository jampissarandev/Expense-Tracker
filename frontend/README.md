# ExpenseTracker — Frontend

React + TypeScript + Vite SPA for the ExpenseTracker API.

See `docs/SPEC.md` and `docs/api-contract.md` for product + API reference.

## CSRF (D2 / R8)

The API's cookie-bearing, state-changing endpoints (e.g. `POST /api/auth/logout`)
are protected by ASP.NET Core's antiforgery middleware with the
double-submit-cookie pattern:

- Cookie: `XSRF-TOKEN` (set by the backend, **not** `HttpOnly` so JS can read it)
- Header: `X-XSRF-TOKEN` (must echo the cookie value)

`src/lib/apiClient.ts` reads the cookie via `document.cookie` and sets the
header on every non-safe request (POST, PUT, PATCH, DELETE) through an
axios request interceptor. Safe methods (GET, HEAD, OPTIONS) deliberately
do **not** carry the header.

The wiring is graceful: if the cookie is missing (e.g. before backend B2
ships), the request still goes through without the header. The
interceptor never blocks traffic on its own — it only **adds** the header
when the cookie is present.

If you need to call a state-changing endpoint from a place that does not
go through `apiClient` (e.g. a raw `fetch`):

```ts
const cookie = document.cookie
  .split("; ")
  .find((c) => c.startsWith("XSRF-TOKEN="))
  ?.slice("XSRF-TOKEN=".length);

await fetch("/api/some-endpoint", {
  method: "POST",
  credentials: "include",
  headers: {
    "Content-Type": "application/json",
    ...(cookie ? { "X-XSRF-TOKEN": decodeURIComponent(cookie) } : {}),
  },
  body: JSON.stringify(payload),
});
```

## External script policy (R14 / D3)

This project has **no external scripts today** — the only `<script>` in
[`index.html`](index.html) is `/src/main.tsx`, which Vite serves from the
same origin. Same-origin resources are trusted by the browser and **do
not need** subresource integrity (SRI).

### The rule

If anyone ever adds a `<script src="…">` or `<link rel="stylesheet"
href="…">` that points at a non-`self` origin (a CDN, a third-party
analytics snippet, a font host, etc.), the element **must** include
both:

- `integrity="sha384-…"` — the base64-encoded SHA-384 hash of the file.
- `crossorigin="anonymous"` — so the browser performs a CORS fetch and
  can compare the hash against the response.

Without both, a compromised CDN (think the historical `event-stream`,
`node-ipc`, `ua-parser-js` incidents) can ship arbitrary code into the
page and the browser will execute it without complaint. SRI is the
defense-in-depth that catches that class of bug.

### How to compute the hash

For a pinned version of an external asset, generate the integrity value
once and commit it. Re-generate only when you intentionally upgrade the
asset version.

```bash
# From the asset URL (after pinning the version, e.g. /lib@1.2.3/…):
curl -sS https://cdn.example.com/lib@1.2.3/lib.min.js | \
  openssl dgst -sha384 -binary | \
  openssl base64 -A
# → paste the output as integrity="sha384-<…>"
```

Or with `shasum`:

```bash
curl -sSL https://cdn.example.com/lib@1.2.3/lib.min.js | \
  openssl dgst -sha384 -binary | openssl base64 -A
```

### Good vs. bad

```html
<!-- ✅ Bad: CDN, no SRI, no crossorigin. -->
<script src="https://cdn.example.com/lib@latest/lib.min.js"></script>

<!-- ✅ Good: pinned version, SRI hash, crossorigin. -->
<script
  src="https://cdn.example.com/lib@1.2.3/lib.min.js"
  integrity="sha384-oqVuAfXRKap7fdgcCY5uykM6+R9GqQ8K/uxy9rx7HNQlGYl1kPzQho1wx4JwY8wC"
  crossorigin="anonymous"
></script>
```

### What counts as "external"

| Origin | SRI required? | Reason |
|---|---|---|
| `/src/main.tsx`, `/favicon.svg`, etc. (served by Vite) | No | Same origin — trusted by browser, CSP `default-src 'self'` allows it |
| Other assets bundled by the build (`/_assets/…`) | No | Same origin — they're emitted by Vite and hash-stable via Rollup |
| Any `https://cdn.*`, `https://unpkg.com`, `https://cdnjs.cloudflare.com`, `https://fonts.googleapis.com`, etc. | **Yes** | Browser has no reason to trust a third party; the server could be compromised |
| `data:` and `blob:` URLs (e.g. inline images) | N/A | SRI does not apply; CSP `img-src` is the right control there |

### Fallback plan

If the upstream CDN cannot provide a stable hash (rare, but happens
with dynamically built bundles), prefer self-hosting the asset instead
of dropping SRI. "We trust the vendor" is not a defense.

### Reference

- MDN — [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- W3C SRI spec — <https://www.w3.org/TR/SRI/>
- Origin of this rule: `docs/plans/security-hardening.md` §D3 (R14)

---

# React + TypeScript + Vite

> The remainder of this file is the unmodified Vite template that was
> checked in when the project was scaffolded.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
