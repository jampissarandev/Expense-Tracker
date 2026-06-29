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

## External script policy

If you ever add a `<script src="…">` or `<link href="…">` pointing at a
CDN / non-`self` origin, it **must** include `integrity="sha384-…"` and
`crossorigin="anonymous"`. See D3 in `docs/plans/security-hardening.md`.

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
