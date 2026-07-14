import {
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react"
import apiClient, { setTokenGetter, setLogoutHandler } from "@/lib/apiClient"
import type { UserDto, AuthResponse } from "@/types/api"
import { AuthContext } from "./auth-context"

// ── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserDto | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Expose accessToken to the apiClient interceptor via getter
  useEffect(() => {
    setTokenGetter(() => accessToken)
  }, [accessToken])

  // Register a logout handler so apiClient can clear local auth state when
  // the refresh-token flow has failed and there is no way to recover.
  // We do not navigate here — the route guard handles redirect to /login.
  useEffect(() => {
    setLogoutHandler(() => {
      setAccessToken(null)
      setUser(null)
    })
  }, [])

  // On mount: attempt silent refresh
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await apiClient.post<AuthResponse>(
          "/api/auth/refresh",
        )
        if (!cancelled) {
          setAccessToken(data.accessToken.token)
          setUser(data.user)
        }
      } catch {
        // Not authenticated — stay logged out
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ── Auth actions ─────────────────────────────────────────────────────────

  const applyAuthResponse = useCallback((data: AuthResponse) => {
    setAccessToken(data.accessToken.token)
    setUser(data.user)
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await apiClient.post<AuthResponse>("/api/auth/login", {
        email,
        password,
      })
      applyAuthResponse(data)
    },
    [applyAuthResponse],
  )

  const register = useCallback(
    async (email: string, password: string, displayName: string) => {
      const { data } = await apiClient.post<AuthResponse>(
        "/api/auth/register",
        { email, password, displayName },
      )
      applyAuthResponse(data)
    },
    [applyAuthResponse],
  )

  const logout = useCallback(async () => {
    try {
      await apiClient.post("/api/auth/logout")
    } finally {
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{ user, accessToken, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}


