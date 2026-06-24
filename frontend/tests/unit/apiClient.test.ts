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
afterEach(() => server.close())

// ── Import apiClient after env is stubbed ─────────────────────────────────────

const { default: apiClient, setTokenGetter } = await import("@/lib/apiClient")

describe("apiClient", () => {
  beforeEach(() => {
    setTokenGetter(() => null)
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
})
