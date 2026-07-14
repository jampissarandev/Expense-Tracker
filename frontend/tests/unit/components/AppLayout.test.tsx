import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.stubEnv("VITE_API_URL", "http://localhost:5117");

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "alice@example.com", displayName: "Alice" },
    accessToken: "tok",
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

// ── Imports (after mocks) ───────────────────────────────────────────────────

import { AppLayout } from "@/components/layout/AppLayout";
import { UserMenu } from "@/components/layout/UserMenu";
import { useLogout } from "@/hooks/useLogout";

// Mock useLogout so the tests can observe the menu wiring without
// triggering real navigation/toast side-effects.
vi.mock("@/hooks/useLogout", () => ({
  useLogout: vi.fn(() => ({
    logout: vi.fn(),
    isLoggingOut: false,
  })),
}));

const mockUseLogout = vi.mocked(useLogout);

// ── Helpers ─────────────────────────────────────────────────────────────────

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<div data-testid="page">Dashboard page</div>} />
          <Route path="/transactions" element={<div data-testid="page">Transactions page</div>} />
          <Route path="/categories" element={<div data-testid="page">Categories page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogout.mockReturnValue({
      logout: vi.fn(),
      isLoggingOut: false,
    });
  });

  it("renders navigation links and the user menu", () => {
    renderAt("/");

    // Navigation is rendered
    const nav = screen.getByRole("navigation", { name: /เมนูหลัก/i });
    expect(nav).toBeInTheDocument();
    expect(within(nav).getByText("แดชบอร์ด")).toBeInTheDocument();
    expect(within(nav).getByText("รายการ")).toBeInTheDocument();
    expect(within(nav).getByText("หมวดหมู่")).toBeInTheDocument();

    // User menu trigger is rendered
    expect(screen.getByRole("button", { name: /เปิดเมนูผู้ใช้/i })).toBeInTheDocument();
  });

  it("renders the page content via <Outlet />", () => {
    renderAt("/transactions");
    expect(screen.getByTestId("page")).toHaveTextContent("Transactions page");
  });

  it("highlights the active route in the sidebar", () => {
    renderAt("/categories");

    const nav = screen.getByRole("navigation", { name: /เมนูหลัก/i });
    const dashboardLink = within(nav).getByText("แดชบอร์ด").closest("a");
    const categoriesLink = within(nav).getByText("หมวดหมู่").closest("a");

    // Active route gets the primary background and font-medium
    expect(categoriesLink?.className).toMatch(/bg-primary\/10/);
    expect(categoriesLink?.className).toMatch(/font-medium/);

    // Inactive routes do not
    expect(dashboardLink?.className).not.toMatch(/bg-primary\/10/);
  });

  it("uses end-match on the dashboard link so /transactions does not highlight it", () => {
    renderAt("/transactions");
    const nav = screen.getByRole("navigation", { name: /เมนูหลัก/i });
    const dashboardLink = within(nav).getByText("แดชบอร์ด").closest("a");
    expect(dashboardLink?.className).not.toMatch(/bg-primary\/10/);
  });

  it("renders the TopBar with a page title derived from the current route", () => {
    renderAt("/transactions");
    const banner = screen.getByRole("banner");
    expect(banner).toBeInTheDocument();
    expect(within(banner).getByRole("heading", { name: /รายการทั้งหมด/i })).toBeInTheDocument();
  });

  it("renders the MobileTabBar with a primary Add button", () => {
    renderAt("/");
    const bottomnav = screen.getByRole("navigation", { name: /เมนูนำทางด้านล่าง/i });
    expect(bottomnav).toBeInTheDocument();
    expect(within(bottomnav).getByRole("button", { name: /เพิ่มรายการใหม่/i })).toBeInTheDocument();
  });

  it("clicking the MobileTabBar Add button navigates to /transactions", async () => {
    const user = userEvent.setup();
    renderAt("/");
    await user.click(screen.getByRole("button", { name: /เพิ่มรายการใหม่/i }));
    // Outlet renders <div data-testid="page">Transactions page</div> on /transactions
    await waitFor(() => {
      expect(screen.getByTestId("page")).toHaveTextContent("Transactions page");
    });
  });
});

describe("UserMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLogout.mockReturnValue({
      logout: vi.fn(),
      isLoggingOut: false,
    });
  });

  it("shows the user's display name in the trigger on sm+ screens", () => {
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("opens the dropdown and shows profile + logout options", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /เปิดเมนูผู้ใช้/i }));

    // "Alice" appears in both the trigger and the dropdown label — assert both
    expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByText("โปรไฟล์")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /ออกจากระบบ/i })).toBeInTheDocument();
  });

  it("triggers logout from the dropdown and redirects to /login", async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue(undefined);
    mockUseLogout.mockReturnValue({ logout, isLoggingOut: false });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /เปิดเมนูผู้ใช้/i }));
    await user.click(screen.getByRole("menuitem", { name: /ออกจากระบบ/i }));

    await waitFor(() => {
      expect(logout).toHaveBeenCalledTimes(1);
    });
    // useLogout itself is responsible for navigating to /login
  });

  it("shows a logging-out label and disables the item while in flight", async () => {
    const user = userEvent.setup();
    mockUseLogout.mockReturnValue({
      logout: vi.fn(),
      isLoggingOut: true,
    });

    render(
      <MemoryRouter>
        <UserMenu />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /เปิดเมนูผู้ใช้/i }));

    const item = screen.getByRole("menuitem", { name: /ออกจากระบบ/i });
    expect(item).toHaveTextContent("กำลังออกจากระบบ");
    // base-ui MenuItem uses aria-disabled instead of the native `disabled` attribute
    expect(item).toHaveAttribute("aria-disabled", "true");
  });
});
