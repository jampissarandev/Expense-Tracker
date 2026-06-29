import { describe, it, expect, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCspPolicy, CSP_DIRECTIVES } from "@/lib/csp";

// This is a build-artifact regression test. It reads `dist/index.html`
// (produced by `npm run build`) and asserts that the CSP meta tag is
// present, that the policy is well-formed, and that it reflects the
// production shape (no dev-only hosts).
//
// If the artifact is missing — for example, this test was run before
// `npm run build` — we skip rather than fail. The CI pipeline must run
// `npm run build && npx vitest run` to make this test meaningful.
//
// See R13 / Phase D1 in `docs/plans/security-hardening.md`.

// Resolve relative to the test file itself, not process.cwd(), so the
// test passes regardless of where vitest is invoked from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

// Try a few candidate locations. The test is run from the project root
// (vitest is configured with `root: '.'` in the workspace), and the
// `dist/` directory is one level up from the test file.
const CANDIDATES = [
  resolve(__dirname, "..", "..", "dist", "index.html"),
  resolve(process.cwd(), "dist", "index.html"),
  resolve(__dirname, "..", "..", "..", "dist", "index.html"),
];

function findDistHtml(): string | null {
  for (const candidate of CANDIDATES) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

// Compute once at module load so `it.skipIf` can evaluate synchronously
// (skipIf is evaluated at collection time, not at test-execution time).
const DIST_HTML = findDistHtml();
const HAS_ARTIFACT = DIST_HTML !== null;

describe("dist/index.html CSP meta tag", () => {
  let html: string | null = null;

  beforeAll(() => {
    if (HAS_ARTIFACT) {
      html = readFileSync(DIST_HTML!, "utf8");
    }
  });

  it.skipIf(!HAS_ARTIFACT)("contains exactly one Content-Security-Policy meta tag", () => {
    const matches = html!.match(/http-equiv=["']Content-Security-Policy["']/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBe(1);
  });

  it.skipIf(!HAS_ARTIFACT)("the meta tag is inside <head>", () => {
    const headMatch = html!.match(/<head>([\s\S]*?)<\/head>/);
    expect(headMatch).not.toBeNull();
    expect(headMatch![1]).toContain("Content-Security-Policy");
  });

  it.skipIf(!HAS_ARTIFACT)("policy body contains every required directive", () => {
    const contentMatch = html!.match(
      /http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/,
    );
    expect(contentMatch).not.toBeNull();
    const policy = contentMatch![1].replace(/&#39;/g, "'").replace(/&quot;/g, '"');
    for (const directive of CSP_DIRECTIVES) {
      expect(policy).toContain(`${directive} `);
    }
  });

  it.skipIf(!HAS_ARTIFACT)(
    "production build does NOT include dev-only hosts in connect-src",
    () => {
      const contentMatch = html!.match(
        /http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/,
      );
      const policy = contentMatch![1].replace(/&#39;/g, "'");
      expect(policy).not.toContain("localhost:5117");
      expect(policy).not.toContain("ws://localhost:5173");
    },
  );

  it.skipIf(!HAS_ARTIFACT)("matches the shape produced by buildCspPolicy (isDev=false)", () => {
    const contentMatch = html!.match(
      /http-equiv=["']Content-Security-Policy["']\s+content=["']([^"']+)["']/,
    );
    const policy = contentMatch![1].replace(/&#39;/g, "'");
    const expected = buildCspPolicy({
      connectSrc: ["'self'"],
      isDev: false,
    });
    expect(policy).toBe(expected);
  });
});
