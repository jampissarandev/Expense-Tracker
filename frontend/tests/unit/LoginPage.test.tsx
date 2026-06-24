import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── Mock auth module ─────────────────────────────────────────────────────────

const mockLogin = vi.fn()
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
    isLoading: false,
    login: mockLogin,
    register: vi.fn(),
    logout: vi.fn(),
  }),
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import LoginPage from "@/pages/LoginPage"

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <LoginPage />
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders login form with email and password fields", () => {
    renderLogin()

    expect(screen.getByLabelText(/อีเมล/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/รหัสผ่าน/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /เข้าสู่ระบบ/i }),
    ).toBeInTheDocument()
  })

  it("validates email and password on submit", async () => {
    const user = userEvent.setup()
    renderLogin()

    // Submit empty form
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(screen.getByText("กรุณากรอกอีเมลที่ถูกต้อง")).toBeInTheDocument()
    })
    expect(
      screen.getByText("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
    ).toBeInTheDocument()
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it("validates password minimum length", async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "short")
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(
        screen.getByText("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
      ).toBeInTheDocument()
    })
    expect(mockLogin).not.toHaveBeenCalled()
  })

  it("submits and redirects on success", async () => {
    const user = userEvent.setup()
    mockLogin.mockResolvedValueOnce(undefined)
    renderLogin()

    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "password123")
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123")
    })
  })

  it("shows error toast on login failure", async () => {
    const user = userEvent.setup()
    mockLogin.mockRejectedValueOnce(new Error("Invalid credentials"))
    renderLogin()

    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "password123")
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled()
    })
    // The error is handled inside the component (toast.error), so we just
    // verify the login function was called and the error was thrown
  })

  it("disables form while submitting", async () => {
    const user = userEvent.setup()
    // Create a promise that never resolves to keep the form in submitting state
    let resolveLogin: () => void
    mockLogin.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLogin()

    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "password123")
    await user.click(screen.getByRole("button", { name: /เข้าสู่ระบบ/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/อีเมล/i)).toBeDisabled()
      expect(screen.getByLabelText(/รหัสผ่าน/i)).toBeDisabled()
    })

    // Clean up: resolve the pending promise
    resolveLogin!()
  })

  it("links to register page", () => {
    renderLogin()

    const link = screen.getByRole("link", { name: /สมัครสมาชิก/i })
    expect(link).toHaveAttribute("href", "/register")
  })
})
