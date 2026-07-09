import { useState } from "react"
import { TagsIcon, PlusIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyState } from "@/components/common/EmptyState"
import { ErrorState } from "@/components/common/ErrorState"
import { PageHeader } from "@/components/common/PageHeader"
import {
  useCategories,
  useDeleteCategory,
} from "@/features/categories/api"
import { CategoryFormDialog } from "@/features/categories/CategoryFormDialog"
import type { CategoryDto } from "@/types/api"
import { TransactionType } from "@/types/api"

// ── Helpers ─────────────────────────────────────────────────────────────────

function typeLabel(type: TransactionType): string {
  return type === TransactionType.Income ? "รายรับ" : "รายจ่าย"
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { data: categories, isLoading, isError, error, refetch } = useCategories()
  const deleteMutation = useDeleteCategory()

  const [formOpen, setFormOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoryDto | null>(null)

  function handleEdit(category: CategoryDto) {
    setEditingCategory(category)
    setFormOpen(true)
  }

  function handleAdd() {
    setEditingCategory(null)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setEditingCategory(null)
  }

  async function handleDeleteConfirm() {
    if (!deletingCategory) return
    try {
      await deleteMutation.mutateAsync(deletingCategory.id)
      toast.success("ลบหมวดหมู่สำเร็จ")
      setDeletingCategory(null)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ไม่สามารถลบหมวดหมู่ได้"
      toast.error(message)
    }
  }

  // ── Loading state ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-24" />
            ))}
          </div>
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

  const systemCategories = categories?.filter((c) => c.isSystem) ?? []
  const userCategories = categories?.filter((c) => !c.isSystem) ?? []

  // ── Page header (shared across empty + data states) ────────────────────

  const pageHeader = (
    <PageHeader
      title="หมวดหมู่"
      description="จัดการหมวดหมู่รายรับรายจ่ายของคุณ"
      actions={
        <Button onClick={handleAdd}>
          <PlusIcon className="mr-2 size-4" />
          เพิ่มหมวดหมู่
        </Button>
      }
    />
  )

  // ── Empty state (no categories at all) ──────────────────────────────────

  if (categories && categories.length === 0) {
    return (
      <div className="space-y-6">
        {pageHeader}
        <EmptyState
          title="ยังไม่มีหมวดหมู่"
          description="เริ่มต้นด้วยการเพิ่มหมวดหมู่แรกของคุณ"
          icon={TagsIcon}
          action={
            <Button onClick={handleAdd}>
              <PlusIcon className="mr-2 size-4" />
              เพิ่มหมวดหมู่
            </Button>
          }
        />
        <CategoryFormDialog
          open={formOpen}
          onOpenChange={handleFormClose}
          editingCategory={editingCategory}
        />
      </div>
    )
  }

  // ── Main render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-8">
      {pageHeader}

      {/* System categories */}
      {systemCategories.length > 0 && (
        <section aria-label="หมวดหมู่ระบบ">
          <h2 className="text-muted-foreground mb-3 text-sm font-medium">
            หมวดหมู่ระบบ
          </h2>
          <div className="flex flex-wrap gap-2">
            {systemCategories.map((category) => (
              <Badge
                key={category.id}
                variant="secondary"
                className="gap-1.5 px-3 py-1.5 text-sm"
              >
                {category.color ? (
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                ) : null}
                {category.name}
                <span className="text-muted-foreground ml-1 text-xs">
                  {typeLabel(category.type)}
                </span>
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* User categories */}
      <section aria-label="หมวดหมู่ของฉัน">
        <h2 className="text-muted-foreground mb-3 text-sm font-medium">
          หมวดหมู่ของฉัน
        </h2>
        {userCategories.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            ยังไม่มีหมวดหมู่ที่คุณสร้างเอง กด &ldquo;เพิ่มหมวดหมู่&rdquo; เพื่อเริ่มต้น
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {userCategories.map((category) => (
              <Badge
                key={category.id}
                variant="outline"
                className="gap-1.5 px-3 py-1.5 text-sm"
              >
                {category.color ? (
                  <span
                    className="inline-block size-2.5 rounded-full"
                    style={{ backgroundColor: category.color }}
                    aria-hidden="true"
                  />
                ) : null}
                {category.name}
                <span className="text-muted-foreground ml-1 text-xs">
                  {typeLabel(category.type)}
                </span>
                <button
                  type="button"
                  onClick={() => handleEdit(category)}
                  className="text-muted-foreground hover:text-foreground ml-1 inline-flex items-center"
                  aria-label={`แก้ไข ${category.name}`}
                >
                  <PencilIcon className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingCategory(category)}
                  className="text-muted-foreground hover:text-destructive ml-0.5 inline-flex items-center"
                  aria-label={`ลบ ${category.name}`}
                >
                  <Trash2Icon className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </section>

      {/* Create / Edit dialog */}
      <CategoryFormDialog
        open={formOpen}
        onOpenChange={handleFormClose}
        editingCategory={editingCategory}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={deletingCategory !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingCategory(null)
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
                คุณต้องการลบหมวดหมู่ &ldquo;{deletingCategory?.name}&rdquo; ใช่หรือไม่?
                การกระทำนี้ไม่สามารถย้อนกลับได้
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
