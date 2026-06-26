import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { MemoryRouter } from "react-router-dom"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── Mock auth module ─────────────────────────────────────────────────────────

vi.mock("@/features/auth/AuthContext", () => ({
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

// ── Mock Select — Base UI popovers don't work in happy-dom ──────────────────
// Replace with a deterministic button-driven mock. The trigger passes its
// `id` and `aria-label` through to the button so tests can target it via
// getByLabelText / getByRole.

vi.mock("@/components/ui/select", () => {
  // Walks Select children to harvest SelectItem options.
  function harvestItems(node: React.ReactNode): {
    value: string
    label: string
  }[] {
    const items: { value: string; label: string }[] = []
    function walk(child: React.ReactNode) {
      React.Children.forEach(child, (c) => {
        if (!React.isValidElement(c)) return
        const childType = c.type as
          | { displayName?: string }
          | ((...args: unknown[]) => unknown)
        const displayName =
          typeof childType === "object" && childType !== null
            ? (childType as { displayName?: string }).displayName
            : typeof childType === "function"
              ? (childType as ((...args: never[]) => unknown) & { displayName?: string }).displayName
              : undefined
        if (displayName === "SelectItem") {
          const props = c.props as {
            value: string
            children: React.ReactNode
          }
          const label =
            typeof props.children === "string"
              ? props.children
              : String(props.children)
          items.push({ value: props.value, label })
        }
        if (c.props && "children" in c.props) {
          walk((c.props as { children: React.ReactNode }).children)
        }
      })
    }
    walk(node)
    return items
  }

  // Shared slot: tests can read items by trigger id. The Select Root writes
  // here on every render, and SelectTrigger reads on click. Map is keyed by
  // the trigger's id (which the Root harvests from its first SelectTrigger
  // child).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const triggerRegistry = new Map<string, any>()

  function Select({
    value,
    onValueChange,
    disabled,
    children,
  }: {
    value?: string
    onValueChange?: (value: string) => void
    disabled?: boolean
    children: React.ReactNode
  }) {
    // Walk children to find the SelectTrigger's id and harvest items.
    let triggerId: string | undefined
    function walk(node: React.ReactNode) {
      React.Children.forEach(node, (c) => {
        if (!React.isValidElement(c)) return
        const childType = c.type as
          | { displayName?: string }
          | ((...args: unknown[]) => unknown)
        const displayName =
          typeof childType === "object" && childType !== null
            ? (childType as { displayName?: string }).displayName
            : typeof childType === "function"
              ? (childType as ((...args: never[]) => unknown) & { displayName?: string }).displayName
              : undefined
        if (displayName === "SelectTrigger" && !triggerId) {
          triggerId = (c.props as { id?: string }).id
        }
        if (c.props && "children" in c.props) {
          walk((c.props as { children: React.ReactNode }).children)
        }
      })
    }
    walk(children)
    const items = harvestItems(children)
    if (triggerId) {
      triggerRegistry.set(triggerId, { value, items, onValueChange, disabled })
    }
    // Render children so SelectTrigger, SelectContent, etc. actually mount.
    return <>{children}</>
  }
  Select.displayName = "Select"

  function SelectTrigger({
    id,
    children,
    disabled,
    ...props
  }: {
    id?: string
    children?: React.ReactNode
    disabled?: boolean
    [key: string]: unknown
  }) {
    const handleClick = () => {
      if (!id) return
      const entry = triggerRegistry.get(id)
      if (!entry || entry.onValueChange === undefined) return
      if (entry.disabled) return
      const currentIdx = entry.items.findIndex(
        (i: { value: string }) => i.value === entry.value,
      )
      // From "all" (idx 0), jump to first concrete option (idx 1).
      if (entry.value === "all" && entry.items.length > 1) {
        entry.onValueChange(entry.items[1].value)
        return
      }
      const nextIdx = (currentIdx + 1) % entry.items.length
      entry.onValueChange(entry.items[nextIdx].value)
    }

    const entry = id ? triggerRegistry.get(id) : undefined
    const currentLabel = entry
      ? (entry.items.find((i: { value: string }) => i.value === entry.value)
          ?.label ?? "")
      : ""

    return (
      <button
        type="button"
        id={id}
        data-slot="select"
        data-testid={id ? `select-${id}` : undefined}
        data-value={entry?.value ?? ""}
        onClick={handleClick}
        disabled={entry?.disabled ?? disabled}
        {...props}
      >
        {currentLabel}
        {children}
      </button>
    )
  }
  SelectTrigger.displayName = "SelectTrigger"

  function SelectValue({
    children,
  }: {
    children?: React.ReactNode
    [key: string]: unknown
  }) {
    return <>{children}</>
  }
  SelectValue.displayName = "SelectValue"

  function SelectContent({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
  SelectContent.displayName = "SelectContent"

  function SelectItem({
    value,
    children,
  }: {
    value: string
    children: React.ReactNode
  }) {
    return (
      <option value={value}>
        {typeof children === "string" ? children : ""}
      </option>
    )
  }
  SelectItem.displayName = "SelectItem"

  return { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
})

// ── Mock TransactionFormDialog — renders a simple inline form for testing ───

vi.mock("@/features/transactions/TransactionFormDialog", () => {
  return {
    TransactionFormDialog: function MockTransactionFormDialog({
      open,
      onOpenChange,
      editingTransaction,
    }: {
      open: boolean
      onOpenChange: (open: boolean) => void
      editingTransaction: {
        id: string
        type: number
        categoryId: string
        amount: string
        occurredOn: string
        note: string | null
      } | null
    }) {
      if (!open) return null
      const isEditing = editingTransaction !== null

      async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const form = e.target as HTMLFormElement
        const formData = new FormData(form)
        const type = Number(formData.get("type"))
        const categoryId = formData.get("categoryId") as string
        const amount = formData.get("amount") as string
        const occurredOn = formData.get("occurredOn") as string
        const note = (formData.get("note") as string) || null

        if (isEditing) {
          await fetch(
            `http://localhost:5117/api/transactions/${editingTransaction.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                categoryId,
                type,
                amount,
                occurredOn,
                note,
              }),
            },
          )
        } else {
          await fetch("http://localhost:5117/api/transactions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              categoryId,
              type,
              amount,
              occurredOn,
              note,
            }),
          })
        }
        onOpenChange(false)
      }

      return (
        <div data-slot="dialog-content" role="dialog">
          <h2>{isEditing ? "แก้ไขรายการ" : "เพิ่มรายการใหม่"}</h2>
          <form onSubmit={handleSubmit}>
            <select
              name="type"
              defaultValue={String(editingTransaction?.type ?? 1)}
            >
              <option value="1">รายจ่าย</option>
              <option value="0">รายรับ</option>
            </select>
            <select
              name="categoryId"
              defaultValue={editingTransaction?.categoryId ?? ""}
            >
              <option value="cat-food">Food</option>
              <option value="cat-salary">Salary</option>
            </select>
            <input
              name="amount"
              placeholder="0.00"
              defaultValue={editingTransaction?.amount ?? ""}
            />
            <input
              name="occurredOn"
              type="date"
              defaultValue={editingTransaction?.occurredOn ?? ""}
            />
            <input
              name="note"
              placeholder="หมายเหตุ"
              defaultValue={editingTransaction?.note ?? ""}
            />
            <button type="submit">{isEditing ? "บันทึก" : "สร้าง"}</button>
            <button type="button" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </button>
          </form>
        </div>
      )
    },
  }
})

// ── Mock AlertDialog to render inline (Base UI portals don't work in happy-dom) ──

vi.mock("@/components/ui/alert-dialog", () => {
  function AlertDialogProvider({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) {
    if (!open) return null
    return <>{children}</>
  }
  function AlertDialogContent({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <div role="alertdialog" data-slot="alert-dialog-content" {...props}>
        {children}
      </div>
    )
  }
  function AlertDialogHeader({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <div data-slot="alert-dialog-header" {...props}>
        {children}
      </div>
    )
  }
  function AlertDialogFooter({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <div data-slot="alert-dialog-footer" {...props}>
        {children}
      </div>
    )
  }
  function AlertDialogTitle({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <h2 data-slot="alert-dialog-title" {...props}>
        {children}
      </h2>
    )
  }
  function AlertDialogDescription({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <p data-slot="alert-dialog-description" {...props}>
        {children}
      </p>
    )
  }
  function AlertDialogCancel({
    children,
    onClick,
    disabled,
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    [key: string]: unknown
  }) {
    return (
      <button onClick={onClick} disabled={disabled} {...props}>
        {children}
      </button>
    )
  }
  function AlertDialogAction({
    children,
    onClick,
    disabled,
    className,
    ...props
  }: {
    children: React.ReactNode
    onClick?: () => void
    disabled?: boolean
    className?: string
    [key: string]: unknown
  }) {
    return (
      <button
        onClick={onClick}
        disabled={disabled}
        className={className}
        {...props}
      >
        {children}
      </button>
    )
  }
  return {
    AlertDialog: AlertDialogProvider,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
  }
})

// ── Test data ───────────────────────────────────────────────────────────────

const categories = [
  {
    id: "cat-food",
    userId: null,
    name: "Food",
    type: 1,
    icon: "utensils",
    color: "#FF6B6B",
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
  {
    id: "cat-salary",
    userId: null,
    name: "Salary",
    type: 0,
    icon: "briefcase",
    color: "#2ECC71",
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
  {
    id: "usr-001",
    userId: "u1",
    name: "Coffee",
    type: 1,
    icon: "coffee",
    color: "#8B4513",
    isSystem: false,
    createdAt: "2026-06-24T08:00:00+00:00",
  },
]

const sampleTransactions = [
  {
    id: "tx-001",
    categoryId: "cat-food",
    categoryName: "Food",
    type: 1,
    amount: "150.50",
    occurredOn: "2026-06-25",
    note: "Lunch",
    createdAt: "2026-06-25T12:00:00+00:00",
    updatedAt: "2026-06-25T12:00:00+00:00",
  },
  {
    id: "tx-002",
    categoryId: "cat-salary",
    categoryName: "Salary",
    type: 0,
    amount: "50000.00",
    occurredOn: "2026-06-01",
    note: null,
    createdAt: "2026-06-01T09:00:00+00:00",
    updatedAt: "2026-06-01T09:00:00+00:00",
  },
  {
    id: "tx-003",
    categoryId: "usr-001",
    categoryName: "Coffee",
    type: 1,
    amount: "85.00",
    occurredOn: "2026-06-24",
    note: "Morning latte",
    createdAt: "2026-06-24T08:00:00+00:00",
    updatedAt: "2026-06-24T08:00:00+00:00",
  },
]

// Mutable store for MSW handlers
let txStore: typeof sampleTransactions

function buildPagedResponse(
  items: typeof sampleTransactions,
  page = 1,
  pageSize = 20,
) {
  const start = (page - 1) * pageSize
  const paged = items.slice(start, start + pageSize)
  return {
    items: paged,
    page,
    pageSize,
    totalCount: items.length,
    totalPages: Math.ceil(items.length / pageSize),
  }
}

// ── MSW handlers ────────────────────────────────────────────────────────────

const handlers = [
  http.get("http://localhost:5117/api/categories", () => {
    return HttpResponse.json([...categories])
  }),
  http.get("http://localhost:5117/api/transactions", ({ request }) => {
    const url = new URL(request.url)
    const typeParam = url.searchParams.get("type")
    const categoryParam = url.searchParams.get("categoryId")
    const pageParam = Number(url.searchParams.get("page") ?? "1")
    const pageSizeParam = Number(url.searchParams.get("pageSize") ?? "20")

    let filtered = [...txStore]

    if (typeParam) {
      const typeNum = typeParam === "income" ? 0 : 1
      filtered = filtered.filter((tx) => tx.type === typeNum)
    }
    if (categoryParam) {
      filtered = filtered.filter((tx) => tx.categoryId === categoryParam)
    }

    return HttpResponse.json(
      buildPagedResponse(filtered, pageParam, pageSizeParam),
    )
  }),
  http.post("http://localhost:5117/api/transactions", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const cat = categories.find((c) => c.id === body.categoryId)
    const newTx = {
      id: `tx-${Date.now()}`,
      categoryId: body.categoryId as string,
      categoryName: cat?.name ?? "",
      type: body.type as number,
      amount: body.amount as string,
      occurredOn: body.occurredOn as string,
      note: (body.note as string) ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    txStore.push(newTx)
    return HttpResponse.json(newTx)
  }),
  http.put(
    "http://localhost:5117/api/transactions/:id",
    async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      const idx = txStore.findIndex((tx) => tx.id === params.id)
      if (idx === -1) {
        return HttpResponse.json(
          { type: "about:blank", title: "Not Found", status: 404 },
          { status: 404 },
        )
      }
      const cat = categories.find((c) => c.id === body.categoryId)
      txStore[idx] = {
        ...txStore[idx],
        ...(body as Partial<(typeof txStore)[number]>),
        categoryName: cat?.name ?? txStore[idx].categoryName,
        updatedAt: new Date().toISOString(),
      }
      return HttpResponse.json(txStore[idx])
    },
  ),
  http.delete("http://localhost:5117/api/transactions/:id", ({ params }) => {
    const idx = txStore.findIndex((tx) => tx.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { type: "about:blank", title: "Not Found", status: 404 },
        { status: 404 },
      )
    }
    txStore.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]

const server = setupServer(...handlers)

// ── Import after mocks ──────────────────────────────────────────────────────

import TransactionsPage from "@/pages/TransactionsPage"

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
      <MemoryRouter initialEntries={["/transactions"]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  txStore = [...sampleTransactions]
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.resetHandlers()
  server.close()
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe("TransactionsPage", () => {
  it("renders table with transaction data", async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    expect(screen.getByText("Lunch")).toBeInTheDocument()
    // "Food" and "Salary" appear both in table cells AND category filter dropdown
    // — scope to the table element to avoid false matches
    const table = screen.getByRole("table")
    expect(within(table).getByText("Food")).toBeInTheDocument()
    expect(within(table).getByText("Salary")).toBeInTheDocument()
    expect(screen.getByText("Morning latte")).toBeInTheDocument()
  })

  it("displays correct amount formatting with currency", async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/150\.50/)).toBeInTheDocument()
    })

    // Income amount should have + prefix
    expect(screen.getByText(/\+.*50,000/)).toBeInTheDocument()
    // Expense amount should have - prefix
    expect(screen.getByText(/-.*150\.50/)).toBeInTheDocument()
  })

  it("shows type badges correctly", async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    const badges = screen.getAllByText("รายจ่าย")
    expect(badges.length).toBeGreaterThanOrEqual(2)

    const incomeBadges = screen.getAllByText("รายรับ")
    expect(incomeBadges.length).toBeGreaterThanOrEqual(1)
  })

  it("filters by type using native select", async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // All 3 transactions visible initially — scope to table
    const table = screen.getByRole("table")
    expect(within(table).getByText("Lunch")).toBeInTheDocument()
    expect(within(table).getByText("Salary")).toBeInTheDocument()
    expect(within(table).getByText("Morning latte")).toBeInTheDocument()

    // The type select is the one with id="filter-type" → data-testid="select-filter-type"
    const typeSelectBtn = screen.getByTestId("select-filter-type")
    // Click once: cycles from "all" → "รายรับ" (Income, value=0)
    fireEvent.click(typeSelectBtn)

    // After filtering by income, only Salary (income) should be visible in
    // the table and the expense rows should be gone. The page may briefly
    // render a loading skeleton during the refetch, so re-query the table
    // each time inside waitFor.
    await waitFor(() => {
      const t = screen.getByRole("table")
      expect(within(t).getByText("Salary")).toBeInTheDocument()
      expect(within(t).queryByText("Lunch")).not.toBeInTheDocument()
      expect(within(t).queryByText("Morning latte")).not.toBeInTheDocument()
    })
  })

  it("paginates correctly", async () => {
    // Create enough transactions to trigger pagination (pageSize = 20)
    const manyTransactions = Array.from({ length: 25 }, (_, i) => ({
      id: `tx-many-${i}`,
      categoryId: "cat-food",
      categoryName: "Food",
      type: 1,
      amount: `${i + 1}.00`,
      occurredOn: `2026-06-${String(25 - i).padStart(2, "0")}`,
      note: `Item ${i}`,
      createdAt: `2026-06-25T${String(i).padStart(2, "0")}:00:00+00:00`,
      updatedAt: `2026-06-25T${String(i).padStart(2, "0")}:00:00+00:00`,
    }))

    server.use(
      http.get("http://localhost:5117/api/transactions", ({ request }) => {
        const url = new URL(request.url)
        const pageParam = Number(url.searchParams.get("page") ?? "1")
        const pageSizeParam = Number(url.searchParams.get("pageSize") ?? "20")
        return HttpResponse.json(
          buildPagedResponse(manyTransactions, pageParam, pageSizeParam),
        )
      }),
    )

    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/แสดง 20 จาก 25 รายการ/)).toBeInTheDocument()
    })

    // Should show page 1 / 2
    expect(screen.getByText(/หน้า 1 \/ 2/)).toBeInTheDocument()
  })

  it("opens TransactionFormDialog when add button is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Click add button — the header has the "เพิ่มรายการ" button
    const addButton = screen.getByRole("button", { name: /เพิ่มรายการ$/i })
    await user.click(addButton)

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    expect(screen.getByText("เพิ่มรายการใหม่")).toBeInTheDocument()
  })

  it("opens TransactionFormDialog in edit mode with pre-filled data", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Click edit on the first transaction row
    const editButtons = screen.getAllByRole("button", {
      name: /แก้ไขรายการ/i,
    })
    await user.click(editButtons[0])

    // Dialog should appear in edit mode
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    expect(screen.getByText("แก้ไขรายการ")).toBeInTheDocument()
  })

  it("deletes transaction with confirmation dialog", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Click delete on the first transaction row
    const deleteButtons = screen.getAllByRole("button", {
      name: /ลบรายการ/i,
    })
    await user.click(deleteButtons[0])

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText("ยืนยันการลบ")).toBeInTheDocument()
    })

    // Confirm deletion
    const confirmBtn = screen.getByRole("button", { name: /^ลบ$/i })
    await user.click(confirmBtn)

    // Confirmation dialog should close
    await waitFor(() => {
      expect(screen.queryByText("ยืนยันการลบ")).not.toBeInTheDocument()
    })
  })

  it("shows empty state when no transactions exist", async () => {
    server.use(
      http.get("http://localhost:5117/api/transactions", () => {
        return HttpResponse.json({
          items: [],
          page: 1,
          pageSize: 20,
          totalCount: 0,
          totalPages: 0,
        })
      }),
    )

    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("ยังไม่มีรายการ")).toBeInTheDocument()
    })
  })

  it("shows error state on fetch failure", async () => {
    server.use(
      http.get("http://localhost:5117/api/transactions", () => {
        return HttpResponse.json(
          {
            type: "about:blank",
            title: "Internal Server Error",
            status: 500,
          },
          { status: 500 },
        )
      }),
    )

    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("โหลดข้อมูลไม่สำเร็จ")).toBeInTheDocument()
    })

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument()
  })

  it("shows pagination info", async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText(/แสดง 3 จาก 3 รายการ/)).toBeInTheDocument()
    })

    expect(screen.getByText(/หน้า 1 \/ 1/)).toBeInTheDocument()
  })

  it("resets filters when reset button is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Apply a type filter using the mocked select button (filter-type)
    const typeSelectBtn = screen.getByTestId("select-filter-type")
    // Click: cycles from "all" → "รายรับ" (Income)
    fireEvent.click(typeSelectBtn)

    // Wait for the filtered (income-only) list to render and the expense
    // transactions to be gone. Re-query the table inside waitFor because
    // the page may briefly render a loading skeleton.
    await waitFor(() => {
      const t = screen.getByRole("table")
      expect(within(t).getByText("Salary")).toBeInTheDocument()
      expect(within(t).queryByText("Lunch")).not.toBeInTheDocument()
      expect(within(t).queryByText("Morning latte")).not.toBeInTheDocument()
    })

    // Click reset
    const resetBtn = screen.getByRole("button", { name: /ล้างตัวกรอง/i })
    await user.click(resetBtn)

    // All transactions should be visible again
    await waitFor(() => {
      const t = screen.getByRole("table")
      expect(within(t).getByText("Lunch")).toBeInTheDocument()
      expect(within(t).getByText("Salary")).toBeInTheDocument()
      expect(within(t).getByText("Morning latte")).toBeInTheDocument()
    })
  })

  it("creates transaction and refetches list", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Open the form dialog
    const addButton = screen.getByRole("button", { name: /เพิ่มรายการ$/i })
    await user.click(addButton)

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Fill in the amount
    const amountInput = screen.getByPlaceholderText("0.00")
    await user.type(amountInput, "200.00")

    // Submit
    await user.click(screen.getByRole("button", { name: /^สร้าง$/i }))

    // Dialog should close after successful submission
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("edits transaction and refetches list", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Click edit on the first transaction row
    const editButtons = screen.getAllByRole("button", {
      name: /แก้ไขรายการ/i,
    })
    await user.click(editButtons[0])

    // Dialog should appear in edit mode
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Change the note
    const noteInput = screen.getByPlaceholderText("หมายเหตุ")
    await user.clear(noteInput)
    await user.type(noteInput, "Dinner instead")

    // Submit
    await user.click(screen.getByRole("button", { name: /^บันทึก$/i }))

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  // ── Export tests ────────────────────────────────────────────────────────

  it("renders export button in the header", async () => {
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    expect(screen.getByRole("button", { name: /ส่งออก/i })).toBeInTheDocument()
  })

  it("calls downloadTransactionsCsv when export transactions is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Open the export dropdown
    await user.click(screen.getByRole("button", { name: /ส่งออก/i }))

    // Click "ส่งออกรายการ (CSV)"
    const exportItem = screen.getByRole("menuitem", { name: /ส่งออกรายการ.*CSV/i })
    await user.click(exportItem)

    await waitFor(() => {
      expect(mockDownloadTransactionsCsv).toHaveBeenCalledTimes(1)
    })
  })

  it("includes current filter state in export call", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
    })

    // Apply a type filter — click the type select to cycle from "all" → "รายรับ"
    const typeSelectBtn = screen.getByTestId("select-filter-type")
    fireEvent.click(typeSelectBtn)

    // Wait for the filter to take effect (income-only view)
    await waitFor(() => {
      const t = screen.getByRole("table")
      expect(within(t).queryByText("Lunch")).not.toBeInTheDocument()
    })

    // Open export dropdown and click transactions export
    await user.click(screen.getByRole("button", { name: /ส่งออก/i }))
    const exportItem = screen.getByRole("menuitem", { name: /ส่งออกรายการ.*CSV/i })
    await user.click(exportItem)

    await waitFor(() => {
      expect(mockDownloadTransactionsCsv).toHaveBeenCalledTimes(1)
    })

    // The call should include the type filter
    const filterArg = mockDownloadTransactionsCsv.mock.calls[0][0]
    expect(filterArg).toHaveProperty("type")
    expect(filterArg.type).toBe(0) // TransactionType.Income
  })

  it("calls downloadSummaryCsv when export summary is clicked", async () => {
    const user = userEvent.setup()
    renderWithProviders(<TransactionsPage />)

    await waitFor(() => {
      expect(screen.getByText("25 มิ.ย. 2569")).toBeInTheDocument()
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
})
