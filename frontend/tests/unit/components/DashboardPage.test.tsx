import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── Mock auth module ─────────────────────────────────────────────────────────

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "alice@test.com", displayName: "Alice" },
    accessToken: "test-token",
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

// ── Mock export functions ────────────────────────────────────────────────────

const { mockDownloadTransactionsCsv, mockDownloadSummaryCsv } = vi.hoisted(
  () => ({
    mockDownloadTransactionsCsv: vi.fn(),
    mockDownloadSummaryCsv: vi.fn(),
  }),
)
vi.mock("@/features/exports/api", () => ({
  downloadTransactionsCsv: mockDownloadTransactionsCsv,
  downloadSummaryCsv: mockDownloadSummaryCsv,
}))

// ── Test data ───────────────────────────────────────────────────────────────

const mockDashboardData = {
  currentMonth: {
    income: "50000.00",
    expense: "12500.50",
    balance: "37499.50",
    year: 2026,
    month: 6,
  },
  last6Months: [
    { year: 2026, month: 1, income: "45000.00", expense: "11000.00" },
    { year: 2026, month: 2, income: "45000.00", expense: "12500.00" },
    { year: 2026, month: 3, income: "47000.00", expense: "13000.00" },
    { year: 2026, month: 4, income: "50000.00", expense: "11000.00" },
    { year: 2026, month: 5, income: "50000.00", expense: "12000.00" },
    { year: 2026, month: 6, income: "50000.00", expense: "12500.50" },
  ],
  byCategory: [
    { categoryId: "cat-001", name: "Food", total: "4500.00", count: 24 },
    { categoryId: "cat-002", name: "Transport", total: "2200.00", count: 12 },
    { categoryId: "cat-003", name: "Shopping", total: "1800.00", count: 8 },
    { categoryId: "cat-004", name: "Bills", total: "3000.00", count: 3 },
    { categoryId: "cat-005", name: "Health", total: "500.00", count: 2 },
    { categoryId: "cat-006", name: "Entertainment", total: "500.00", count: 5 },
  ],
}

// ── MSW handler ─────────────────────────────────────────────────────────────

const handlers = [
  http.get("http://localhost:5117/api/dashboard/summary", () => {
    return HttpResponse.json(mockDashboardData)
  }),
]

const server = setupServer(...handlers)

// ── Import after mocks ──────────────────────────────────────────────────────

import DashboardPage from "@/pages/DashboardPage"

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

// ── Empty-state data (still a successful HTTP response with no rows) ────────

const emptyDashboardData = {
  currentMonth: {
    income: "0.00",
    expense: "0.00",
    balance: "0.00",
    year: 2026,
    month: 6,
  },
  last6Months: [],
  byCategory: [],
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  if (process.env.CI) {
    const f = globalThis.fetch?.toString().slice(0, 50) ?? "undefined"
    console.log(`[Dashboard beforeEach-before-listen] fetch=${f}`)
  }
  vi.stubEnv("VITE_API_URL", "http://localhost:5117")
  server.resetHandlers()
  server.listen({ onUnhandledRequest: "bypass" })
  if (process.env.CI) {
    const f = globalThis.fetch?.toString().slice(0, 50) ?? "undefined"
    console.log(`[Dashboard beforeEach-after-listen] fetch=${f}`)
  }
})

