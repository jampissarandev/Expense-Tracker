import apiClient from "@/lib/apiClient"
import type { TransactionFilter } from "@/types/api"

// ── Download helper ─────────────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

function extractFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback
  const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"'\s]+)/i)
  return match ? match[1] : fallback
}

// ── Export helpers ──────────────────────────────────────────────────────────

function buildTransactionsQuery(filter: TransactionFilter): string {
  const params = new URLSearchParams()
  if (filter.type != null) {
    params.set("type", filter.type === 0 ? "income" : "expense")
  }
  if (filter.categoryId) params.set("categoryId", filter.categoryId)
  if (filter.from) params.set("from", filter.from)
  if (filter.to) params.set("to", filter.to)
  return params.toString()
}

export async function downloadTransactionsCsv(
  filter: TransactionFilter,
): Promise<void> {
  const qs = buildTransactionsQuery(filter)
  const url = `/api/exports/transactions.csv${qs ? `?${qs}` : ""}`
  const response = await apiClient.get(url, { responseType: "blob" })
  const disposition = response.headers?.["content-disposition"] ?? null
  const filename = extractFilename(disposition, "transactions.csv")
  triggerDownload(response.data, filename)
}

export async function downloadSummaryCsv(
  from?: string,
  to?: string,
): Promise<void> {
  const params = new URLSearchParams()
  if (from) params.set("from", from)
  if (to) params.set("to", to)
  const qs = params.toString()
  const url = `/api/exports/summary.csv${qs ? `?${qs}` : ""}`
  const response = await apiClient.get(url, { responseType: "blob" })
  const disposition = response.headers?.["content-disposition"] ?? null
  const filename = extractFilename(disposition, "summary.csv")
  triggerDownload(response.data, filename)
}
