import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingFullPage } from "@/components/common/LoadingSpinner";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import CategoriesPage from "@/pages/CategoriesPage";
import TransactionsPage from "@/pages/TransactionsPage";
import NotFoundPage from "@/pages/NotFoundPage";

// ── RequireAuth wrapper ─────────────────────────────────────────────────────

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingFullPage label="กำลังตรวจสอบสิทธิ์" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// ── Route table ─────────────────────────────────────────────────────────────

export default function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Protected routes — all wrapped in the AppLayout shell */}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
      </Route>

      {/* 404 page for unmatched routes */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
