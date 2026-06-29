// ── Content-Security-Policy (R13 / D1) ────────────────────────────────────
//
// A single source of truth for the frontend's CSP so the same policy can be
// applied to:
//   - the `<meta http-equiv="Content-Security-Policy">` tag injected into
//     `index.html` at build time (production / static hosting), and
//   - the `Content-Security-Policy-Report-Only` response header that Vite
//     emits in dev (so we observe violations without breaking HMR).
//
// Why a module (and not a string in index.html)?
//   - Testable: the exact policy shape is unit-tested below.
//   - Env-aware: `connect-src` differs between dev (http://localhost:5117,
//     ws://localhost:5173) and prod ('self').
//   - Future-proof: the same builder can be reused by the Express/Node
//     preview server (Phase 6) if we ever serve SSR or set the header
//     there too.

/**
 * Every directive this app ships, in the order they appear in the header.
 * Add to this list — the test suite asserts that the policy contains each
 * one, so a missing directive is caught at test time, not in production.
 */
export const CSP_DIRECTIVES = [
  "default-src",
  "img-src",
  "style-src",
  "script-src",
  "font-src",
  "connect-src",
  "frame-ancestors",
  "base-uri",
  "form-action",
] as const;

/**
 * Extras added only in `isDev: true` builds:
 *   - the dev API origin (http://localhost:5117)
 *   - the Vite HMR websocket (ws://localhost:5173)
 * In production the API is reverse-proxied onto the same origin, so
 * `connect-src 'self'` is sufficient.
 */
export const DEV_CSP_EXTRAS = {
  connectSrc: ["http://localhost:5117", "ws://localhost:5173"],
} as const;

export interface CspOptions {
  /**
   * The `connect-src` value as an ordered list of source expressions.
   * The caller decides whether dev extras are included (see `isDev`).
   */
  connectSrc: readonly string[];
  /** When true, dev-only hosts are added to `connect-src`. */
  isDev?: boolean;
}

/**
 * Build the full policy string. The result does not end with a trailing
 * semicolon — the caller (Vite plugin or static `<meta>` serializer) is
 * responsible for adding one. Directives within the body are separated by
 * `; `.
 */
export function buildCspPolicy(options: CspOptions): string {
  const { connectSrc, isDev = false } = options;

  // Compose connect-src: caller's sources + any dev extras.
  const connectSrcValue = isDev ? [...connectSrc, ...DEV_CSP_EXTRAS.connectSrc] : [...connectSrc];

  // The order here matches CSP_DIRECTIVES. We assemble the body as an
  // array and join, which keeps the format predictable for tests.
  const parts: string[] = [
    `default-src 'self'`,
    `img-src 'self' data: blob:`,
    // 'unsafe-inline' is required for Tailwind v4 + inline <style> blobs;
    // tracked as a known tradeoff. Do not add 'unsafe-eval'.
    `style-src 'self' 'unsafe-inline'`,
    `script-src 'self'`,
    `font-src 'self' data:`,
    `connect-src ${connectSrcValue.join(" ")}`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
  ];

  return parts.join("; ");
}
