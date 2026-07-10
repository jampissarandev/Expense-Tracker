import { useEffect, useMemo } from "react"
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
import { DateInput } from "@/components/ui/date-input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import {
  useCreateTransaction,
  useUpdateTransaction,
} from "@/features/transactions/api"
import { useCategories } from "@/features/categories/api"
import { TransactionType } from "@/types/api"
import type { TransactionDto } from "@/types/api"

// ── Schema ──────────────────────────────────────────────────────────────────

const transactionSchema = z.object({
  type: z.number().refine((v) => v === 0 || v === 1, {
    message: "กรุณาเลือกประเภท",
  }),
  categoryId: z.string().min(1, "กรุณาเลือกหมวดหมู่"),
  amount: z
    .string()
    .min(1, "กรุณากรอกจำนวนเงิน")
    .regex(
      /^\d+(\.\d{1,2})?$/,
      "จำนวนเงินต้องเป็นตัวเลขและมีทศนิยมไม่เกิน 2 ตำแหน่ง",
    )
    .refine(
      (v) => {
        const num = parseFloat(v)
        return !isNaN(num) && num > 0 && num <= 999_999_999.99
      },
      { message: "จำนวนเงินต้องมากกว่า 0 และไม่เกิน 999,999,999.99" },
    ),
  occurredOn: z
    .string()
    .min(1, "กรุณาเลือกวันที่")
    .refine(
      (v) => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const selected = new Date(v + "T00:00:00")
        return selected <= today
      },
      { message: "ไม่สามารถเลือกวันที่ในอนาคตได้" },
    ),
  note: z
    .string()
    .max(500, "หมายเหตุต้องไม่เกิน 500 ตัวอักษร")
    .optional()
    .or(z.literal("")),
})

type TransactionFormValues = z.infer<typeof transactionSchema>
type TransactionFormInput = z.input<typeof transactionSchema>

// ── Props ───────────────────────────────────────────────────────────────────

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingTransaction: TransactionDto | null
}

// ── Labels ──────────────────────────────────────────────────────────────────

const typeLabels: Record<string, string> = {
  [String(TransactionType.Expense)]: "รายจ่าย",
  [String(TransactionType.Income)]: "รายรับ",
}

// ── Component ───────────────────────────────────────────────────────────────

export function TransactionFormDialog({
  open,
  onOpenChange,
  editingTransaction,
}: TransactionFormDialogProps) {
  const createMutation = useCreateTransaction()
  const updateMutation = useUpdateTransaction()
  const { data: categories } = useCategories()
  const isEditing = editingTransaction !== null

  const form = useForm<TransactionFormInput, undefined, TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: TransactionType.Expense,
      categoryId: "",
      amount: "",
      occurredOn: new Date().toISOString().split("T")[0],
      note: "",
    },
  })

  const selectedType = form.watch("type")

  // Filter categories by selected type
  const filteredCategories = useMemo(() => {
    if (!categories) return []
    return categories.filter((c) => c.type === selectedType)
  }, [categories, selectedType])

  // Category label lookup for SelectValue display
  const categoryLabelMap = useMemo(() => {
    if (!categories) return new Map<string, string>()
    return new Map(categories.map((c) => [c.id, c.name]))
  }, [categories])

  // Reset form when dialog opens or editing transaction changes
  useEffect(() => {
    if (open) {
      if (isEditing) {
        form.reset({
          type: editingTransaction.type,
          categoryId: editingTransaction.categoryId,
          amount: editingTransaction.amount,
          occurredOn: editingTransaction.occurredOn,
          note: editingTransaction.note ?? "",
        })
      } else {
        form.reset({
          type: TransactionType.Expense,
          categoryId: "",
          amount: "",
          occurredOn: new Date().toISOString().split("T")[0],
          note: "",
        })
      }
    }
  }, [open, isEditing, editingTransaction, form])

  // Reset categoryId when type changes (unless editing)
  useEffect(() => {
    if (!isEditing) {
      form.setValue("categoryId", "")
    }
  }, [selectedType, form, isEditing])

  async function handleSubmit(values: TransactionFormValues) {
    try {
      const request = {
        categoryId: values.categoryId,
        type: values.type as TransactionType,
        amount: values.amount,
        occurredOn: values.occurredOn,
        note: values.note || null,
      }

      if (isEditing) {
        await updateMutation.mutateAsync({
          id: editingTransaction.id,
          ...request,
        })
        toast.success("แก้ไขรายการสำเร็จ")
      } else {
        await createMutation.mutateAsync(request)
        toast.success("สร้างรายการสำเร็จ")
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
            {isEditing ? "แก้ไขรายการ" : "เพิ่มรายการ"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "แก้ไขรายละเอียดรายการ"
              : "เพิ่มรายการรายรับหรือรายจ่ายใหม่"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* Type toggle */}
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
                        <SelectValue placeholder="เลือกประเภท">
                          {(value: string) => typeLabels[value] ?? "เลือกประเภท"}
                        </SelectValue>
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

            {/* Category select — filtered by type */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมวดหมู่</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกหมวดหมู่">
                          {(value: string) => categoryLabelMap.get(value) ?? "เลือกหมวดหมู่"}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {filteredCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>จำนวนเงิน (฿)</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      inputMode="decimal"
                      placeholder="0.00"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date */}
            <FormField
              control={form.control}
              name="occurredOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>วันที่</FormLabel>
                  <FormControl>
                    <DateInput
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Note */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>หมายเหตุ (ไม่บังคับ)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="เช่น ซื้อกาแฟตอนเช้า"
                      {...field}
                    />
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
