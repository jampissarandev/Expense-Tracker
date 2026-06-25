import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { useCreateCategory, useUpdateCategory } from "@/features/categories/api"
import { TransactionType } from "@/types/api"
import type { CategoryDto } from "@/types/api"

// ── Schema ──────────────────────────────────────────────────────────────────

const categorySchema = z.object({
  name: z
    .string()
    .min(1, "กรุณากรอกชื่อหมวดหมู่")
    .max(50, "ชื่อหมวดหมู่ต้องไม่เกิน 50 ตัวอักษร"),
  type: z.number().refine((v) => v === 0 || v === 1, {
    message: "กรุณาเลือกประเภท",
  }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "สีต้องอยู่ในรูปแบบ #RRGGBB")
    .optional()
    .or(z.literal("")),
})

type CategoryFormValues = z.infer<typeof categorySchema>
type CategoryFormInput = z.input<typeof categorySchema>

// ── Props ───────────────────────────────────────────────────────────────────

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingCategory: CategoryDto | null
}

// ── Component ───────────────────────────────────────────────────────────────

export function CategoryFormDialog({
  open,
  onOpenChange,
  editingCategory,
}: CategoryFormDialogProps) {
  const createMutation = useCreateCategory()
  const updateMutation = useUpdateCategory()
  const isEditing = editingCategory !== null

  const form = useForm<CategoryFormInput, undefined, CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      type: TransactionType.Expense,
      color: "",
    },
  })

  // Reset form when dialog opens or editing category changes
  useEffect(() => {
    if (open) {
      form.reset(
        isEditing
          ? {
              name: editingCategory.name,
              type: editingCategory.type,
              color: editingCategory.color ?? "",
            }
          : { name: "", type: TransactionType.Expense, color: "" },
      )
    }
  }, [open, isEditing, editingCategory, form])

  async function handleSubmit(values: CategoryFormValues) {
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({
          id: editingCategory.id,
          name: values.name,
          icon: null,
          color: values.color || null,
        })
        toast.success("แก้ไขหมวดหมู่สำเร็จ")
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          type: values.type as TransactionType,
          icon: null,
          color: values.color || null,
        })
        toast.success("สร้างหมวดหมู่สำเร็จ")
      }
      onOpenChange(false)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่"
      toast.error(message)
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "แก้ไขหมวดหมู่" : "เพิ่มหมวดหมู่"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "แก้ไขรายละเอียดหมวดหมู่"
              : "สร้างหมวดหมู่ใหม่สำหรับรายการของคุณ"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ชื่อหมวดหมู่</FormLabel>
                  <FormControl>
                    <Input placeholder="เช่น อาหาร, เดินทาง" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>ประเภท</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={String(field.value)}
                    disabled={isEditing}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกประเภท" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={String(TransactionType.Expense)}>
                        รายจ่าย
                      </SelectItem>
                      <SelectItem value={String(TransactionType.Income)}>
                        รายรับ
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>สี (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="#FF6B6B"
                        {...field}
                        className="flex-1"
                      />
                      {field.value ? (
                        <span
                          className="inline-block size-6 rounded-full border"
                          style={{ backgroundColor: field.value }}
                          aria-label="ตัวอย่างสี"
                        />
                      ) : null}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "กำลังบันทึก..."
                  : isEditing
                    ? "บันทึก"
                    : "สร้าง"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
