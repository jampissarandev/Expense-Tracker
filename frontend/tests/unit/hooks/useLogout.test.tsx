import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

vi.stubEnv("VITE_API_URL", "http://localhost:5117");

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockLogout = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/features/auth/use-auth", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "test@example.com", displayName: "Test User" },
    accessToken: "tok",
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: mockLogout,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ── Import after mocks ──────────────────────────────────────────────────────

import { useLogout } from "@/hooks/useLogout";

// ── Test harness ─────────────────────────────────────────────────────────────

function Harness({ redirectTo = "/login" }: { redirectTo?: string }) {
  const { logout, isLoggingOut } = useLogout(redirectTo);
  return (
    <div>
      <button onClick={() => void logout()} disabled={isLoggingOut}>
        Trigger logout
      </button>
      <span data-testid="status">{isLoggingOut ? "logging-out" : "idle"}</span>
    </div>
  );
}

function renderHarness(initialPath = "/dashboard", redirectTo = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Harness redirectTo={redirectTo} />
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useLogout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls auth logout, navigates to default /login, and shows success toast", async () => {
    const user = userEvent.setup();
    mockLogout.mockResolvedValueOnce(undefined);
    renderHarness();

    await user.click(screen.getByRole("button", { name: /trigger logout/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("navigates to the configured redirect path", async () => {
    const user = userEvent.setup();
    mockLogout.mockResolvedValueOnce(undefined);
    renderHarness("/dashboard", "/signed-out");

    await user.click(screen.getByRole("button", { name: /trigger logout/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/signed-out", {
        replace: true,
      });
    });
  });

  it("still redirects even when the auth logout call rejects", async () => {
    const user = userEvent.setup();
    mockLogout.mockRejectedValueOnce(new Error("Network error"));
    renderHarness();

    await user.click(screen.getByRole("button", { name: /trigger logout/i }));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
    // We always navigate away, even on error, so the user is not stuck.
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  it("toggles isLoggingOut during the request", async () => {
    const user = userEvent.setup();
    let resolveLogout: (() => void) | undefined;
    mockLogout.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLogout = resolve;
      }),
    );
    renderHarness();

    await user.click(screen.getByRole("button", { name: /trigger logout/i }));

    // While pending, the button should be disabled.
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("logging-out");
    });
    expect(screen.getByRole("button", { name: /trigger logout/i })).toBeDisabled();

    // Resolve the pending request and check we return to idle.
    resolveLogout!();
    await waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("idle");
    });
  });
});
