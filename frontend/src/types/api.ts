// Mirrors backend DTOs — keep in sync with api-contract.md

// ── Enums (const object pattern — erasableSyntaxOnly compatible) ────────────

export const TransactionType = {
  Income: 0,
  Expense: 1,
} as const

export type TransactionType = (typeof TransactionType)[keyof typeof TransactionType]

// ── Sort ────────────────────────────────────────────────

export type TransactionSortBy =
  | "occurredOn"
  | "type"
  | "categoryName"
  | "amount"
  | "note"

export type SortOrder = "asc" | "desc"

// ── Auth ───────────────────────────────────────────────

export interface UserDto {
  id: string
  email: string
  displayName: string
}

export interface AccessTokenDto {
  token: string
  expiresAt: string
}

export interface AuthResponse {
  accessToken: AccessTokenDto
  refreshToken: string
  refreshTokenExpiresAt: string
  user: UserDto
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  displayName: string
}

// ── Categories ─────────────────────────────────────────

export interface CategoryDto {
  id: string
  userId: string | null
  name: string
  type: TransactionType
  icon: string | null
  color: string | null
  isSystem: boolean
  createdAt: string
}

export interface CreateCategoryRequest {
  name: string
  type: TransactionType
  icon?: string | null
  color?: string | null
}

export interface UpdateCategoryRequest {
  name: string
  icon?: string | null
  color?: string | null
}

// ── Transactions ───────────────────────────────────────

export interface TransactionDto {
  id: string
  categoryId: string
  categoryName: string
  type: TransactionType
  amount: string
  occurredOn: string
  note: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTransactionRequest {
  categoryId: string
  type: TransactionType
  amount: string
  occurredOn: string
  note?: string | null
}

export interface UpdateTransactionRequest {
  categoryId: string
  type: TransactionType
  amount: string
  occurredOn: string
  note?: string | null
}

export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export interface TransactionFilter {
  type?: TransactionType | null
  categoryId?: string | null
  from?: string | null
  to?: string | null
  sortBy?: TransactionSortBy | null
  sortOrder?: SortOrder | null
  page?: number
  pageSize?: number
}

// ── Dashboard ──────────────────────────────────────────

export interface CurrentMonthDto {
  income: string
  expense: string
  balance: string
  year: number
  month: number
}

export interface MonthlyTotalDto {
  year: number
  month: number
  income: string
  expense: string
}

export interface CategoryTotalDto {
  categoryId: string
  name: string
  total: string
  count: number
}

export interface DashboardSummaryDto {
  currentMonth: CurrentMonthDto
  last6Months: MonthlyTotalDto[]
  byCategory: CategoryTotalDto[]
}

// ── Problem Details (RFC 7807) ─────────────────────────

export interface ProblemDetails {
  type?: string
  title?: string
  status: number
  detail?: string
  instance?: string
  traceId?: string
}
