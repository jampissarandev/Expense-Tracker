import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import React from "react"
import {
  render,
  screen,
  waitFor,
  within,
  fireEvent,
} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { http, HttpResponse } from "msw"
import { setupServer } from "msw/node"
import { formatDateInput } from "@/lib/format"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── Mocks: Dialog and Select (Base UI portals don't work in happy-dom) ──────

vi.mock("@/components/ui/dialog", () => {
  function Dialog({
    open,
    children,
  }: {
    open: boolean
    children: React.ReactNode
  }) {
    if (!open) return null
    return <div data-slot="dialog-root">{children}</div>
  }
  Dialog.displayName = "Dialog"
  function DialogContent({
    children,
    ...props
  }: {
    children: React.ReactNode
    [key: string]: unknown
  }) {
    return (
      <div role="dialog" data-slot="dialog-content" {...props}>
        {children}
      </div>
    )
  }
  DialogContent.displayName = "DialogContent"
  function DialogHeader({
    children,
  }: {
    children: React.ReactNode
  }) {
    return <div data-slot="dialog-header">{children}</div>
  }
  DialogHeader.displayName = "DialogHeader"
  function DialogTitle({
    children,
  }: {
    children: React.ReactNode
  }) {
    return <h2 data-slot="dialog-title">{children}</h2>
  }
  DialogTitle.displayName = "DialogTitle"
  function DialogDescription({
    children,
  }: {
    children: React.ReactNode
  }) {
    return <p data-slot="dialog-description">{children}</p>
  }
  DialogDescription.displayName = "DialogDescription"
  function DialogFooter({
    children,
  }: {
    children: React.ReactNode
  }) {
    return <div data-slot="dialog-footer">{children}</div>
  }
  DialogFooter.displayName = "DialogFooter"
  return {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  }
})

// Select mock: replaces the Base UI popover with a deterministic button that
// cycles through SelectItem values on click. Each Select instance is assigned
// a unique synthetic id at render time; the SelectTrigger button gets
// `data-testid="select-{id}"` and `data-value` reflecting the current value.
vi.mock("@/components/ui/select", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registry = new Map<string, any>()
  let instanceCounter = 0

  function harvestItems(node: React.ReactNode): {
    value: string
    label: string
  }[] {
    const items: { value: string; label: string }[] = []
    function walk(child: React.ReactNode): void {
      React.Children.forEach(child, (c) => {
        if (c == null || c === false || c === true) return
        if (Array.isArray(c)) {
          walk(c)
          return
        }
        if (!React.isValidElement(c)) return
        const childType = c.type as
          | { displayName?: string }
          | ((...args: unknown[]) => unknown)
        const displayName =
          typeof childType === "object" && childType !== null
            ? (childType as { displayName?: string }).displayName
            : typeof childType === "function"
              ? (
                  childType as ((...args: never[]) => unknown) & {
                    displayName?: string
                  }
                ).displayName
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
        const props = c.props as { children?: React.ReactNode }
        if (props && "children" in props && props.children != null) {
          walk(props.children)
        }
      })
    }
    walk(node)
    return items
  }

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
    instanceCounter += 1
    const id = `__select_${instanceCounter}__`
    const items = harvestItems(children)
    registry.set(id, { value, items, onValueChange, disabled })

    // Find the first SelectTrigger deeply (it may be wrapped in FormControl
    // or other Slot-based components) and clone it with our synthetic id.
    let triggerReplaced = false
    function cloneWithId(node: React.ReactNode): React.ReactNode {
      if (triggerReplaced) return node
      if (node == null || typeof node !== "object") return node
      if (Array.isArray(node)) {
        return React.Children.map(node, cloneWithId)
      }
      if (!React.isValidElement(node)) return node
      const childType = node.type as
        | { displayName?: string }
        | ((...args: unknown[]) => unknown)
      const displayName =
        typeof childType === "object" && childType !== null
          ? (childType as { displayName?: string }).displayName
          : typeof childType === "function"
              ? (
                  childType as ((...args: never[]) => unknown) & {
                    displayName?: string
                  }
                ).displayName
            : undefined
      if (displayName === "SelectTrigger") {
        triggerReplaced = true
        return React.cloneElement(node, { id })
      }
      // Recurse into children
      const props = node.props as { children?: React.ReactNode }
      if (props && "children" in props && props.children != null) {
        const newChildren = cloneWithId(props.children)
        if (newChildren !== props.children) {
          return React.cloneElement(node, {}, newChildren)
        }
      }
      return node
    }
    const newChildren = cloneWithId(children)
    return <>{newChildren}</>
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
      const entry = registry.get(id)
      if (!entry || entry.onValueChange === undefined) return
      if (entry.disabled) return
      const currentIdx = entry.items.findIndex(
        (i: { value: string }) => i.value === entry.value,
      )
      const nextIdx = (currentIdx + 1) % entry.items.length
      entry.onValueChange(entry.items[nextIdx].value)
    }
    const entry = id ? registry.get(id) : undefined
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

  function SelectValue() {
    return null
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

// ── Mock the transaction hooks so we can spy on submit payloads ─────────────

const createSpy = vi.fn()
const updateSpy = vi.fn()

vi.mock("@/features/transactions/api", () => {
  return {
    useCreateTransaction: () => ({
      mutateAsync: createSpy.mockResolvedValue({
        id: "tx-new",
        categoryId: "cat-food",
        categoryName: "Food",
        type: 1,
        amount: "200.00",
        occurredOn: "2026-06-25",
        note: null,
        createdAt: "2026-06-25T00:00:00+00:00",
        updatedAt: "2026-06-25T00:00:00+00:00",
      }),
      isPending: false,
    }),
    useUpdateTransaction: () => ({
      mutateAsync: updateSpy.mockResolvedValue({}),
      isPending: false,
    }),
  }
})

// ── Mock AuthContext (avoid the real provider) ──────────────────────────────

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

// ── MSW: provide a categories endpoint so useCategories resolves ────────────

const categories = [
  {
    id: "cat-food",
    userId: null,
    name: "Food",
    type: 1,
    icon: null,
    color: null,
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
  {
    id: "cat-salary",
    userId: null,
    name: "Salary",
    type: 0,
    icon: null,
    color: null,
    isSystem: true,
    createdAt: "2026-06-24T05:22:21+00:00",
  },
]

const server = setupServer(
  http.get("http://localhost:5117/api/categories", () =>
    HttpResponse.json(categories),
  ),
)

// ── Imports after mocks ─────────────────────────────────────────────────────

import { TransactionFormDialog } from "@/features/transactions/TransactionFormDialog"
import type { TransactionDto } from "@/types/api"

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderForm(
  props: Partial<React.ComponentProps<typeof TransactionFormDialog>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const onOpenChange = vi.fn()
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <TransactionFormDialog
        open={true}
        onOpenChange={props.onOpenChange ?? onOpenChange}
        editingTransaction={props.editingTransaction ?? null}
      />
    </QueryClientProvider>,
  )
  return { ...utils, onOpenChange: props.onOpenChange ?? onOpenChange }
}

const sampleEditingTransaction: TransactionDto = {
  id: "tx-001",
  categoryId: "cat-food",
  categoryName: "Food",
  type: 1,
  amount: "150.50",
  occurredOn: "2026-06-25",
  note: "Lunch",
  createdAt: "2026-06-25T00:00:00+00:00",
  updatedAt: "2026-06-25T00:00:00+00:00",
}

// ── Lifecycle ───────────────────────────────────────────────────────────────

beforeEach(() => {
  createSpy.mockClear()
  updateSpy.mockClear()
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.resetHandlers()
  server.close()
  vi.clearAllMocks()
})

// ── Tests ───────────────────────────────────────────────────────────────────

describe("TransactionFormDialog", () => {
  it("validates amount and date", async () => {
    const user = userEvent.setup()
    renderForm()

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toBeInTheDocument()

    // Submit with empty amount — should show the required error.
    const submit = within(dialog).getByRole("button", { name: /สร้าง/i })
    await user.click(submit)

    await waitFor(() => {
      expect(
        within(dialog).getByText(/กรุณากรอกจำนวนเงิน/),
      ).toBeInTheDocument()
    })

    // Type a value with too many decimals — regex check rejects.
    const amountInput = within(dialog).getByPlaceholderText("0.00")
    await user.clear(amountInput)
    await user.type(amountInput, "12.345")
    await user.click(submit)

    await waitFor(() => {
      expect(
        within(dialog).getByText(/ทศนิยมไม่เกิน 2 ตำแหน่ง/),
      ).toBeInTheDocument()
    })

    // Submission should not have been called since validation keeps failing.
    expect(createSpy).not.toHaveBeenCalled()
  })

  it("submits and refetches", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    renderForm({ onOpenChange })

    const dialog = await screen.findByRole("dialog")

    // Fill in the amount.
    const amountInput = within(dialog).getByPlaceholderText("0.00")
    await user.type(amountInput, "200.00")

    // Find the category select — its button has data-value="" before selection.
    // The type select is the one with value="1" (default Expense).
    const selects = within(dialog).getAllByTestId(/^select-/)
    const categoryBtn = selects.find(
      (b) => b.getAttribute("data-value") === "",
    )
    expect(categoryBtn).toBeDefined()
    // Click to cycle to the first item.
    fireEvent.click(categoryBtn!)
    // Verify the click took effect.
    await waitFor(() => {
      expect(categoryBtn!.getAttribute("data-value")).toBe("cat-food")
    })

    // Submit.
    const submit = within(dialog).getByRole("button", { name: /สร้าง/i })
    await user.click(submit)

    // The mutation should be called with the right payload.
    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledTimes(1)
    })
    const call = createSpy.mock.calls[0][0]
    expect(call.type).toBe(1) // Expense (default)
    expect(call.amount).toBe("200.00")
    expect(call.categoryId).toBe("cat-food")
    expect(call.note).toBeNull()
    expect(call.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)

    // Dialog should close on success.
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("rejects future date", async () => {
    const user = userEvent.setup()
    renderForm()

    const dialog = await screen.findByRole("dialog")

    // The date input is pre-filled with today's date (dd/mm/yyyy).
    const todayISO = new Date().toISOString().split("T")[0]
    const dateInput = within(dialog).getByDisplayValue(
      formatDateInput(todayISO),
    ) as HTMLInputElement
    expect(dateInput).toBeDefined()

    // Set a date 7 days in the future.
    const future = new Date()
    future.setDate(future.getDate() + 7)
    const futureISO = future.toISOString().split("T")[0]
    const futureStr = formatDateInput(futureISO)

    fireEvent.change(dateInput, { target: { value: futureStr } })

    // Fill amount so the only validation failure is the date.
    const amountInput = within(dialog).getByPlaceholderText("0.00")
    await user.type(amountInput, "100.00")

    // Pick a category so the form is otherwise valid.
    const selects = within(dialog).getAllByTestId(/^select-/)
    const categoryBtn = selects.find(
      (b) => b.getAttribute("data-value") === "",
    )
    if (categoryBtn) fireEvent.click(categoryBtn)

    // Submit.
    const submit = within(dialog).getByRole("button", { name: /สร้าง/i })
    await user.click(submit)

    // The future-date error should appear.
    await waitFor(() => {
      expect(
        within(dialog).getByText(/ไม่สามารถเลือกวันที่ในอนาคตได้/),
      ).toBeInTheDocument()
    })

    expect(createSpy).not.toHaveBeenCalled()
  })

  it("renders edit mode with pre-filled values", async () => {
    renderForm({ editingTransaction: sampleEditingTransaction })

    const dialog = await screen.findByRole("dialog")
    // Title should reflect edit mode.
    expect(within(dialog).getByText("แก้ไขรายการ")).toBeInTheDocument()

    // Amount should be pre-filled.
    const amountInput = within(dialog).getByPlaceholderText(
      "0.00",
    ) as HTMLInputElement
    expect(amountInput.value).toBe("150.50")

    // Note should be pre-filled.
    const noteInput = within(dialog).getByPlaceholderText(
      "เช่น ซื้อกาแฟตอนเช้า",
    ) as HTMLInputElement
    expect(noteInput.value).toBe("Lunch")
  })
})
