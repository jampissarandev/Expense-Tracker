import { cn } from "@/lib/utils"

/**
 * Text-color helpers that use the semantic tokens defined in `index.css`.
 * They automatically adapt to light/dark mode while keeping the
 * green/red semantics intact.
 *
 * Use these instead of hardcoding Tailwind colors that fail contrast in
 * dark mode.
 */
export const textSuccess = "text-[color:var(--success)]"
export const textDanger = "text-[color:var(--danger)]"
export const textInfo = "text-[color:var(--info)]"
export const textWarning = "text-[color:var(--warning)]"
export const textMuted = "text-muted-foreground"

/** Foreground tones for icons sitting on a colored chip. */
export const textOnSuccess = "text-[color:var(--success-foreground)]"
export const textOnDanger = "text-[color:var(--danger-foreground)]"
export const textOnInfo = "text-[color:var(--info-foreground)]"

/** Soft tinted backgrounds for amount / status chips. */
export const bgSoftSuccess = "bg-[color:var(--success)]/10"
export const bgSoftDanger = "bg-[color:var(--danger)]/10"
export const bgSoftInfo = "bg-[color:var(--info)]/10"
export const bgSoftWarning = "bg-[color:var(--warning)]/10"

export function textAmountClass(type: "income" | "expense") {
  return cn(type === "income" ? textSuccess : textDanger, "tabular-nums")
}

export function chipAmountClass(type: "income" | "expense") {
  return cn(
    type === "income" ? bgSoftSuccess : bgSoftDanger,
    type === "income" ? textSuccess : textDanger,
  )
}

/** Chart color sequence — used by recharts `<Cell fill={…}>`. */
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
] as const
