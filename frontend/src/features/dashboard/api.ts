import { useQuery } from "@tanstack/react-query"
import apiClient from "@/lib/apiClient"
import type { DashboardSummaryDto } from "@/types/api"

// ── Query keys ──────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ["dashboard"] as const,
  summary: (type?: string) => [...dashboardKeys.all, "summary", type] as const,
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface DashboardFilter {
  type?: "income" | "expense"
}

// ── API function ────────────────────────────────────────────────────────────

export async function getDashboardSummary(
  filter?: DashboardFilter,
): Promise<DashboardSummaryDto> {
  const params = filter?.type ? `?type=${filter.type}` : ""
  const { data } = await apiClient.get<DashboardSummaryDto>(
    `/api/dashboard/summary${params}`,
  )
  return data
}

// ── React Query hooks ───────────────────────────────────────────────────────

export function useDashboardSummary(type?: "income" | "expense") {
  return useQuery({
    queryKey: dashboardKeys.summary(type),
    queryFn: () => getDashboardSummary({ type }),
  })
}
