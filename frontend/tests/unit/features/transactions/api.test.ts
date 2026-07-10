import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── MSW server ──────────────────────────────────────────────────────────────

const transactionsUrl = "http://localhost:5117/api/transactions"

const server = setupServer()

beforeEach(() => {
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.resetHandlers()
  server.close()
  vi.restoreAllMocks()
})

// ── Imports under test ──────────────────────────────────────────────────────

const { buildQueryString, listTransactions } = await import(
  "@/features/transactions/api"
)

// ── buildQueryString ────────────────────────────────────────────────────────

describe("buildQueryString", () => {
  it("returns empty string when filter has no params", () => {
    expect(buildQueryString({})).toBe("")
  })

  it("includes sortBy and sortOrder when set", () => {
    const qs = buildQueryString({
      sortBy: "amount",
      sortOrder: "asc",
    })
    expect(qs).toContain("sortBy=amount")
    expect(qs).toContain("sortOrder=asc")
  })

  it("omits sort params when not set", () => {
    const qs = buildQueryString({ page: 1, pageSize: 20 })
    expect(qs).not.toContain("sortBy")
    expect(qs).not.toContain("sortOrder")
  })

  it("includes sortBy only when sortOrder is omitted", () => {
    const qs = buildQueryString({ sortBy: "occurredOn" })
    expect(qs).toContain("sortBy=occurredOn")
    expect(qs).not.toContain("sortOrder")
  })

  it("handles all TransactionSortBy values", () => {
    const values = ["occurredOn", "type", "categoryName", "amount", "note"] as const
    for (const sortBy of values) {
      const qs = buildQueryString({ sortBy, sortOrder: "desc" })
      expect(qs).toContain(`sortBy=${sortBy}`)
    }
  })

  it("preserves other filter params alongside sort", () => {
    const qs = buildQueryString({
      type: 1,
      sortBy: "amount",
      sortOrder: "desc",
      page: 2,
    })
    expect(qs).toContain("sortBy=amount")
    expect(qs).toContain("sortOrder=desc")
    expect(qs).toContain("type=expense")
    expect(qs).toContain("page=2")
  })
})

// ── listTransactions — URL passed to API ────────────────────────────────────

describe("listTransactions", () => {
  it("sends sort query params when sortBy is provided", async () => {
    let capturedUrl = ""
    server.use(
      http.get(transactionsUrl, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        })
      }),
    )

    await listTransactions({
      sortBy: "amount",
      sortOrder: "asc",
    })

    const url = new URL(capturedUrl)
    expect(url.searchParams.get("sortBy")).toBe("amount")
    expect(url.searchParams.get("sortOrder")).toBe("asc")
  })

  it("does not send sort params when sortBy is omitted", async () => {
    let capturedUrl = ""
    server.use(
      http.get(transactionsUrl, ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        })
      }),
    )

    await listTransactions({ page: 1 })

    const url = new URL(capturedUrl)
    expect(url.searchParams.has("sortBy")).toBe(false)
    expect(url.searchParams.has("sortOrder")).toBe(false)
  })
})
