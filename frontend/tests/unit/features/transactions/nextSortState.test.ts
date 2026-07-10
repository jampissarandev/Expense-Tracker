import { describe, it, expect } from "vitest"
import { nextSortState } from "@/features/transactions/nextSortState"
import type {
  TransactionSortBy,
  SortOrder,
} from "@/types/api"

describe("nextSortState", () => {
  describe("when clicking a different column than the active sort", () => {
    it("starts a new descending sort on that column", () => {
      expect(
        nextSortState("amount", { sortBy: null, sortOrder: null }),
      ).toEqual({ sortBy: "amount", sortOrder: "desc" })
    })

    it("starts desc when switching from another active column", () => {
      expect(
        nextSortState("amount", { sortBy: "occurredOn", sortOrder: "asc" }),
      ).toEqual({ sortBy: "amount", sortOrder: "desc" })
    })

    it("starts desc when switching from another desc column", () => {
      expect(
        nextSortState("note", { sortBy: "amount", sortOrder: "desc" }),
      ).toEqual({ sortBy: "note", sortOrder: "desc" })
    })
  })

  describe("when clicking the same column as the active sort", () => {
    it("flips descending → ascending", () => {
      expect(
        nextSortState("amount", { sortBy: "amount", sortOrder: "desc" }),
      ).toEqual({ sortBy: "amount", sortOrder: "asc" })
    })

    it("clears sort on ascending → null (third click = reset)", () => {
      expect(
        nextSortState("amount", { sortBy: "amount", sortOrder: "asc" }),
      ).toEqual({ sortBy: null, sortOrder: null })
    })
  })

  describe("edge cases", () => {
    it("treats a null sortBy with a leftover sortOrder as unsorted (starts desc)", () => {
      // defensively: if sortBy=null but sortOrder="asc" leaked in, treat as
      // "no active sort on this column" → start fresh desc on the clicked column
      const result = nextSortState("type", {
        sortBy: null,
        sortOrder: "asc" as SortOrder,
      })
      expect(result).toEqual({ sortBy: "type", sortOrder: "desc" })
    })

    it("handles all TransactionSortBy values without type errors", () => {
      const columns: TransactionSortBy[] = [
        "occurredOn",
        "type",
        "categoryName",
        "amount",
        "note",
      ]
      for (const column of columns) {
        const result = nextSortState(column, { sortBy: null, sortOrder: null })
        expect(result).toEqual({ sortBy: column, sortOrder: "desc" })
      }
    })
  })
})