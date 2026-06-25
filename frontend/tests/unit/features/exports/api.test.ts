import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { TransactionType } from "@/types/api"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── MSW handlers ────────────────────────────────────────────────────────────

const server = setupServer()

beforeEach(() => {
  vi.stubEnv("VITE_API_URL", "http://localhost:5117")
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.resetHandlers()
  server.close()
  vi.restoreAllMocks()
})

// ── Imports under test (after env is stubbed) ───────────────────────────────

const { downloadTransactionsCsv, downloadSummaryCsv } = await import(
  "@/features/exports/api"
)

// ── triggerDownload — exercises URL.createObjectURL + anchor.click + revoke ──

describe("triggerDownload (via downloadTransactionsCsv)", () => {
  it("creates an anchor with the correct download filename, clicks it, and revokes the URL", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return new HttpResponse(new Blob(["id,amount\n1,10"]), {
          status: 200,
          headers: {
            "content-type": "text/csv",
            "content-disposition":
              'attachment; filename="transactions-2026-06.csv"',
          },
        })
      }),
    )

    const createSpy = vi.spyOn(URL, "createObjectURL")
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL")
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    await downloadTransactionsCsv({})

    // Anchor was created with the correct download attribute
    expect(clickSpy).toHaveBeenCalledTimes(1)
    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("transactions-2026-06.csv")
    expect(anchor.href).toMatch(/^blob:/)

    // Object URL lifecycle: create → revoke (no leak)
    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(revokeSpy).toHaveBeenCalledTimes(1)
    expect(createSpy.mock.calls[0][0]).toBeInstanceOf(Blob)
  })

  it("appends and removes the anchor from the document body", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: {
            "content-disposition": 'attachment; filename="t.csv"',
          },
        })
      }),
    )

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    const initialAnchors = document.querySelectorAll("a").length

    await downloadTransactionsCsv({})

    const finalAnchors = document.querySelectorAll("a").length
    expect(finalAnchors).toBe(initialAnchors) // added then removed
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })
})

// ── extractFilename — regex variants ─────────────────────────────────────────

describe("extractFilename (via Content-Disposition header)", () => {
  it("parses a plain filename= header", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: {
            "content-disposition": "attachment; filename=transactions.csv",
          },
        })
      }),
    )

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    await downloadTransactionsCsv({})

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("transactions.csv")
  })

  it("parses a filename* header (RFC 5987)", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: {
            "content-disposition":
              "attachment; filename*=UTF-8''transactions-2026.csv",
          },
        })
      }),
    )

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    await downloadTransactionsCsv({})

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("transactions-2026.csv")
  })

  it("falls back to the default name when Content-Disposition is missing", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return new HttpResponse(new Blob(["x"]), { status: 200 })
      }),
    )

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    await downloadTransactionsCsv({})

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("transactions.csv") // fallback
  })

  it("falls back to the default name when Content-Disposition is unparseable", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/summary.csv", () => {
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: { "content-disposition": "inline" }, // no filename
        })
      }),
    )

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {})

    await downloadSummaryCsv()

    const anchor = clickSpy.mock.instances[0] as HTMLAnchorElement
    expect(anchor.download).toBe("summary.csv") // fallback
  })
})

// ── buildTransactionsQuery — query string mapping ────────────────────────────

