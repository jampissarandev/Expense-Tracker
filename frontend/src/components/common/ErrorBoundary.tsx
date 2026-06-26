import { Component, type ReactNode, type ErrorInfo } from "react"
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
  /** Optional fallback UI to render instead of the default. */
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * React error boundary that catches rendering errors in its children tree.
 * Shows a friendly error UI with a retry button.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          className="flex min-h-[50vh] items-center justify-center p-8"
          role="alert"
        >
          <div className="text-center">
            <AlertTriangleIcon className="text-destructive mx-auto mb-4 size-12" />
            <h2 className="mb-2 text-xl font-semibold">
              เกิดข้อผิดพลาด
            </h2>
            <p className="text-muted-foreground mb-2 text-sm">
              มีข้อผิดพลาดบางอย่างในแอปพลิเคชัน
            </p>
            {this.state.error && (
              <p className="text-muted-foreground mb-6 max-w-md text-xs">
                {this.state.error.message}
              </p>
            )}
            <Button onClick={this.handleRetry}>
              <RefreshCwIcon className="mr-2 size-4" />
              ลองอีกครั้ง
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
