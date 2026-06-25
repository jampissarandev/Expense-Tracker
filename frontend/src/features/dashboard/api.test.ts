import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

// ── Set VITE_API_URL before importing apiClient ──────────────────────────────

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── MSW server: dashboard summary endpoint ───────────────────────────────────

const summaryUrl = "http://localhost:5117/api/dashboard/summary"

const handlers = [
  http.get(summaryUrl, ({ request }) => {
    const url = new URL(request.url)
    const type = url.searchParams.get("type")
    return HttpResponse.json({
      currentMonth: {
        income: "0.00",
        expense: "0.00",
        balance: "0.00",
        year: 2026,
        month: 1,
      },
      last6Months: [],
      byCategory: [],
      __echoType: type,
    })
  }),
]

const server = setupServer(...handlers)

beforeEach(() => server.listen({ onUnhandledRequest: "bypass" }))
afterEach(() => server.close())

// ── Import after mocks ──────────────────────────────────────────────────────

const {
  getDashboardSummary,
  useDashboardSummary,
  dashboardKeys,
} = await import("@/features/dashboard/api")

const { default: apiClient } = await import("@/lib/apiClient")

// ── Tests ────────────────────────────────────────────────────────────────────

describe("dashboardKeys", () => {
  it("builds root key", () => {
    expect(dashboardKeys.all).toEqual(["dashboard"])
  })

  it("builds summary key without type", () => {
    expect(dashboardKeys.summary()).toEqual(["dashboard", "summary", undefined])
  })

  it("builds summary key with income type", () => {
    expect(dashboardKeys.summary("income")).toEqual([
      "dashboard",
      "summary",
      "income",
    ])
  })

  it("builds summary key with expense type", () => {
    expect(dashboardKeys.summary("expense")).toEqual([
      "dashboard",
      "summary",
      "expense",
    ])
  })
})

describe("getDashboardSummary", () => {
  it("calls /api/dashboard/summary without query param when no filter is provided", async () => {
    const getSpy = vi.spyOn(apiClient, "get")
    await getDashboardSummary()

    expect(getSpy).toHaveBeenCalledWith("/api/dashboard/summary")
  })

  it("calls /api/dashboard/summary without query param when filter is empty", async () => {
    const getSpy = vi.spyOn(apiClient, "get")
    await getDashboardSummary({})

    expect(getSpy).toHaveBeenCalledWith("/api/dashboard/summary")
  })

  it("appends ?type=expense when filter.type is 'expense'", async () => {
    const getSpy = vi.spyOn(apiClient, "get")
    await getDashboardSummary({ type: "expense" })

    expect(getSpy).toHaveBeenCalledWith("/api/dashboard/summary?type=expense")
  })

  it("appends ?type=income when filter.type is 'income'", async () => {
    const getSpy = vi.spyOn(apiClient, "get")
    await getDashboardSummary({ type: "income" })

    expect(getSpy).toHaveBeenCalledWith("/api/dashboard/summary?type=income")
  })

  it("returns the parsed JSON payload", async () => {
    const data = await getDashboardSummary()
    expect(data).toMatchObject({
      currentMonth: { year: 2026, month: 1 },
      last6Months: [],
      byCategory: [],
    })
  })
})

describe("useDashboardSummary", () => {
  it("exports a callable React hook", () => {
    expect(typeof useDashboardSummary).toBe("function")
  })
})
