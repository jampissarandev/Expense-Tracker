import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import apiClient from "@/lib/apiClient"
import type {
  TransactionDto,
  CreateTransactionRequest,
  UpdateTransactionRequest,
  TransactionFilter,
  PagedResult,
} from "@/types/api"

// ── Query keys ──────────────────────────────────────────────────────────────

export const transactionKeys = {
  all: ["transactions"] as const,
  lists: () => [...transactionKeys.all, "list"] as const,
  list: (filter: TransactionFilter) =>
    [...transactionKeys.lists(), filter] as const,
  details: () => [...transactionKeys.all, "detail"] as const,
  detail: (id: string) => [...transactionKeys.details(), id] as const,
}

// ── API functions ───────────────────────────────────────────────────────────

function buildQueryString(filter: TransactionFilter): string {
  const params = new URLSearchParams()
  if (filter.type != null) {
    params.set("type", filter.type === 0 ? "income" : "expense")
  }
  if (filter.categoryId) params.set("categoryId", filter.categoryId)
  if (filter.from) params.set("from", filter.from)
  if (filter.to) params.set("to", filter.to)
  if (filter.page) params.set("page", String(filter.page))
  if (filter.pageSize) params.set("pageSize", String(filter.pageSize))
  return params.toString()
}

export async function listTransactions(
  filter: TransactionFilter,
): Promise<PagedResult<TransactionDto>> {
  const qs = buildQueryString(filter)
  const url = qs ? `/api/transactions?${qs}` : "/api/transactions"
  const { data } = await apiClient.get<PagedResult<TransactionDto>>(url)
  return data
}

export async function getTransaction(id: string): Promise<TransactionDto> {
  const { data } = await apiClient.get<TransactionDto>(
    `/api/transactions/${id}`,
  )
  return data
}

export async function createTransaction(
  request: CreateTransactionRequest,
): Promise<TransactionDto> {
  const { data } = await apiClient.post<TransactionDto>(
    "/api/transactions",
    request,
  )
  return data
}

export async function updateTransaction(
  id: string,
  request: UpdateTransactionRequest,
): Promise<TransactionDto> {
  const { data } = await apiClient.put<TransactionDto>(
    `/api/transactions/${id}`,
    request,
  )
  return data
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiClient.delete(`/api/transactions/${id}`)
}

// ── React Query hooks ───────────────────────────────────────────────────────

export function useTransactions(filter: TransactionFilter) {
  return useQuery({
    queryKey: transactionKeys.list(filter),
    queryFn: () => listTransactions(filter),
  })
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: transactionKeys.detail(id),
    queryFn: () => getTransaction(id),
    enabled: !!id,
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...request
    }: UpdateTransactionRequest & { id: string }) =>
      updateTransaction(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: transactionKeys.all })
    },
  })
}
