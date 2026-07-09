import { describe, it, expect } from "vitest"
import {
  formatTHB,
  formatThaiDate,
  parseAmount,
  formatDateInput,
  parseDateInput,
} from "@/lib/format"

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
  it("formats a date-only string to Thai date with Buddhist year", () => {
    expect(formatThaiDate("2026-06-24")).toBe("24 มิ.ย. 2569")
  })

  it("handles date part of ISO datetime strings", () => {
    // Only the date portion is used, timezone is ignored
    expect(formatThaiDate("2026-06-24T18:00:00+00:00")).toBe("24 มิ.ย. 2569")
  })

  it("formats January correctly", () => {
    expect(formatThaiDate("2026-01-15")).toBe("15 ม.ค. 2569")
  })

  it("formats December with Buddhist year", () => {
    expect(formatThaiDate("2026-12-31")).toBe("31 ธ.ค. 2569")
  })

  it("formats date-only strings from the backend", () => {
    // occurredOn is sent as DateOnly "2026-06-01"
    expect(formatThaiDate("2026-06-01")).toBe("1 มิ.ย. 2569")
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

describe("formatDateInput", () => {
  it("formats ISO date to dd/mm/yyyy", () => {
    expect(formatDateInput("2026-07-08")).toBe("08/07/2026")
  })

  it("returns empty string for empty input", () => {
    expect(formatDateInput("")).toBe("")
  })

  it("returns empty string for null", () => {
    expect(formatDateInput(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(formatDateInput(undefined)).toBe("")
  })

  it("formats single-digit day and month with zero padding", () => {
    expect(formatDateInput("2026-01-05")).toBe("05/01/2026")
  })
})

describe("parseDateInput", () => {
  it("parses dd/mm/yyyy to ISO", () => {
    expect(parseDateInput("08/07/2026")).toBe("2026-07-08")
  })

  it("returns null for invalid date like 31/02/2026", () => {
    expect(parseDateInput("31/02/2026")).toBeNull()
  })

  it("returns null for non-numeric garbage", () => {
    expect(parseDateInput("garbage")).toBeNull()
  })

  it("returns null for partial input", () => {
    expect(parseDateInput("08/07")).toBeNull()
  })

  it("returns null for month 00", () => {
    expect(parseDateInput("08/00/2026")).toBeNull()
  })

  it("returns null for month 13", () => {
    expect(parseDateInput("08/13/2026")).toBeNull()
  })

  it("returns null for day 00", () => {
    expect(parseDateInput("00/07/2026")).toBeNull()
  })

  it("returns null for day 32", () => {
    expect(parseDateInput("32/07/2026")).toBeNull()
  })

  it("accepts 29/02 in a leap year", () => {
    expect(parseDateInput("29/02/2024")).toBe("2024-02-29")
  })

  it("returns null for 29/02 in a non-leap year", () => {
    expect(parseDateInput("29/02/2025")).toBeNull()
  })

  it("accepts 31/12/2026", () => {
    expect(parseDateInput("31/12/2026")).toBe("2026-12-31")
  })

  it("accepts 01/01/2000", () => {
    expect(parseDateInput("01/01/2000")).toBe("2000-01-01")
  })
})
