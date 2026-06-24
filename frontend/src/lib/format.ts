/**
 * Format a decimal string as THB currency.
 * e.g. "85500.5" → "฿85,500.50"
 */
export function formatTHB(amount: string | number): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)
}

/**
 * Format an ISO date string to a Thai-friendly date.
 * e.g. "2026-06-24T18:00:00+00:00" → "24 มิ.ย. 2569"
 */
export function formatThaiDate(date: string): string {
  const d = new Date(date)
  // Use Buddhist year (Thai calendar)
  const buddhistYear = d.getFullYear() + 543
  const day = d.getDate()
  const month = d.getMonth() // 0-indexed

  const thaiMonths = [
    "ม.ค.",
    "ก.พ.",
    "มี.ค.",
    "เม.ย.",
    "พ.ค.",
    "มิ.ย.",
    "ก.ค.",
    "ส.ค.",
    "ก.ย.",
    "ต.ค.",
    "พ.ย.",
    "ธ.ค.",
  ]

  return `${day} ${thaiMonths[month]} ${buddhistYear}`
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
