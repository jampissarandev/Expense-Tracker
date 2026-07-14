import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/use-auth";

export interface UseLogoutResult {
  /** Trigger a logout (calls `/api/auth/logout`, clears local state, redirects). */
  logout: () => Promise<void>;
  /** True while the logout request is in flight. */
  isLoggingOut: boolean;
}

/**
 * Convenience hook wrapping the `logout` action from `AuthContext`.
 *
 * On success: clears the auth state, navigates to `/login`, and shows a toast.
 * On failure: still clears local state and redirects — the server may have
 * already revoked the token, and we should not leave the user "stuck" with a
 * stale session.
 */
export function useLogout(redirectTo: string = "/login"): UseLogoutResult {
  const { logout: authLogout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const logout = useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await authLogout();
      toast.success("ออกจากระบบเรียบร้อย");
    } catch (err) {
      // Even if the server call fails, we still want to log the user out
      // locally — the token may already be revoked server-side.
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(`ออกจากระบบไม่สำเร็จ: ${message}`);
    } finally {
      setIsLoggingOut(false);
      navigate(redirectTo, { replace: true });
    }
  }, [authLogout, isLoggingOut, navigate, redirectTo]);

  return { logout, isLoggingOut };
}