afterEach(() => {
  server.close()
  vi.restoreAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe("DashboardPage", () => {
  it("renders KPI cards with formatted values", async () => {
    renderWithProviders(<DashboardPage />)

    // Wait for data — "คงเหลือ" appears only in the balance KPI card
    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    expect(screen.getByText("฿50,000.00")).toBeInTheDocument()
    expect(screen.getByText("฿12,500.50")).toBeInTheDocument()
    expect(screen.getByText("฿37,499.50")).toBeInTheDocument()

    // Month label in Buddhist year (appears in all 3 KPI cards)
    const monthLabels = screen.getAllByText(/มิ.ย. 2569/)
    expect(monthLabels.length).toBe(3)
  })

  it("renders line chart with 6 months trend", async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("แนวโน้ม 6 เดือน")).toBeInTheDocument()
    })

    // KPI card month labels still exist after line chart renders
    expect(screen.getAllByText(/มิ.ย. 2569/).length).toBeGreaterThanOrEqual(1)
  })

  it("renders category chart with top categories", async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("หมวดหมู่รายจ่าย")).toBeInTheDocument()
    })

    // Category toggle buttons exist
    expect(screen.getByRole("button", { name: "รายจ่าย" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "รายรับ" })).toBeInTheDocument()
  })

  it("shows loading skeleton while fetching", () => {
    // Override handler to never resolve
    server.use(
      http.get(
        "http://localhost:5117/api/dashboard/summary",
        () => new Promise(() => {}),
      ),
    )

    renderWithProviders(<DashboardPage />)

    // During loading state, the component renders a container with
    // `role="status"` via EmptyState when no data. But the loading
    // skeleton renders without a status role — verify skeletons exist.
    const skeletons = document.querySelectorAll('[data-slot="skeleton"]')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it("shows error state on fetch failure", async () => {
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", () => {
        return HttpResponse.json(
          { type: "about:blank", title: "Internal Server Error", status: 500 },
          { status: 500 },
        )
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(
        screen.getByText("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ"),
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument()
  })

  it("toggles between income and expense category view", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("หมวดหมู่รายจ่าย")).toBeInTheDocument()
    })

    // Click "รายรับ" toggle button
    await user.click(screen.getByRole("button", { name: "รายรับ" }))

    await waitFor(() => {
      expect(screen.getByText("หมวดหมู่รายรับ")).toBeInTheDocument()
    })
  })

  // ── Coverage gaps filled below ──────────────────────────────────────────

  it("calls /api/dashboard/summary?type=expense by default", async () => {
    const requestedUrls: string[] = []
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", ({ request }) => {
        requestedUrls.push(request.url)
        return HttpResponse.json(mockDashboardData)
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    expect(requestedUrls.some((u) => u.includes("type=expense"))).toBe(true)
  })

  it("refetches with ?type=income when user toggles the category view", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()

    const requestedTypes: string[] = []
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", ({ request }) => {
        const t = new URL(request.url).searchParams.get("type")
        if (t) requestedTypes.push(t)
        return HttpResponse.json(mockDashboardData)
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })
    // Wait until the expense fetch has been recorded
    await waitFor(() => {
      expect(requestedTypes).toContain("expense")
    })

    await user.click(screen.getByRole("button", { name: "รายรับ" }))

    await waitFor(() => {
      expect(requestedTypes).toContain("income")
    })
  })

  it("shows empty state when the response has no byCategory rows", async () => {
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", () => {
        return HttpResponse.json(emptyDashboardData)
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    // Both charts fall back to the localized "no data" copy
    expect(screen.getByText("ไม่มีข้อมูลแนวโน้ม")).toBeInTheDocument()
    expect(screen.getByText("ไม่มีข้อมูลหมวดหมู่")).toBeInTheDocument()
  })

  it("renders the balance in red when the balance is negative", async () => {
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", () => {
        return HttpResponse.json({
          ...mockDashboardData,
          currentMonth: {
            ...mockDashboardData.currentMonth,
            balance: "-1500.25",
          },
        })
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    const balanceNode = screen.getByText("-฿1,500.25")
    expect(balanceNode).toBeInTheDocument()
    expect(balanceNode.className).toMatch(/var\(--danger\)/)
  })

  it("renders the balance in green when the balance is positive", async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    const balanceNode = screen.getByText("฿37,499.50")
    expect(balanceNode).toBeInTheDocument()
    expect(balanceNode.className).toMatch(/var\(--success\)/)
  })

  it("shows error state on 401 unauthorized", async () => {
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", () => {
        return HttpResponse.json(
          {
            type: "about:blank",
            title: "Unauthorized",
            status: 401,
          },
          { status: 401 },
        )
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(
        screen.getByText("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ"),
      ).toBeInTheDocument()
    })
  })

  it("triggers refetch when the error-state retry button is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()

    let callCount = 0
    server.use(
      http.get("http://localhost:5117/api/dashboard/summary", () => {
        callCount++
        if (callCount === 1) {
          return HttpResponse.json(
            { type: "about:blank", title: "Server Error", status: 500 },
            { status: 500 },
          )
        }
        return HttpResponse.json(mockDashboardData)
      }),
    )

    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(
        screen.getByText("โหลดข้อมูลแดชบอร์ดไม่สำเร็จ"),
      ).toBeInTheDocument()
    })

    await user.click(screen.getByRole("button", { name: /try again/i }))

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })
    expect(callCount).toBeGreaterThanOrEqual(2)
  })

  // ── Export tests ────────────────────────────────────────────────────────

  it("renders export button in the header", async () => {
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: /ส่งออก/i })).toBeInTheDocument()
  })

  it("calls downloadSummaryCsv when export summary is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    // Open the export dropdown
    await user.click(screen.getByRole("button", { name: /ส่งออก/i }))

    // Click "ส่งออกรายงานสรุป (CSV)"
    const summaryItem = screen.getByRole("menuitem", { name: /ส่งออกรายงานสรุป.*CSV/i })
    await user.click(summaryItem)

    await waitFor(() => {
      expect(mockDownloadSummaryCsv).toHaveBeenCalledTimes(1)
    })
  })

  it("calls downloadTransactionsCsv when export transactions is clicked", async () => {
    const { default: userEvent } = await import("@testing-library/user-event")
    const user = userEvent.setup()
    renderWithProviders(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText("คงเหลือ")).toBeInTheDocument()
    })

    // Open the export dropdown
    await user.click(screen.getByRole("button", { name: /ส่งออก/i }))

    // Click "ส่งออกรายการ (CSV)"
    const txItem = screen.getByRole("menuitem", { name: /ส่งออกรายการ.*CSV/i })
    await user.click(txItem)

    await waitFor(() => {
      expect(mockDownloadTransactionsCsv).toHaveBeenCalledTimes(1)
    })
  })
})
