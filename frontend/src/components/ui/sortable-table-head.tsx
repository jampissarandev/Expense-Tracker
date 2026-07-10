import { ArrowUpDownIcon, ArrowUpIcon, ArrowDownIcon } from "lucide-react"
import { TableHead } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { TransactionSortBy, SortOrder } from "@/types/api"

export interface SortableTableHeadProps {
  /** Display label shown in the header cell. */
  label: React.ReactNode
  /** The sort column this header controls. */
  column: TransactionSortBy
  /** The currently active sort column (null = no sort). */
  currentSortBy: TransactionSortBy | null
  /** The currently active sort direction (null = no sort). */
  currentOrder: SortOrder | null
  /** Called when the user clicks the header to change sorting. */
  onSort: (column: TransactionSortBy) => void
  /** Text alignment — "right" for numeric columns. */
  align?: "left" | "right"
  /** Additional classes forwarded to the underlying <th>. */
  className?: string
}

/**
 * A sortable table header cell.
 *
 * Renders a `<th>` with `aria-sort` and a `<button>` inside that toggles
 * between three states per the sort lifecycle:
 *   unsorted → desc → asc → reset (back to unsorted)
 *
 * Arrow icons from lucide-react indicate the current direction:
 * - `ArrowUpDownIcon` (muted, dim) — unsorted
 * - `ArrowDownIcon` — descending
 * - `ArrowUpIcon` — ascending
 */
export function SortableTableHead({
  label,
  column,
  currentSortBy,
  currentOrder,
  onSort,
  align = "left",
  className,
}: SortableTableHeadProps) {
  const isActive = currentSortBy === column
  const ariaSort: "ascending" | "descending" | "none" = isActive
    ? currentOrder === "asc"
      ? "ascending"
      : "descending"
    : "none"

  return (
    <TableHead
      className={cn(align === "right" && "text-right", className)}
      aria-sort={ariaSort}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onSort(column)}
        className={cn("-ml-2 h-8 gap-1 font-medium")}
      >
        {label}
        {isActive && currentOrder === "asc" ? (
          <ArrowUpIcon className="size-4 shrink-0" />
        ) : isActive && currentOrder === "desc" ? (
          <ArrowDownIcon className="size-4 shrink-0" />
        ) : (
          <ArrowUpDownIcon className="text-muted-foreground size-4 shrink-0" />
        )}
      </Button>
    </TableHead>
  )
}
