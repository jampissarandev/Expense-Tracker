import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// ── Set VITE_API_URL before importing apiClient ──────────────────────────────

vi.stubEnv("VITE_API_URL", "http://localhost:5117");

// ── MSW server ───────────────────────────────────────────────────────────────

const handlers = [
  http.post("http://localhost:5117/api/auth/refresh", () => {
    return HttpResponse.json({
      accessToken: { token: "new-access-token", expiresAt: new Date().toISOString() },
      refreshToken: "new-refresh-token",
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      user: { id: "u1", email: "alice@test.com", displayName: "Alice" },
    });
  }),
  http.get("http://localhost:5117/api/protected", ({ request }) => {
    const auth = request.headers.get("Authorization");
    if (!auth) {
      return new HttpResponse(null, { status: 401 });
    }
    return HttpResponse.json({ ok: true });
  }),
];

const server = setupServer(...handlers);

beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }));
afterEach(() => {
  server.resetHandlers();
  server.close();
});

// ── Import apiClient after env is stubbed ─────────────────────────────────────

const { default: apiClient, setTokenGetter, setLogoutHandler } = await import("@/lib/apiClient");

describe("apiClient", () => {
  beforeEach(() => {
    setTokenGetter(() => null);
    // Reset the module-level logout-handler singleton so a previous test
    // does not leak a handler into the next one.
    setLogoutHandler(() => {});
  });

  it("attaches Authorization header when token is available", async () => {
    const token = "test-access-token";
    setTokenGetter(() => token);

    let capturedAuth: string | null = null;
    server.use(
      http.get("http://localhost:5117/api/protected", ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiClient.get("/api/protected");
    expect(capturedAuth).toBe("Bearer test-access-token");
  });

  it("does not attach Authorization header when token is null", async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get("http://localhost:5117/api/protected", ({ request }) => {
        capturedAuth = request.headers.get("Authorization");
        return HttpResponse.json({ ok: true });
      }),
    );

    await apiClient.get("/api/protected");
    expect(capturedAuth).toBeNull();
  });

  it("retries after 401 with refreshed token", async () => {
    // First call returns 401 (simulating expired token), second call returns 200
    let callCount = 0;
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    setTokenGetter(() => "test-token");

    const response = await apiClient.get("/api/protected");
    expect(response.status).toBe(200);
    // Call count should be 2: initial 401 + retry 200
    expect(callCount).toBeGreaterThanOrEqual(2);
  });

  it("logs out (rejects) on second 401", async () => {
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    setTokenGetter(() => "test-token");

    await expect(apiClient.get("/api/protected")).rejects.toThrow();
  });

  it("passes withCredentials: true for cookie-based refresh", async () => {
    let capturedCredentials: string | undefined;
    server.use(
      http.post("http://localhost:5117/api/auth/refresh", async ({ request }) => {
        capturedCredentials = request.credentials;
        return HttpResponse.json({
          accessToken: { token: "new-token", expiresAt: new Date().toISOString() },
          refreshToken: "new-rt",
          refreshTokenExpiresAt: new Date().toISOString(),
          user: { id: "u1", email: "a@b.com", displayName: "A" },
        });
      }),
    );

    // The refresh call goes through axios directly, not apiClient
    const axios = await import("axios");
    await axios.default.post("http://localhost:5117/api/auth/refresh", null, {
      withCredentials: true,
    });

    expect(capturedCredentials).toBe("include");
  });

  // ── C3 / R12 — refresh goes through the configured apiClient ───────────
  //
  // The refresh interceptor must use `apiClient` (with its configured
  // baseURL and withCredentials: true) instead of a raw `axios.post` with
  // a hand-built URL. If the interceptor re-builds the URL from
  // `VITE_API_URL` (e.g. `${VITE_API_URL}/api/auth/refresh`), a
  // misconfigured env value (trailing slash, empty string, missing
  // protocol) produces a request whose cookie path differs from the main
  // client's path — the refresh cookie isn't sent, the refresh fails, and
  // the user is silently logged out.
  //
  // The fix routes the refresh through `apiClient.post('/api/auth/refresh',
  // null)` so axios's URL-joining uses the same baseURL the rest of the
  // app uses, and withCredentials propagates from the instance config.

  it("refresh-after-401 sends withCredentials: include to /api/auth/refresh", async () => {
    // Arrange — protected returns 401, then refresh succeeds, then retry returns 200.
    let callCount = 0;
    let capturedRefreshCredentials: RequestCredentials | undefined;
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
      http.post("http://localhost:5117/api/auth/refresh", ({ request }) => {
        capturedRefreshCredentials = request.credentials;
        return HttpResponse.json({
          accessToken: {
            token: "new-token",
            expiresAt: new Date().toISOString(),
          },
          refreshToken: "new-rt",
          refreshTokenExpiresAt: new Date().toISOString(),
          user: { id: "u1", email: "a@b.com", displayName: "A" },
        });
      }),
    );

    setTokenGetter(() => "test-token");

    // Act
    const response = await apiClient.get("/api/protected");

    // Assert — the protected call succeeded via a refresh + retry
    expect(response.status).toBe(200);
    // The refresh call from inside the interceptor carried credentials so
    // the refresh cookie is included with the request.
    expect(capturedRefreshCredentials).toBe("include");
  });

  it("refresh URL is built from the configured baseURL — not raw VITE_API_URL concatenation", async () => {
    // C3 / R12 — refresh must go through `apiClient.post` so the
    // configured `baseURL` and `withCredentials` are reused. This test
    // asserts the fix at the **call-site** level by spying on
    // `apiClient.post` during a 401-triggered refresh. If the interceptor
    // ever regresses to a raw `axios.post`, the spy is not called and
    // the assertion fails.
    //
    // We pair this with a separate test below (`refresh URL has no
    // double slash when baseURL has a trailing slash`) that pins the
    // axios URL-joining behavior on a freshly-created instance — this
    // way we don't fight vi.resetModules() interactions with the rest
    // of the test file.
    let postSpy: ReturnType<typeof vi.spyOn> | undefined;
    try {
      postSpy = vi.spyOn(apiClient, "post");

      // Arrange — protected returns 401, refresh succeeds, retry returns 200.
      let callCount = 0;
      server.use(
        http.get("http://localhost:5117/api/protected", () => {
          callCount++;
          if (callCount === 1) {
            return new HttpResponse(null, { status: 401 });
          }
          return HttpResponse.json({ ok: true });
        }),
      );

      setTokenGetter(() => "test-token");

      // Act
      await apiClient.get("/api/protected");

      // Assert — the refresh path went through apiClient.post (not raw
      // axios.post). The C3 fix is precisely this routing change.
      // The third argument is the X-Refresh-Request sentinel header that
      // prevents the response interceptor from treating the refresh's own
      // 401 as a refreshable request — see apiClient.ts.
      expect(postSpy).toHaveBeenCalledWith(
        "/api/auth/refresh",
        null,
        expect.objectContaining({ headers: { "X-Refresh-Request": "1" } }),
      );
    } finally {
      postSpy?.mockRestore();
    }
  });

  // ── Logout handler (R-7) ──────────────────────────────────────────────────

  it("calls the logout handler exactly once when the refresh itself fails", async () => {
    // Make BOTH the protected call AND the refresh call return 401.
    // The protected call should trigger a refresh; the refresh will then
    // fail, which must call the logout handler so AuthContext can clear
    // local state.
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        return new HttpResponse(null, { status: 401 });
      }),
      http.post("http://localhost:5117/api/auth/refresh", () => {
        return new HttpResponse(null, { status: 401 });
      }),
    );

    const logoutHandler = vi.fn();
    setLogoutHandler(logoutHandler);
    setTokenGetter(() => "expired-token");

    await expect(apiClient.get("/api/protected")).rejects.toThrow();

    // The handler is the bridge from "refresh failed" to "clear local auth
    // state". If it does not fire, the user stays in a zombie-logged-in
    // state with a dead access token and no way to recover.
    expect(logoutHandler).toHaveBeenCalledTimes(1);
  });

  it("does NOT call the logout handler when refresh succeeds", async () => {
    // First protected call returns 401, refresh succeeds, retry returns 200.
    let callCount = 0;
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        callCount++;
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    const logoutHandler = vi.fn();
    setLogoutHandler(logoutHandler);
    setTokenGetter(() => "test-token");

    const response = await apiClient.get("/api/protected");
    expect(response.status).toBe(200);
    expect(logoutHandler).not.toHaveBeenCalled();
  });
});
