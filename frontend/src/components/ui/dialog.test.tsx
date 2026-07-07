import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import React from "react"
import { render, screen } from "@testing-library/react"

// ── Mock Base UI Dialog primitives (portals don't work in happy-dom) ────────

vi.mock("@base-ui/react/dialog", () => {
  function Root({
    open = false,
    children,
  }: {
    open?: boolean
    children: React.ReactNode
  }) {
    if (!open) return null
    return <>{children}</>
  }
  function Portal({ children }: { children: React.ReactNode }) {
    return <>{children}</>
  }
  function Backdrop({
    className,
    children,
    ...props
  }: {
    className?: string
    children?: React.ReactNode
  }) {
    return (
      <div className={className} data-slot="dialog-overlay" {...props}>
        {children}
      </div>
    )
  }
  function Popup({
    className,
    children,
    ...props
  }: {
    className?: string
    children?: React.ReactNode
  }) {
    return (
      <div className={className} data-slot="dialog-content" {...props}>
        {children}
      </div>
    )
  }
  function Trigger({ children }: { children: React.ReactNode }) {
    return <button>{children}</button>
  }
  function Close({
    children,
    render: Render,
  }: {
    children?: React.ReactNode
    render?: React.ReactElement
  }) {
    if (Render) {
      return React.cloneElement(Render, {}, children)
    }
    return <button>{children}</button>
  }
  function Title({
    className,
    children,
    ...props
  }: {
    className?: string
    children?: React.ReactNode
  }) {
    return (
      <h2 className={className} data-slot="dialog-title" {...props}>
        {children}
      </h2>
    )
  }
  function Description({
    className,
    children,
    ...props
  }: {
    className?: string
    children?: React.ReactNode
  }) {
    return (
      <p className={className} data-slot="dialog-description" {...props}>
        {children}
      </p>
    )
  }
  return { Dialog: { Root, Portal, Backdrop, Popup, Trigger, Close, Title, Description } }
})

import {
  Dialog,
  DialogOverlay,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./dialog"

describe("DialogOverlay", () => {
  it("applies bg-black/60 and duration-200", () => {
    render(<Dialog open><DialogOverlay /></Dialog>)
    const overlay = document.querySelector("[data-slot=dialog-overlay]")
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass("bg-black/60")
    expect(overlay).toHaveClass("duration-200")
  })
})

describe("DialogContent", () => {
  it("applies shadow-popover and ring-foreground/20", () => {
    render(
      <Dialog open>
        <DialogContent>Test content</DialogContent>
      </Dialog>
    )
    const content = screen.getByText("Test content").closest("[data-slot=dialog-content]")
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass("shadow-[var(--shadow-popover)]")
    expect(content).toHaveClass("ring-foreground/20")
  })
})

describe("DialogHeader", () => {
  it("applies pb-4 for visual separation", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader data-testid="header">
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
    const header = screen.getByTestId("header")
    expect(header).toHaveClass("pb-4")
  })
})

describe("DialogTitle", () => {
  it("applies font-semibold", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle data-testid="title">My Dialog</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    const title = screen.getByTestId("title")
    expect(title).toHaveClass("font-semibold")
  })
})
