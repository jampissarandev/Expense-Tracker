import { describe, it, expect } from "vitest"
import { formatTHB, formatThaiDate, parseAmount } from "@/lib/format"

describe("formatTHB", () => {
  it("formats a simple amount with THB symbol and thousands separator", () => {
    expect(formatTHB("85500.5")).toBe("฿85,500.50")
  })

  it("formats zero as ฿0.00", () => {
    expect(formatTHB("0")).toBe("฿0.00")
  })

  it("formats a negative amount", () => {
    // Intl.NumberFormat places the minus sign before the currency symbol
    expect(formatTHB("-1234.56")).toBe("-฿1,234.56")
  })

  it("accepts a number argument", () => {
    expect(formatTHB(1500)).toBe("฿1,500.00")
  })

  it("rounds to 2 decimal places", () => {
    expect(formatTHB("99.999")).toBe("฿100.00")
  })
})

describe("formatThaiDate", () => {
  it("formats an ISO date to Thai date with Buddhist year", () => {
    // 18:00 UTC = 01:00 UTC+7 (next day in Thai timezone)
    expect(formatThaiDate("2026-06-24T18:00:00+00:00")).toBe("25 มิ.ย. 2569")
  })

  it("formats January correctly", () => {
    expect(formatThaiDate("2026-01-01T00:00:00+00:00")).toBe("1 ม.ค. 2569")
  })

  it("formats December correctly", () => {
    expect(formatThaiDate("2026-12-31T00:00:00+00:00")).toBe("31 ธ.ค. 2569")
  })
})

describe("parseAmount", () => {
  it("returns the number with 2 decimal places", () => {
    expect(parseAmount("85500.5")).toBe("85500.50")
  })

  it("strips commas", () => {
    expect(parseAmount("85,500.50")).toBe("85500.50")
  })

  it("strips currency symbols", () => {
    expect(parseAmount("฿85500.50")).toBe("85500.50")
  })

  it("strips spaces", () => {
    expect(parseAmount("85 500.50")).toBe("85500.50")
  })

  it("returns null for empty string", () => {
    expect(parseAmount("")).toBeNull()
  })

  it("returns null for non-numeric input", () => {
    expect(parseAmount("abc")).toBeNull()
  })

  it("returns null for whitespace-only input", () => {
    expect(parseAmount("   ")).toBeNull()
  })

  it("handles integer input", () => {
    expect(parseAmount("100")).toBe("100.00")
  })
})