describe("buildTransactionsQuery (via download URL)", () => {
  it("maps type=Income (0) to 'income' in the query string", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get(
        "http://localhost:5117/api/exports/transactions.csv",
        ({ request }) => {
          requestedUrls.push(request.url)
          return new HttpResponse(new Blob(["x"]), {
            status: 200,
            headers: { "content-disposition": 'attachment; filename="t.csv"' },
          })
        },
      ),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadTransactionsCsv({ type: TransactionType.Income })

    expect(requestedUrls).toHaveLength(1)
    expect(requestedUrls[0]).toContain("type=income")
  })

  it("maps type=Expense (1) to 'expense' in the query string", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get(
        "http://localhost:5117/api/exports/transactions.csv",
        ({ request }) => {
          requestedUrls.push(request.url)
          return new HttpResponse(new Blob(["x"]), {
            status: 200,
            headers: { "content-disposition": 'attachment; filename="t.csv"' },
          })
        },
      ),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadTransactionsCsv({ type: TransactionType.Expense })

    expect(requestedUrls[0]).toContain("type=expense")
  })

  it("includes categoryId, from, and to when present", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get(
        "http://localhost:5117/api/exports/transactions.csv",
        ({ request }) => {
          requestedUrls.push(request.url)
          return new HttpResponse(new Blob(["x"]), {
            status: 200,
            headers: { "content-disposition": 'attachment; filename="t.csv"' },
          })
        },
      ),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadTransactionsCsv({
      categoryId: "cat-001",
      from: "2026-01-01",
      to: "2026-06-30",
    })

    const url = new URL(requestedUrls[0])
    expect(url.searchParams.get("categoryId")).toBe("cat-001")
    expect(url.searchParams.get("from")).toBe("2026-01-01")
    expect(url.searchParams.get("to")).toBe("2026-06-30")
    // type was not provided, must not appear
    expect(url.searchParams.has("type")).toBe(false)
  })

  it("omits null and empty filter fields", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get(
        "http://localhost:5117/api/exports/transactions.csv",
        ({ request }) => {
          requestedUrls.push(request.url)
          return new HttpResponse(new Blob(["x"]), {
            status: 200,
            headers: { "content-disposition": 'attachment; filename="t.csv"' },
          })
        },
      ),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadTransactionsCsv({
      type: null,
      categoryId: null,
      from: null,
      to: null,
    })

    expect(requestedUrls[0]).not.toContain("type=")
    expect(requestedUrls[0]).not.toContain("categoryId=")
    expect(requestedUrls[0]).not.toContain("from=")
    expect(requestedUrls[0]).not.toContain("to=")
  })

  it("emits no query string when the filter is empty", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get(
        "http://localhost:5117/api/exports/transactions.csv",
        ({ request }) => {
          requestedUrls.push(request.url)
          return new HttpResponse(new Blob(["x"]), {
            status: 200,
            headers: { "content-disposition": 'attachment; filename="t.csv"' },
          })
        },
      ),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadTransactionsCsv({})

    const url = new URL(requestedUrls[0])
    expect(url.pathname).toBe("/api/exports/transactions.csv")
    expect(url.search).toBe("")
  })
})

// ── downloadSummaryCsv — date range ──────────────────────────────────────────

describe("downloadSummaryCsv", () => {
  it("hits the summary endpoint with no query string by default", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get("http://localhost:5117/api/exports/summary.csv", ({ request }) => {
        requestedUrls.push(request.url)
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: { "content-disposition": 'attachment; filename="s.csv"' },
        })
      }),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadSummaryCsv()

    const url = new URL(requestedUrls[0])
    expect(url.pathname).toBe("/api/exports/summary.csv")
    expect(url.search).toBe("")
  })

  it("includes from and to in the query string when provided", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get("http://localhost:5117/api/exports/summary.csv", ({ request }) => {
        requestedUrls.push(request.url)
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: { "content-disposition": 'attachment; filename="s.csv"' },
        })
      }),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadSummaryCsv("2026-01-01", "2026-06-30")

    const url = new URL(requestedUrls[0])
    expect(url.searchParams.get("from")).toBe("2026-01-01")
    expect(url.searchParams.get("to")).toBe("2026-06-30")
  })

  it("includes only 'from' when 'to' is omitted", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get("http://localhost:5117/api/exports/summary.csv", ({ request }) => {
        requestedUrls.push(request.url)
        return new HttpResponse(new Blob(["x"]), {
          status: 200,
          headers: { "content-disposition": 'attachment; filename="s.csv"' },
        })
      }),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await downloadSummaryCsv("2026-01-01")

    const url = new URL(requestedUrls[0])
    expect(url.searchParams.get("from")).toBe("2026-01-01")
    expect(url.searchParams.has("to")).toBe(false)
  })
})

// ── API call shape ───────────────────────────────────────────────────────────

describe("apiClient integration", () => {
  it("requests the transactions endpoint with responseType: 'blob'", async () => {
    // axios adapter is a fetch-based mock — we can't inspect responseType
    // directly, but we can assert the response is a Blob and that no JSON
    // parsing was attempted.
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return new HttpResponse(new Blob(["id,amount\n1,10"]), {
          status: 200,
          headers: { "content-disposition": 'attachment; filename="t.csv"' },
        })
      }),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    // Should not throw — if responseType were 'json' the CSV text would
    // be passed to JSON.parse and throw.
    await expect(downloadTransactionsCsv({})).resolves.toBeUndefined()
  })

  it("propagates network errors", async () => {
    server.use(
      http.get("http://localhost:5117/api/exports/transactions.csv", () => {
        return HttpResponse.json(
          { type: "about:blank", title: "Server Error", status: 500 },
          { status: 500 },
        )
      }),
    )

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {})

    await expect(downloadTransactionsCsv({})).rejects.toThrow()
  })
})
