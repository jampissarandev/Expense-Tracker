import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  /** Title shown prominently. */
  title: string;
  /** Supporting copy under the title. */
  description?: string;
  /** Optional icon to render above the title. */
  icon?: LucideIcon;
  /** Optional call-to-action element (e.g. a `Button`). */
  action?: React.ReactNode;
  /** Tailwind classes applied to the root container. */
  className?: string;
}

/**
 * Centered empty state used by lists, dashboards, and tables when there is
 * no data to show. Keeps copy and structure consistent across the app.
 */
export function EmptyState({ title, description, icon: Icon, action, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "border-border bg-muted/30 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? <Icon className="text-muted-foreground size-10" aria-hidden="true" /> : null}
      <h3 className="text-foreground text-sm font-medium">{title}</h3>
      {description ? <p className="text-muted-foreground max-w-sm text-sm">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
