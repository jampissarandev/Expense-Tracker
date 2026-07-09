import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface SegmentedControlOption<T extends string | number> {
  value: T
  label: ReactNode
  icon?: ReactNode
  disabled?: boolean
}

export interface SegmentedControlProps<T extends string | number> {
  options: ReadonlyArray<SegmentedControlOption<T>>
  value: T
  onChange: (value: T) => void
  ariaLabel?: string
  className?: string
}

/**
 * Minimal Swiss-style segmented control.
 *
 * Renders as a `role="radiogroup"` with a single-select segmented UI.
 * Each option is a real `role="radio"` button with `aria-checked`, so it's
 * announced correctly by screen readers and is fully keyboard-navigable.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "bg-muted/60 inline-flex w-full items-stretch gap-1 rounded-md p-1",
        className,
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-sm px-2.5 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1",
              "disabled:cursor-not-allowed disabled:opacity-50",
              isActive
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
