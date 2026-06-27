import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

// ── Set VITE_API_URL before importing apiClient ──────────────────────────────

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── MSW server ───────────────────────────────────────────────────────────────

const handlers = [
  http.post("http://localhost:5117/api/auth/refresh", () => {
    return HttpResponse.json({
      accessToken: { token: "new-access-token", expiresAt: new Date().toISOString() },
      refreshToken: "new-refresh-token",
      refreshTokenExpiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      user: { id: "u1", email: "alice@test.com", displayName: "Alice" },
    })
  }),
  http.get("http://localhost:5117/api/protected", ({ request }) => {
    const auth = request.headers.get("Authorization")
    if (!auth) {
      return new HttpResponse(null, { status: 401 })
    }
    return HttpResponse.json({ ok: true })
  }),
]

const server = setupServer(...handlers)

beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }))
afterEach(() => {
  server.resetHandlers()
  server.close()
})

// ── Import apiClient after env is stubbed ─────────────────────────────────────

const { default: apiClient, setTokenGetter, setLogoutHandler } = await import(
  "@/lib/apiClient"
)

describe("apiClient", () => {
  beforeEach(() => {
    setTokenGetter(() => null)
    // Reset the module-level logout-handler singleton so a previous test
    // does not leak a handler into the next one.
    setLogoutHandler(() => {})
  })

  it("attaches Authorization header when token is available", async () => {
    const token = "test-access-token"
    setTokenGetter(() => token)

    let capturedAuth: string | null = null
    server.use(
      http.get("http://localhost:5117/api/protected", ({ request }) => {
        capturedAuth = request.headers.get("Authorization")
        return HttpResponse.json({ ok: true })
      }),
    )

    await apiClient.get("/api/protected")
    expect(capturedAuth).toBe("Bearer test-access-token")
  })

  it("does not attach Authorization header when token is null", async () => {
    let capturedAuth: string | null = null
    server.use(
      http.get("http://localhost:5117/api/protected", ({ request }) => {
        capturedAuth = request.headers.get("Authorization")
        return HttpResponse.json({ ok: true })
      }),
    )

    await apiClient.get("/api/protected")
    expect(capturedAuth).toBeNull()
  })

  it("retries after 401 with refreshed token", async () => {
    // First call returns 401 (simulating expired token), second call returns 200
    let callCount = 0
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        callCount++
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
    )

    setTokenGetter(() => "test-token")

    const response = await apiClient.get("/api/protected")
    expect(response.status).toBe(200)
    // Call count should be 2: initial 401 + retry 200
    expect(callCount).toBeGreaterThanOrEqual(2)
  })

  it("logs out (rejects) on second 401", async () => {
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        return new HttpResponse(null, { status: 401 })
      }),
    )

    setTokenGetter(() => "test-token")

    await expect(apiClient.get("/api/protected")).rejects.toThrow()
  })

  it("passes withCredentials: true for cookie-based refresh", async () => {
    let capturedCredentials: string | undefined
    server.use(
      http.post("http://localhost:5117/api/auth/refresh", async ({ request }) => {
        capturedCredentials = request.credentials
        return HttpResponse.json({
          accessToken: { token: "new-token", expiresAt: new Date().toISOString() },
          refreshToken: "new-rt",
          refreshTokenExpiresAt: new Date().toISOString(),
          user: { id: "u1", email: "a@b.com", displayName: "A" },
        })
      }),
    )

    // The refresh call goes through axios directly, not apiClient
    const axios = await import("axios")
    await axios.default.post("http://localhost:5117/api/auth/refresh", null, {
      withCredentials: true,
    })

    expect(capturedCredentials).toBe("include")
  })

  // ── Logout handler (R-7) ──────────────────────────────────────────────────

  it("calls the logout handler exactly once when the refresh itself fails", async () => {
    // Make BOTH the protected call AND the refresh call return 401.
    // The protected call should trigger a refresh; the refresh will then
    // fail, which must call the logout handler so AuthContext can clear
    // local state.
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        return new HttpResponse(null, { status: 401 })
      }),
      http.post("http://localhost:5117/api/auth/refresh", () => {
        return new HttpResponse(null, { status: 401 })
      }),
    )

    const logoutHandler = vi.fn()
    setLogoutHandler(logoutHandler)
    setTokenGetter(() => "expired-token")

    await expect(apiClient.get("/api/protected")).rejects.toThrow()

    // The handler is the bridge from "refresh failed" to "clear local auth
    // state". If it does not fire, the user stays in a zombie-logged-in
    // state with a dead access token and no way to recover.
    expect(logoutHandler).toHaveBeenCalledTimes(1)
  })

  it("does NOT call the logout handler when refresh succeeds", async () => {
    // First protected call returns 401, refresh succeeds, retry returns 200.
    let callCount = 0
    server.use(
      http.get("http://localhost:5117/api/protected", () => {
        callCount++
        if (callCount === 1) {
          return new HttpResponse(null, { status: 401 })
        }
        return HttpResponse.json({ ok: true })
      }),
    )

    const logoutHandler = vi.fn()
    setLogoutHandler(logoutHandler)
    setTokenGetter(() => "test-token")

    const response = await apiClient.get("/api/protected")
    expect(response.status).toBe(200)
    expect(logoutHandler).not.toHaveBeenCalled()
  })
})
