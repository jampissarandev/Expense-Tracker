import type { TransactionSortBy, SortOrder } from "@/types/api"

/**
 * Current sort selection on the transactions table.
 *
 * `sortBy`/`sortOrder` are both null when no sort is active (i.e. the table
 * falls back to the backend default `OccurredOn DESC, CreatedAt DESC`).
 */
export interface SortState {
  sortBy: TransactionSortBy | null
  sortOrder: SortOrder | null
}

/**
 * Compute the next sort state after the user clicks a sortable column header.
 *
 * Click cycle per column (three-state toggle, matching the plan):
 *   1. unsorted        → desc   (first click on a column)
 *   2. desc            → asc    (second click on the same column)
 *   3. asc             → reset  (third click clears the sort)
 *
 * Clicking a different column while another column is sorted (in either
 * direction) always starts a fresh descending sort on the newly clicked
 * column.
 *
 * This is a pure function so it can be unit-tested in isolation and reused by
 * the Phase C `SortableTableHead` wiring without duplicating the toggle logic.
 * The caller (the page component) is responsible for also resetting the
 * pagination `page` state to 1 whenever the sort changes.
 */
export function nextSortState(
  column: TransactionSortBy,
  current: SortState,
): SortState {
  if (current.sortBy !== column) {
    return { sortBy: column, sortOrder: "desc" }
  }

  // Same column clicked again → cycle the direction.
  if (current.sortOrder === "desc") {
    return { sortBy: column, sortOrder: "asc" }
  }

  // asc → reset to unsorted.
  return { sortBy: null, sortOrder: null }
}