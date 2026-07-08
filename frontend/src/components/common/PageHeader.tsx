import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface PageHeaderProps {
  /** Visible page title — rendered as the page's `<h1>`. */
  title: string
  /** Optional short description shown under the title. */
  description?: string
  /** Right-aligned action area (buttons, menus, etc.). */
  actions?: ReactNode
  /** Optional element rendered above the title (e.g. back link, breadcrumb). */
  eyebrow?: ReactNode
  className?: string
}

/**
 * Page-level header used by every authenticated page.
 *
 * Establishes a single visual rhythm for `<h1>` + optional eyebrow + description + actions,
 * keeps the title/action baseline aligned, and collapses gracefully on small screens
 * (actions wrap to a new row below the title when there isn't enough room).
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6",
        className,
      )}
    >
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <div className="text-sm">{eyebrow}</div> : null}
        <h1 className="text-foreground text-2xl font-semibold tracking-tight text-balance sm:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed text-pretty">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  )
}
