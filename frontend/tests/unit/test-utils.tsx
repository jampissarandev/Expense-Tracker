import { type ReactNode } from "react"
import { MemoryRouter } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

// ── Test wrappers ────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
})

/**
 * Wraps a component with all necessary providers for testing:
 * MemoryRouter + QueryClientProvider
 *
 * Note: AuthContext is NOT included by default — tests that need auth
 * should wrap with a mock or real AuthProvider separately.
 */
export function AllProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

/**
 * Wraps a component with MemoryRouter only — useful for testing
 * pages that manage their own auth state via useAuth mock.
 */
export function RouterWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>
}
