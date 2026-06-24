import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingSpinnerProps {
  /** Optional accessible label (defaults to "Loading"). */
  label?: string;
  /** Tailwind size classes for the icon. Defaults to `size-6`. */
  className?: string;
}

/**
 * Inline spinner suitable for buttons, inline states, and small blocks.
 *
 * For page-level loading, use the `Skeleton` primitive or a dedicated
 * skeleton block per page.
 */
export function LoadingSpinner({ label = "Loading", className }: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("inline-flex items-center", className)}
    >
      <Loader2Icon className="text-muted-foreground size-6 animate-spin" />
    </span>
  );
}

/**
 * Centered full-page loading state used while authentication or
 * route data is still resolving.
 */
export function LoadingFullPage({ label = "Loading" }: { label?: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <Loader2Icon className="text-muted-foreground size-10 animate-spin" aria-hidden="true" />
    </div>
  );
}
