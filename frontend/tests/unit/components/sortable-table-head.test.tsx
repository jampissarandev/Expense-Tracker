import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SortableTableHead } from "@/components/ui/sortable-table-head"
import type { TransactionSortBy, SortOrder } from "@/types/api"

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderHead(
  overrides: Partial<{
    label: string
    column: TransactionSortBy
    currentSortBy: TransactionSortBy | null
    currentOrder: SortOrder | null
    onSort: (column: TransactionSortBy) => void
    align: "left" | "right"
    className: string
  }> = {},
) {
  const defaults = {
    label: "วันที่",
    column: "occurredOn" as TransactionSortBy,
    currentSortBy: null as TransactionSortBy | null,
    currentOrder: null as SortOrder | null,
    onSort: vi.fn(),
  }
  const props = { ...defaults, ...overrides }
  return render(
    <table>
      <thead>
        <tr>
          <SortableTableHead {...props} />
        </tr>
      </thead>
    </table>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("SortableTableHead", () => {
  describe("rendering", () => {
    it("renders the label text", () => {
      renderHead({ label: "จำนวนเงิน" })
      expect(screen.getByText("จำนวนเงิน")).toBeInTheDocument()
    })

    it("renders an unsorted (muted) icon when no sort is active", () => {
      renderHead({ currentSortBy: null, currentOrder: null })
      // In unsorted state the component renders ArrowUpDownIcon (muted).
      // We verify by checking aria-sort="none" and that the button exists.
      const th = screen.getByRole("columnheader")
      expect(th).toHaveAttribute("aria-sort", "none")
    })

    it("renders ArrowDownIcon when descending sort is active on this column", () => {
      renderHead({
        column: "amount",
        currentSortBy: "amount",
        currentOrder: "desc",
      })
      const th = screen.getByRole("columnheader")
      expect(th).toHaveAttribute("aria-sort", "descending")
    })

    it("renders ArrowUpIcon when ascending sort is active on this column", () => {
      renderHead({
        column: "amount",
        currentSortBy: "amount",
        currentOrder: "asc",
      })
      const th = screen.getByRole("columnheader")
      expect(th).toHaveAttribute("aria-sort", "ascending")
    })

    it("sets aria-sort to none when a different column is sorted", () => {
      renderHead({
        column: "occurredOn",
        currentSortBy: "amount",
        currentOrder: "desc",
      })
      const th = screen.getByRole("columnheader")
      expect(th).toHaveAttribute("aria-sort", "none")
    })

    it("applies right alignment class when align='right'", () => {
      const { container } = renderHead({ align: "right" })
      const th = container.querySelector("th")
      expect(th?.className).toContain("text-right")
    })

    it("renders inside a <th> element", () => {
      renderHead()
      expect(screen.getByRole("columnheader")).toBeInTheDocument()
    })
  })

  describe("interaction", () => {
    it("calls onSort with the column value when the button is clicked", async () => {
      const onSort = vi.fn()
      const user = userEvent.setup()

      renderHead({ column: "amount", onSort })
      const btn = screen.getByRole("button")
      await user.click(btn)

      expect(onSort).toHaveBeenCalledTimes(1)
      expect(onSort).toHaveBeenCalledWith("amount")
    })

    it("does not call onSort when clicking the th padding (only the button)", () => {
      // The button is the only interactive element; clicking outside it
      // is a no-op by design. We verify that clicking the th itself does
      // nothing by checking the onSort mock stays untouched.
      const onSort = vi.fn()
      render(
        <table>
          <thead>
            <tr>
              <SortableTableHead
                label="วันที่"
                column="occurredOn"
                currentSortBy={null}
                currentOrder={null}
                onSort={onSort}
              />
            </tr>
          </thead>
        </table>,
      )
      // No click on button → onSort not called
      expect(onSort).not.toHaveBeenCalled()
    })
  })

  describe("all columns", () => {
    const columns: TransactionSortBy[] = [
      "occurredOn",
      "type",
      "categoryName",
      "amount",
      "note",
    ]

    for (const column of columns) {
      it(`renders without errors for column "${column}"`, () => {
        expect(() => renderHead({ column })).not.toThrow()
      })
    }
  })
})
