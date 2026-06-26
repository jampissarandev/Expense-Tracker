/**
 * Format a decimal string as THB currency.
 * e.g. "85500.5" → "฿85,500.50"
 *
 * Falls back to a manual formatter when the runtime lacks full ICU data
 * (some minimal Linux CI images ship Node with small-icu). The fallback
 * matches the Intl output as closely as possible for th-TH.
 */
export function formatTHB(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  try {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num)
  } catch {
    // Manual fallback for environments without th-TH locale data
    const sign = num < 0 ? "-" : ""
    const abs = Math.abs(num).toFixed(2)
    const [intPart, decPart] = abs.split(".")
    const withSeparators = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    return `${sign}\u0E3F${withSeparators}.${decPart}`
  }
}

const thaiShortMonths = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
] as const

/**
 * Parse a date string into its components, safely handling both
 * ISO date-only ("2026-06-24") and ISO datetime ("2026-06-24T18:00:00+00:00")
 * formats without timezone-induced date shifts.
 */
function parseDateParts(date: string): { day: number; month: number; year: number } {
  // Try date-only format first: "2026-06-24"
  const dateOnlyMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (dateOnlyMatch) {
    return {
      year: Number.parseInt(dateOnlyMatch[1], 10),
      month: Number.parseInt(dateOnlyMatch[2], 10),
      day: Number.parseInt(dateOnlyMatch[3], 10),
    }
  }
  // Fallback to Date parsing for ISO datetimes
  const d = new Date(date)
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  }
}

/**
 * Format an ISO date string to a Thai-friendly date.
 * e.g. "2026-06-24" → "24 มิ.ย. 2569"
 */
export function formatThaiDate(date: string): string {
  const { day, month, year } = parseDateParts(date)
  // Use Buddhist year (Thai calendar)
  const buddhistYear = year + 543
  return `${day} ${thaiShortMonths[month - 1]} ${buddhistYear}`
}

/**
 * Parse a user-entered amount string, stripping currency symbols, commas, and
 * spaces. Returns null if the result is not a valid number.
 *
 * Accepts: "85,500.50", "฿85500.5", "85 500.5" → "85500.50"
 */
export function parseAmount(input: string): string | null {
  // Remove currency symbols, Thai baht sign, commas, spaces, and non-breaking spaces
  const cleaned = input.replace(/[฿$\s,\u00A0\u200B]/g, "").trim()
  if (cleaned === "") return null

  const num = parseFloat(cleaned)
  if (isNaN(num)) return null

  // Return with exactly 2 decimal places
  return num.toFixed(2)
}
