import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

// Mock Popover/Calendar since Base UI portals don't work in happy-dom
vi.mock("@/components/ui/popover", () => ({
  Popover: ({
    children,
    open,
  }: {
    children: React.ReactNode
    open?: boolean
  }) => <div data-open={open}>{children}</div>,
  PopoverTrigger: ({
    children,
    render,
  }: {
    children?: React.ReactNode
    render?: React.ReactElement
  }) => render ?? <>{children}</>,
  PopoverContent: ({ children }: { children: React.ReactNode }) => (
    <div data-slot="popover-content">{children}</div>
  ),
  PopoverClose: ({ children }: { children?: React.ReactNode }) => (
    <button>{children}</button>
  ),
}))

vi.mock("@/components/ui/calendar", () => ({
  Calendar: ({
    onSelect,
  }: {
    onSelect?: (date: Date | undefined) => void
  }) => (
    <div data-testid="calendar-mock">
      <button type="button" onClick={() => onSelect?.(new Date("2026-03-15T00:00:00"))}>
        Pick 15/03/2026
      </button>
    </div>
  ),
}))

import { DateInput } from "@/components/ui/date-input"

describe("DateInput", () => {
  it("renders ISO value as dd/mm/yyyy", () => {
    render(<DateInput value="2026-07-08" onChange={vi.fn()} />)
    expect(screen.getByDisplayValue("08/07/2026")).toBeInTheDocument()
  })

  it("renders empty for empty value", () => {
    render(<DateInput value="" onChange={vi.fn()} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")
    expect(input).toHaveValue("")
  })

  it("calls onChange with ISO when valid dd/mm/yyyy is typed", async () => {
    const onChange = vi.fn()
    render(<DateInput value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    // Type a valid date
    await userEvent.type(input, "15/03/2026")

    // parseDateInput is called on each keystroke; it should fire onChange
    // with the ISO value once the input becomes a valid date
    expect(onChange).toHaveBeenCalledWith("2026-03-15")
  })

  it("does not call onChange for invalid input", async () => {
    const onChange = vi.fn()
    render(<DateInput value="2026-07-08" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    // Clear and type garbage
    fireEvent.change(input, { target: { value: "not-a-date" } })

    // onChange should NOT have been called with any new value
    expect(onChange).not.toHaveBeenCalled()
  })

  it("calls onChange with empty string when input is cleared on blur", async () => {
    const onChange = vi.fn()
    render(<DateInput value="2026-07-08" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    // Clear the input
    fireEvent.change(input, { target: { value: "" } })
    // Blur
    fireEvent.blur(input)

    expect(onChange).toHaveBeenCalledWith("")
  })

  it("has a calendar button with aria-label", () => {
    render(<DateInput value="" onChange={vi.fn()} />)
    expect(
      screen.getByRole("button", { name: "เลือกวันที่" }),
    ).toBeInTheDocument()
  })

  it("rejects 31/02/2026 as invalid", async () => {
    const onChange = vi.fn()
    render(<DateInput value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    fireEvent.change(input, { target: { value: "31/02/2026" } })

    expect(onChange).not.toHaveBeenCalled()
  })

  it("has an input with the correct id", () => {
    render(
      <DateInput id="filter-from" value="" onChange={vi.fn()} />,
    )
    const input = screen.getByPlaceholderText("dd/mm/yyyy")
    expect(input).toHaveAttribute("id", "filter-from")
  })
})
