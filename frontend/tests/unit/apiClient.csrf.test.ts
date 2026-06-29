// D2 — Frontend CSRF token wiring (R8 / spec §"D2. Frontend CSRF token wiring")
//
// What this test pins:
//   1. GET requests do NOT carry an X-XSRF-TOKEN header.
//   2. POST/PUT/PATCH/DELETE requests DO carry X-XSRF-TOKEN, populated from
//      the value of the `XSRF-TOKEN` cookie (double-submit-cookie pattern).
//   3. When the cookie is missing, no header is sent (graceful no-op until
//      backend B2 is merged — see docs/plans/security-hardening.md#b2-csrf).
//
// Why a request interceptor and not `xsrfCookieName` / `xsrfHeaderName`
// defaults on the axios instance:
//   - axios's built-in `xsrfCookieName`/`xsrfHeaderName` defaults use the
//     axios global `XMLHttpRequest` xhr adapter and do not behave the same
//     under all adapters (e.g. `node` adapter used by MSW tests in
//     `environment: happy-dom` does not see browser cookie state).
//   - The backend (B2) uses `AddAntiforgery(opts => { opts.HeaderName =
//     "X-XSRF-TOKEN"; opts.Cookie.Name = "XSRF-TOKEN" })` — the cookie is
//     NOT HttpOnly so the JS layer must read it via `document.cookie`.
//   - An explicit request interceptor is the most predictable wiring and
//     also gives us a single, testable surface for the CSRF read pattern.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// ── Set VITE_API_URL before importing apiClient ──────────────────────────────

vi.stubEnv("VITE_API_URL", "http://localhost:5117");

// ── MSW server ───────────────────────────────────────────────────────────────

const capturedHeaders: Record<string, string | null> = {};

const handlers = [
  http.get("http://localhost:5117/api/safe", ({ request }) => {
    capturedHeaders["GET"] = request.headers.get("X-XSRF-TOKEN");
    return HttpResponse.json({ ok: true });
  }),
  http.post("http://localhost:5117/api/unsafe", ({ request }) => {
    capturedHeaders["POST"] = request.headers.get("X-XSRF-TOKEN");
    return HttpResponse.json({ ok: true });
  }),
  http.put("http://localhost:5117/api/unsafe", ({ request }) => {
    capturedHeaders["PUT"] = request.headers.get("X-XSRF-TOKEN");
    return HttpResponse.json({ ok: true });
  }),
  http.patch("http://localhost:5117/api/unsafe", ({ request }) => {
    capturedHeaders["PATCH"] = request.headers.get("X-XSRF-TOKEN");
    return HttpResponse.json({ ok: true });
  }),
  http.delete("http://localhost:5117/api/unsafe", ({ request }) => {
    capturedHeaders["DELETE"] = request.headers.get("X-XSRF-TOKEN");
    return HttpResponse.json({ ok: true });
  }),
];

const server = setupServer(...handlers);

beforeEach(() => {
  // happy-dom persists `document.cookie` across tests in the same file —
  // reset it so each case starts from a known state.
  document.cookie = "XSRF-TOKEN=; Path=/; Max-Age=0";
  Object.keys(capturedHeaders).forEach((k) => delete capturedHeaders[k]);
  server.listen({ onUnhandledRequest: "bypass" });
});

afterEach(() => {
  server.resetHandlers();
  server.close();
  document.cookie = "XSRF-TOKEN=; Path=/; Max-Age=0";
});

// ── Import apiClient after env is stubbed ─────────────────────────────────────

const { default: apiClient } = await import("@/lib/apiClient");

describe("apiClient — CSRF (D2 / R8)", () => {
  it("GET does not carry X-XSRF-TOKEN even when the cookie is present", async () => {
    // Arrange — cookie set; capture GET header.
    document.cookie = "XSRF-TOKEN=cookie-value; Path=/";

    // Act
    const response = await apiClient.get("/api/safe");

    // Assert
    expect(response.status).toBe(200);
    expect(capturedHeaders["GET"]).toBeNull();
  });

  it("POST carries X-XSRF-TOKEN when the cookie is present", async () => {
    // Arrange
    document.cookie = "XSRF-TOKEN=abc123; Path=/";

    // Act
    const response = await apiClient.post("/api/unsafe", {});

    // Assert
    expect(response.status).toBe(200);
    expect(capturedHeaders["POST"]).toBe("abc123");
  });

  it("PUT carries X-XSRF-TOKEN when the cookie is present", async () => {
    document.cookie = "XSRF-TOKEN=put-value; Path=/";

    await apiClient.put("/api/unsafe", {});

    expect(capturedHeaders["PUT"]).toBe("put-value");
  });

  it("PATCH carries X-XSRF-TOKEN when the cookie is present", async () => {
    document.cookie = "XSRF-TOKEN=patch-value; Path=/";

    await apiClient.patch("/api/unsafe", {});

    expect(capturedHeaders["PATCH"]).toBe("patch-value");
  });

  it("DELETE carries X-XSRF-TOKEN when the cookie is present", async () => {
    document.cookie = "XSRF-TOKEN=delete-value; Path=/";

    await apiClient.delete("/api/unsafe");

    expect(capturedHeaders["DELETE"]).toBe("delete-value");
  });

  it("POST does NOT carry X-XSRF-TOKEN when the cookie is absent (graceful no-op)", async () => {
    // Arrange — no cookie set (default happy-dom state).

    // Act
    const response = await apiClient.post("/api/unsafe", {});

    // Assert — request still succeeds; the header is just not sent.
    expect(response.status).toBe(200);
    expect(capturedHeaders["POST"]).toBeNull();
  });

  it("decodes a percent-encoded cookie value before sending it as the header", async () => {
    // Backend antiforgery uses `opts.Cookie.HttpOnly = false` and may
    // produce URL-encoded cookie values depending on the token content.
    // Browsers expose `document.cookie` with the raw encoded form. The
    // interceptor must decode so the header matches the value the
    // backend put in the cookie (otherwise antiforgery rejects it).
    document.cookie = "XSRF-TOKEN=hello%20world; Path=/";

    await apiClient.post("/api/unsafe", {});

    expect(capturedHeaders["POST"]).toBe("hello world");
  });
});
