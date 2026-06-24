import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingFullPage } from "@/components/common/LoadingSpinner";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";

// ── Protected placeholder pages ─────────────────────────────────────────────

function DashboardPage() {
  return (
    <div className="flex items-center justify-center py-16">
      <h1 className="text-2xl font-bold">แดชบอร์ด (P2.6)</h1>
    </div>
  );
}

function TransactionsPage() {
  return (
    <div className="flex items-center justify-center py-16">
      <h1 className="text-2xl font-bold">รายการ (P2.5)</h1>
    </div>
  );
}

function CategoriesPage() {
  return (
    <div className="flex items-center justify-center py-16">
      <h1 className="text-2xl font-bold">หมวดหมู่ (P2.4)</h1>
    </div>
  );
}

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

      {/* Catch-all redirect to dashboard */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
