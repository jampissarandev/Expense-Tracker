import { createContext } from "react"
import type { UserDto } from "@/types/api"

export interface AuthContextValue {
  user: UserDto | null
  accessToken: string | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
