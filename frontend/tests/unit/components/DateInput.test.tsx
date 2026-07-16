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

  it("does NOT clear a non-empty value when input is cleared on blur", async () => {
    // Safety contract: clearing the field on blur must not silently wipe a
    // previously-set value. The display should snap back to the parent's
    // formatted value, and onChange should not be called.
    const onChange = vi.fn()
    render(<DateInput value="2026-07-08" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    // Clear the input
    fireEvent.change(input, { target: { value: "" } })
    // Blur
    fireEvent.blur(input)

    expect(onChange).not.toHaveBeenCalled()
    // Display should snap back to the parent's formatted value
    expect(input).toHaveValue("08/07/2026")
  })

  it("calls onChange with empty string on blur when parent value was already empty", async () => {
    // If the parent value was already empty, blurring an empty field is a
    // no-op confirmation — we emit onChange("") so the parent knows the
    // user actively engaged with (and left) the field.
    const onChange = vi.fn()
    render(<DateInput value="" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    fireEvent.change(input, { target: { value: "" } })
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

  // Regression test: on blur with a valid date, the displayed value must be
  // the newly-formatted input (not the stale `value` prop that the parent
  // hasn't updated yet). Previously handleTextBlur ran an unconditional
  // `setDisplayValue(formatDateInput(value))` after a successful parse,
  // causing a one-frame flicker back to the old display.
  it("shows the newly-formatted value on blur with valid input (no flicker to old value)", async () => {
    // Parent holds onto a stale value — simulating a controlled input where
    // the consumer has not yet re-rendered with the new onChange callback.
    const onChange = vi.fn()
    const { rerender } = render(
      <DateInput value="2026-01-01" onChange={onChange} />,
    )
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    // Type a new valid date (replaces the existing "01/01/2026" display)
    fireEvent.change(input, { target: { value: "15/03/2026" } })
    // Trigger blur
    fireEvent.blur(input)

    // Display must show the *new* date in dd/mm/yyyy, not the stale 01/01/2026
    expect(input).toHaveValue("15/03/2026")

    // Sanity: parent should have been notified with the new ISO value
    expect(onChange).toHaveBeenCalledWith("2026-03-15")

    // And a re-render with the same stale prop must not regress the display
    rerender(<DateInput value="2026-01-01" onChange={onChange} />)
    expect(screen.getByPlaceholderText("dd/mm/yyyy")).toHaveValue("15/03/2026")
  })

  it("resets display to formatted parent value on blur with invalid input", () => {
    // Typing garbage, then blurring, should snap the display back to the
    // parent's current ISO value (formatted as dd/mm/yyyy), not blank.
    const onChange = vi.fn()
    render(<DateInput value="2026-07-08" onChange={onChange} />)
    const input = screen.getByPlaceholderText("dd/mm/yyyy")

    fireEvent.change(input, { target: { value: "garbage" } })
    fireEvent.blur(input)

    // onChange should NOT have been called with a new value
    expect(onChange).not.toHaveBeenCalled()
    // Display should snap back to the parent's formatted value
    expect(input).toHaveValue("08/07/2026")
  })
})
