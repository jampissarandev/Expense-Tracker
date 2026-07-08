import { Trash2Icon } from "lucide-react"

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

export interface DeleteConfirmDialogProps {
  /** Whether the dialog is open. */
  open: boolean
  /** Called when the dialog requests to close (backdrop click, Esc, cancel). */
  onOpenChange: (open: boolean) => void
  /** Short title (e.g. "ยืนยันการลบ"). */
  title: string
  /** Body copy. */
  description: React.ReactNode
  /** Pending state for the destructive action — disables both buttons and switches the confirm label. */
  isPending?: boolean
  /** Label for the destructive confirm button. */
  confirmLabel?: string
  /** Label shown while `isPending` is true. */
  pendingLabel?: string
  /** Called when the user confirms. The dialog does NOT close itself — caller is expected to close on success. */
  onConfirm: () => void
}

/**
 * Shared delete-confirmation dialog. Used by every list/detail page that
 * exposes a destructive delete action.
 *
 * Pure presentational — it does not run mutations, perform navigation,
 * or close itself.
 */
export function DeleteConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  isPending = false,
  confirmLabel = "ลบ",
  pendingLabel = "กำลังลบ...",
  onConfirm,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="default">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2Icon aria-hidden="true" />
          </AlertDialogMedia>
          <div>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </div>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>ยกเลิก</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            variant="destructive"
          >
            {isPending ? pendingLabel : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
