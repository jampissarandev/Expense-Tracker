import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import React from "react"
import { render, screen } from "@testing-library/react"

// ── Mock Base UI Dialog primitives used by Sheet (portals don't work in happy-dom) ──
// SheetOverlay is NOT exported from sheet.tsx, so we only test SheetContent.
// We must mock ALL Dialog sub-components that sheet.tsx references at module
// level (including Backdrop used by SheetOverlay) because the module is fully
// evaluated on import.

vi.mock("@base-ui/react/dialog", () => {
  // Simple passthrough component — just renders children in a div
  function Passthrough({
    className,
    children,
    ...props
  }: {
    className?: string
    children?: React.ReactNode
  }) {
    return (
      <div className={className} {...props}>
        {children}
      </div>
    )
  }
  return {
    Dialog: {
      Root: Passthrough,
      Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
      Backdrop: Passthrough,
      Popup: function SheetPopup({
        className,
        children,
        ...props
      }: {
        className?: string
        children?: React.ReactNode
      }) {
        return (
          <div className={className} data-slot="sheet-content" {...props}>
            {children}
          </div>
        )
      },
      Trigger: Passthrough,
      Close: ({
        children,
        render: Render,
      }: {
        children?: React.ReactNode
        render?: React.ReactElement
      }) => {
        if (Render) return React.cloneElement(Render, {}, children)
        return <button>{children}</button>
      },
      Title: Passthrough,
      Description: Passthrough,
      Handle: Passthrough,
      Viewport: Passthrough,
    },
  }
})

import {
  Sheet,
  SheetContent,
} from "./sheet"

describe("SheetContent", () => {
  it("applies shadow-popover and ring-foreground/10", () => {
    render(
      <Sheet open>
        <SheetContent showCloseButton={false}>Sheet body</SheetContent>
      </Sheet>
    )
    const content = screen.getByText("Sheet body").closest("[data-slot=sheet-content]")
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass("shadow-[var(--shadow-popover)]")
    expect(content).toHaveClass("ring-foreground/10")
  })
})
