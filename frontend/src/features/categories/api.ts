import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import apiClient from "@/lib/apiClient"
import type {
  CategoryDto,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@/types/api"

// ── Query keys ──────────────────────────────────────────────────────────────

export const categoryKeys = {
  all: ["categories"] as const,
  list: () => [...categoryKeys.all, "list"] as const,
}

// ── API functions ───────────────────────────────────────────────────────────

export async function listCategories(): Promise<CategoryDto[]> {
  const { data } = await apiClient.get<CategoryDto[]>("/api/categories")
  return data
}

export async function createCategory(
  request: CreateCategoryRequest,
): Promise<CategoryDto> {
  const { data } = await apiClient.post<CategoryDto>(
    "/api/categories",
    request,
  )
  return data
}

export async function updateCategory(
  id: string,
  request: UpdateCategoryRequest,
): Promise<CategoryDto> {
  const { data } = await apiClient.put<CategoryDto>(
    `/api/categories/${id}`,
    request,
  )
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/api/categories/${id}`)
}

// ── React Query hooks ───────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: categoryKeys.list(),
    queryFn: listCategories,
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      ...request
    }: UpdateCategoryRequest & { id: string }) =>
      updateCategory(id, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.all })
    },
  })
}
