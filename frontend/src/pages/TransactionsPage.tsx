import { useState, useMemo } from "react"
import {
  PlusIcon,
  ListIcon,
  PencilIcon,
  Trash2Icon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  DownloadIcon,
  FileDownIcon,
  BarChart3Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DateInput } from "@/components/ui/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import {
  useTransactions,
  useDeleteTransaction,
} from "@/features/transactions/api"
import { useCategories } from "@/features/categories/api"
import { TransactionFormDialog } from "@/features/transactions/TransactionFormDialog"
import {
  downloadTransactionsCsv,
  downloadSummaryCsv,
} from "@/features/exports/api"
import { formatTHB, formatThaiDate } from "@/lib/format"
import { TransactionType } from "@/types/api"
import type { TransactionDto, TransactionFilter } from "@/types/api"

// ── Helpers ─────────────────────────────────────────────────────────────────

function typeBadgeVariant(type: TransactionType) {
  return type === TransactionType.Income
    ? ("default" as const)
    : ("secondary" as const)
}

function typeLabel(type: TransactionType): string {
  return type === TransactionType.Income ? "รายรับ" : "รายจ่าย"
}

// ── Component ───────────────────────────────────────────────────────────────

export default function TransactionsPage() {
  // ── Filter state ────────────────────────────────────────────────────────
  const [filterType, setFilterType] = useState<TransactionType | null>(null)
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>(null)
  const [filterFrom, setFilterFrom] = useState<string>("")
  const [filterTo, setFilterTo] = useState<string>("")
  const [page, setPage] = useState(1)
  const pageSize = 20

  const filter: TransactionFilter = useMemo(
    () => ({
      type: filterType,
      categoryId: filterCategoryId,
      from: filterFrom || null,
      to: filterTo || null,
      page,
      pageSize,
    }),
    [filterType, filterCategoryId, filterFrom, filterTo, page],
  )

  // ── Data ────────────────────────────────────────────────────────────────
  const {
    data: result,
    isLoading,
    isError,
    error,
    refetch,
  } = useTransactions(filter)

  const { data: categories } = useCategories()
  const deleteMutation = useDeleteTransaction()

  // ── Dialog state ────────────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionDto | null>(null)
  const [deletingTransaction, setDeletingTransaction] =
    useState<TransactionDto | null>(null)

  // ── Category lookup ─────────────────────────────────────────────────────
  const categoryMap = useMemo(() => {
    if (!categories) return new Map<string, string>()
    return new Map(categories.map((c) => [c.id, c.name]))
  }, [categories])

  function getCategoryName(categoryId: string): string {
    return categoryMap.get(categoryId) ?? ""
  }

  // ── Filtered categories for the filter bar ──────────────────────────────
  const filterCategories = useMemo(() => {
    if (!categories) return []
    if (filterType == null) return categories
    return categories.filter((c) => c.type === filterType)
  }, [categories, filterType])

  // ── Handlers ────────────────────────────────────────────────────────────

  function handleEdit(tx: TransactionDto) {
    setEditingTransaction(tx)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditingTransaction(null)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingTransaction(null)
  }

  function handleResetFilters() {
    setFilterType(null)
    setFilterCategoryId(null)
    setFilterFrom("")
    setFilterTo("")
    setPage(1)
  }

  function handleTypeFilterChange(value: string) {
    if (value === "all") {
      setFilterType(null)
    } else {
      setFilterType(Number(value) as TransactionType)
    }
    setFilterCategoryId(null)
    setPage(1)
  }

  async function handleDeleteConfirm() {
    if (!deletingTransaction) return
    try {
      await deleteMutation.mutateAsync(deletingTransaction.id)
      toast.success("ลบรายการสำเร็จ")
      setDeletingTransaction(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถลบรายการได้"
      toast.error(message)
    }
  }

  const hasActiveFilters =
    filterType !== null ||
    filterCategoryId !== null ||
    filterFrom !== "" ||
    filterTo !== ""

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-10 w-36" />
        </div>
        <Skeleton className="h-12 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────

  if (isError) {
    return (
      <ErrorState
        title="โหลดข้อมูลไม่สำเร็จ"
        message={error?.message ?? "กรุณาลองใหม่อีกครั้ง"}
        onRetry={() => refetch()}
      />
    )
  }

  // ── Data ────────────────────────────────────────────────────────────────

  const transactions = result?.items ?? []
  const totalCount = result?.totalCount ?? 0
  const totalPages = result?.totalPages ?? 0

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">รายการ</h1>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline">
                  <DownloadIcon className="mr-2 size-4" />
                  ส่งออก
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  toast.promise(downloadTransactionsCsv(filter), {
                    loading: "กำลังส่งออกรายการ...",
                    success: "ส่งออกรายการสำเร็จ",
                    error: "ส่งออกรายการไม่สำเร็จ",
                  })
                }}
              >
                <FileDownIcon className="mr-2 size-4" />
                ส่งออกรายการ (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  toast.promise(downloadSummaryCsv(), {
                    loading: "กำลังส่งออกรายงานสรุป...",
                    success: "ส่งออกรายงานสรุปสำเร็จ",
                    error: "ส่งออกรายงานสรุปไม่สำเร็จ",
                  })
                }}
              >
                <BarChart3Icon className="mr-2 size-4" />
                ส่งออกรายงานสรุป (CSV)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleAdd}>
            <PlusIcon className="mr-2 size-4" />
            เพิ่มรายการ
          </Button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-muted/50 flex flex-wrap items-end gap-3 rounded-lg p-4">
        {/* Type filter */}
        <div className="w-36">
          <label
            htmlFor="filter-type"
            className="text-muted-foreground mb-1 block text-xs font-medium"
          >
            ประเภท
          </label>
          <Select
            value={filterType != null ? String(filterType) : "all"}
            onValueChange={(value) =>
              handleTypeFilterChange(value ?? "all")
            }
          >
            <SelectTrigger id="filter-type">
              <SelectValue>
                {(value: string) => {
                  if (value === "all" || value == null) return "ทั้งหมด"
                  return typeLabel(Number(value) as TransactionType)
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value={String(TransactionType.Income)}>
                รายรับ
              </SelectItem>
              <SelectItem value={String(TransactionType.Expense)}>
                รายจ่าย
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Category filter */}
        <div className="w-44">
          <label
            htmlFor="filter-category"
            className="text-muted-foreground mb-1 block text-xs font-medium"
          >
            หมวดหมู่
          </label>
          <Select
            value={filterCategoryId ?? "all"}
            onValueChange={(value) => {
              setFilterCategoryId(value === "all" ? null : value)
              setPage(1)
            }}
          >
            <SelectTrigger id="filter-category">
              <SelectValue>
                {(value: string) => {
                  if (value === "all" || value == null) return "ทั้งหมด"
                  return (
                    categories?.find((c) => c.id === value)?.name ?? value
                  )
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              {filterCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date from */}
        <div className="w-40">
          <label
            htmlFor="filter-from"
            className="text-muted-foreground mb-1 block text-xs font-medium"
          >
            จากวันที่
          </label>
          <DateInput
            id="filter-from"
            value={filterFrom}
            onChange={(v) => {
              setFilterFrom(v)
              setPage(1)
            }}
          />
        </div>

        {/* Date to */}
        <div className="w-40">
          <label
            htmlFor="filter-to"
            className="text-muted-foreground mb-1 block text-xs font-medium"
          >
            ถึงวันที่
          </label>
          <DateInput
            id="filter-to"
            value={filterTo}
            onChange={(v) => {
              setFilterTo(v)
              setPage(1)
            }}
          />
        </div>

        {/* Reset button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="mb-0.5"
          >
            <XIcon className="mr-1 size-3" />
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Empty state (no transactions at all, no filters) */}
      {totalCount === 0 && !hasActiveFilters ? (
        <EmptyState
          title="ยังไม่มีรายการ"
          description="เริ่มต้นด้วยการเพิ่มรายการแรกของคุณ"
          icon={ListIcon}
          action={
            <Button onClick={handleAdd}>
              <PlusIcon className="mr-2 size-4" />
              เพิ่มรายการ
            </Button>
          }
        />
      ) : transactions.length === 0 ? (
        /* Empty result with active filters */
        <EmptyState
          title="ไม่พบรายการ"
          description="ลองเปลี่ยนตัวกรองหรือเพิ่มรายการใหม่"
          icon={ListIcon}
        />
      ) : (
        /* Table */
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">วันที่</TableHead>
                  <TableHead className="w-[80px]">ประเภท</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="w-[140px] text-right">
                    จำนวนเงิน
                  </TableHead>
                  <TableHead>หมายเหตุ</TableHead>
                  <TableHead className="w-[80px] text-right">
                    การกระทำ
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-medium">
                      {formatThaiDate(tx.occurredOn)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={typeBadgeVariant(tx.type)}>
                        {typeLabel(tx.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>{getCategoryName(tx.categoryId)}</TableCell>
                    <TableCell
                      className={
                        tx.type === TransactionType.Income
                          ? "text-right text-green-600 dark:text-green-400"
                          : "text-right text-red-600 dark:text-red-400"
                      }
                    >
                      {tx.type === TransactionType.Income ? "+" : "-"}
                      {formatTHB(tx.amount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate text-sm">
                      {tx.note ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(tx)}
                          aria-label={`แก้ไขรายการ ${tx.occurredOn}`}
                        >
                          <PencilIcon className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingTransaction(tx)}
                          aria-label={`ลบรายการ ${tx.occurredOn}`}
                        >
                          <Trash2Icon className="text-destructive size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-sm">
              แสดง {transactions.length} จาก {totalCount} รายการ
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <span className="text-sm">
                หน้า {page} / {totalPages || 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Create / Edit dialog */}
      <TransactionFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        editingTransaction={editingTransaction}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deletingTransaction !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingTransaction(null)
        }}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <Trash2Icon aria-hidden="true" />
            </AlertDialogMedia>
            <div>
              <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
              <AlertDialogDescription>
                คุณต้องการลบรายการวันที่{" "}
                {deletingTransaction?.occurredOn}{" "}
                ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
              </AlertDialogDescription>
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "กำลังลบ..." : "ลบ"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
