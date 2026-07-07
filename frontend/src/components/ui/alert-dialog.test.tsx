import { describe, it, expect, vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import React from "react"
import { render, screen } from "@testing-library/react"

// ── Mock Base UI AlertDialog primitives (portals don't work in happy-dom) ───

vi.mock("@base-ui/react/alert-dialog", () => {
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
      <div className={className} data-slot="alert-dialog-overlay" {...props}>
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
      <div className={className} data-slot="alert-dialog-content" {...props}>
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
      <h2 className={className} data-slot="alert-dialog-title" {...props}>
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
      <p className={className} data-slot="alert-dialog-description" {...props}>
        {children}
      </p>
    )
  }
  return { AlertDialog: { Root, Portal, Backdrop, Popup, Trigger, Close, Title, Description } }
})

import {
  AlertDialog,
  AlertDialogOverlay,
  AlertDialogContent,
} from "./alert-dialog"

describe("AlertDialogOverlay", () => {
  it("applies bg-black/60 and duration-200", () => {
    render(<AlertDialog open><AlertDialogOverlay /></AlertDialog>)
    const overlay = document.querySelector("[data-slot=alert-dialog-overlay]")
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass("bg-black/60")
    expect(overlay).toHaveClass("duration-200")
  })
})

describe("AlertDialogContent", () => {
  it("applies shadow-popover and ring-foreground/20", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>Test content</AlertDialogContent>
      </AlertDialog>
    )
    const content = screen.getByText("Test content").closest("[data-slot=alert-dialog-content]")
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass("shadow-[var(--shadow-popover)]")
    expect(content).toHaveClass("ring-foreground/20")
  })
})
