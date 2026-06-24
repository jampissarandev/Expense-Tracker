import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  /** Short headline describing the error category. */
  title?: string;
  /** Detail message — pass the thrown `Error.message` or a friendly summary. */
  message?: string;
  /** When provided, shows a "Try again" button that calls this handler. */
  onRetry?: () => void;
  /** Override the retry button label. */
  retryLabel?: string;
  /** Tailwind classes applied to the root container. */
  className?: string;
}

/**
 * Centered error state with an optional retry CTA. Used when a query
 * or mutation fails. Pass `onRetry` to enable the retry button.
 */
export function ErrorState({
  title = "Something went wrong",
  message = "Please try again in a moment.",
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-3 rounded-lg border px-6 py-10 text-center",
        className,
      )}
    >
      <AlertTriangleIcon className="text-destructive size-10" aria-hidden="true" />
      <h3 className="text-foreground text-sm font-medium">{title}</h3>
      {message ? <p className="text-muted-foreground max-w-sm text-sm">{message}</p> : null}
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          <RefreshCwIcon />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
