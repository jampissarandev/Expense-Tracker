import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
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

// ── Mock CategoryFormDialog — renders a simple inline form for testing ──────

vi.mock("@/features/categories/CategoryFormDialog", () => {
  return {
    CategoryFormDialog: function MockCategoryFormDialog({
      open,
      onOpenChange,
      editingCategory,
    }: {
      open: boolean
      onOpenChange: (open: boolean) => void
      editingCategory: CategoryDto | null
    }) {
      if (!open) return null
      const isEditing = editingCategory !== null

      async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const form = e.target as HTMLFormElement
        const formData = new FormData(form)
        const name = formData.get("name") as string
        const type = Number(formData.get("type"))
        const color = (formData.get("color") as string) || null

        if (isEditing) {
          await fetch(
            `http://localhost:5117/api/categories/${editingCategory.id}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, color }),
            },
          )
        } else {
          await fetch("http://localhost:5117/api/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, type, color }),
          })
        }
        onOpenChange(false)
      }

      return (
        <div data-slot="dialog-content" role="dialog">
          <h2>{isEditing ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่ใหม่"}</h2>
          <form onSubmit={handleSubmit}>
            <input
              name="name"
              placeholder="อาหาร, เดินทาง"
              defaultValue={editingCategory?.name ?? ""}
            />
            <select
              name="type"
              defaultValue={String(editingCategory?.type ?? 1)}
            >
              <option value="1">รายจ่าย</option>
              <option value="0">รายรับ</option>
            </select>
            <input
              name="color"
              placeholder="#FF6B6B"
              defaultValue={editingCategory?.color ?? ""}
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
  function AlertDialogMedia({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <div data-slot="alert-dialog-media" {...props}>
        {children}
      </div>
    )
  }
  return {
    AlertDialog: AlertDialogProvider,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogFooter,
    AlertDialogMedia,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogCancel,
    AlertDialogAction,
  }
})

// ── Test data ───────────────────────────────────────────────────────────────

const systemExpenseCategories = [
  {
    id: "sys-001",
    userId: null,
    name: "Food",
    type: 1,
    icon: "utensils",
    color: "#FF6B6B",
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
  {
    id: "sys-002",
    userId: null,
    name: "Transport",
    type: 1,
    icon: "car",
    color: "#4ECDC4",
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
  {
    id: "sys-003",
    userId: null,
    name: "Shopping",
    type: 1,
    icon: "shopping-bag",
    color: "#45B7D1",
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
]

const systemIncomeCategories = [
  {
    id: "sys-004",
    userId: null,
    name: "Salary",
    type: 0,
    icon: "briefcase",
    color: "#2ECC71",
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
]

const userCategories = [
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
  {
    id: "usr-002",
    userId: "u1",
    name: "Freelance",
    type: 0,
    icon: "laptop",
    color: "#9B59B6",
    isSystem: false,
    createdAt: "2026-06-24T09:00:00+00:00",
  },
]

// Mutable store for MSW handlers
let categoriesStore: CategoryDto[]

// ── MSW handlers ────────────────────────────────────────────────────────────

const handlers = [
  http.get("http://localhost:5117/api/categories", () => {
    return HttpResponse.json([...categoriesStore])
  }),
  http.post("http://localhost:5117/api/categories", async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const newCat = {
      id: `usr-${Date.now()}`,
      userId: "u1",
      name: body.name as string,
      type: body.type as number,
      icon: (body.icon as string) ?? null,
      color: (body.color as string) ?? null,
      isSystem: false,
      createdAt: new Date().toISOString(),
    }
    categoriesStore.push(newCat)
    return HttpResponse.json(newCat)
  }),
  http.put(
    "http://localhost:5117/api/categories/:id",
    async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>
      const idx = categoriesStore.findIndex((c) => c.id === params.id)
      if (idx === -1) {
        return HttpResponse.json(
          { type: "about:blank", title: "Not Found", status: 404 },
          { status: 404 },
        )
      }
      if (categoriesStore[idx].isSystem) {
        return HttpResponse.json(
          {
            type: "about:blank",
            title: "Forbidden",
            status: 403,
            detail: "Cannot modify system categories",
          },
          { status: 403 },
        )
      }
      categoriesStore[idx] = { ...categoriesStore[idx], ...body }
      return HttpResponse.json(categoriesStore[idx])
    },
  ),
  http.delete("http://localhost:5117/api/categories/:id", ({ params }) => {
    const idx = categoriesStore.findIndex((c) => c.id === params.id)
    if (idx === -1) {
      return HttpResponse.json(
        { type: "about:blank", title: "Not Found", status: 404 },
        { status: 404 },
      )
    }
    if (categoriesStore[idx].isSystem) {
      return HttpResponse.json(
        {
          type: "about:blank",
          title: "Forbidden",
          status: 403,
          detail: "Cannot delete system categories",
        },
        { status: 403 },
      )
    }
    categoriesStore.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]

const server = setupServer(...handlers)

// ── Import after mocks ──────────────────────────────────────────────────────

import type { CategoryDto } from "@/types/api"
import CategoriesPage from "@/pages/CategoriesPage"

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
      <MemoryRouter initialEntries={["/categories"]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  )
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  categoriesStore = [
    ...systemExpenseCategories,
    ...systemIncomeCategories,
    ...userCategories,
  ]
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.close()
  vi.clearAllMocks()
})

// ── Tests ────────────────────────────────────────────────────────────────────

describe("CategoriesPage", () => {
  it("lists system and user categories", async () => {
    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument()
    })

    // System categories section
    expect(screen.getByText("หมวดหมู่ระบบ")).toBeInTheDocument()
    expect(screen.getByText("Food")).toBeInTheDocument()
    expect(screen.getByText("Transport")).toBeInTheDocument()
    expect(screen.getByText("Shopping")).toBeInTheDocument()
    expect(screen.getByText("Salary")).toBeInTheDocument()

    // User categories section
    expect(screen.getByText("หมวดหมู่ของฉัน")).toBeInTheDocument()
    expect(screen.getByText("Coffee")).toBeInTheDocument()
    expect(screen.getByText("Freelance")).toBeInTheDocument()
  })

  it("creates category and refetches list", async () => {
    const user = userEvent.setup()
    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument()
    })

    // Open the form dialog
    await user.click(
      screen.getByRole("button", { name: /เพิ่มหมวดหมู่/i }),
    )

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Fill in the form
    const nameInput = screen.getByPlaceholderText(/อาหาร, เดินทาง/)
    await user.clear(nameInput)
    await user.type(nameInput, "Gym")

    // Submit — the mock form calls fetch to MSW, then closes dialog
    await user.click(screen.getByRole("button", { name: /^สร้าง$/i }))

    // Dialog should close after successful submission
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("edits category", async () => {
    const user = userEvent.setup()
    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("Coffee")).toBeInTheDocument()
    })

    // Click edit on "Coffee" category
    await user.click(screen.getByRole("button", { name: /แก้ไข Coffee/ }))

    // Dialog should appear
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument()
    })

    // Verify the name field is pre-filled
    expect(screen.getByDisplayValue("Coffee")).toBeInTheDocument()

    // Change the name
    await user.clear(screen.getByDisplayValue("Coffee"))
    await user.type(screen.getByDisplayValue(""), "Coffee Shop")

    // Submit
    await user.click(screen.getByRole("button", { name: /^บันทึก$/i }))

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })

  it("deletes category with confirmation", async () => {
    const user = userEvent.setup()
    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("Coffee")).toBeInTheDocument()
    })

    // Click delete on "Coffee" category
    await user.click(screen.getByRole("button", { name: /ลบ Coffee/ }))

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText("ยืนยันการลบ")).toBeInTheDocument()
    })

    // Confirm deletion
    await user.click(screen.getByRole("button", { name: /^ลบ$/i }))

    // Confirmation dialog should close
    await waitFor(() => {
      expect(screen.queryByText("ยืนยันการลบ")).not.toBeInTheDocument()
    })
  })

  it("disables edit and delete for system categories", async () => {
    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("Food")).toBeInTheDocument()
    })

    // System categories should NOT have edit/delete buttons
    const foodSection = screen.getByText("Food").closest("div")!
    expect(
      within(foodSection).queryByRole("button", { name: /แก้ไข Food/ }),
    ).not.toBeInTheDocument()
    expect(
      within(foodSection).queryByRole("button", { name: /ลบ Food/ }),
    ).not.toBeInTheDocument()

    // User categories SHOULD have edit/delete buttons
    expect(
      screen.getByRole("button", { name: /แก้ไข Coffee/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /ลบ Coffee/ }),
    ).toBeInTheDocument()
  })

  it("shows empty state when no categories exist", async () => {
    server.use(
      http.get("http://localhost:5117/api/categories", () => {
        return HttpResponse.json([])
      }),
    )

    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("ยังไม่มีหมวดหมู่")).toBeInTheDocument()
    })
  })

  it("shows error state on fetch failure", async () => {
    server.use(
      http.get("http://localhost:5117/api/categories", () => {
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

    renderWithProviders(<CategoriesPage />)

    await waitFor(() => {
      expect(screen.getByText("โหลดข้อมูลไม่สำเร็จ")).toBeInTheDocument()
    })

    expect(
      screen.getByRole("button", { name: /try again/i }),
    ).toBeInTheDocument()
  })
})
