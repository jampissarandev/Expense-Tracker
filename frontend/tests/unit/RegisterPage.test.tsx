import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

vi.stubEnv("VITE_API_URL", "http://localhost:5117")

// ── Mock auth module ─────────────────────────────────────────────────────────

const mockRegister = vi.fn()
vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    accessToken: null,
    isLoading: false,
    login: vi.fn(),
    register: mockRegister,
    logout: vi.fn(),
  }),
}))

// ── Import after mocks ──────────────────────────────────────────────────────

import RegisterPage from "@/pages/RegisterPage"

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderRegister() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <RegisterPage />
    </MemoryRouter>,
  )
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("RegisterPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders registration form with all fields", () => {
    renderRegister()

    expect(screen.getByLabelText(/ชื่อที่แสดง/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/อีเมล/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/รหัสผ่าน/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /สมัครสมาชิก/i }),
    ).toBeInTheDocument()
  })

  it("validates display name, email and password on submit", async () => {
    const user = userEvent.setup()
    renderRegister()

    // Submit empty form
    await user.click(screen.getByRole("button", { name: /สมัครสมาชิก/i }))

    await waitFor(() => {
      expect(
        screen.getByText("กรุณากรอกชื่อที่แสดง"),
      ).toBeInTheDocument()
    })
    expect(screen.getByText("กรุณากรอกอีเมลที่ถูกต้อง")).toBeInTheDocument()
    expect(
      screen.getByText("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
    ).toBeInTheDocument()
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it("validates password minimum length", async () => {
    const user = userEvent.setup()
    renderRegister()

    await user.type(screen.getByLabelText(/ชื่อที่แสดง/i), "Test User")
    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "short")
    await user.click(screen.getByRole("button", { name: /สมัครสมาชิก/i }))

    await waitFor(() => {
      expect(
        screen.getByText("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"),
      ).toBeInTheDocument()
    })
    expect(mockRegister).not.toHaveBeenCalled()
  })

  it("submits and calls register with correct arguments", async () => {
    const user = userEvent.setup()
    mockRegister.mockResolvedValueOnce(undefined)
    renderRegister()

    await user.type(screen.getByLabelText(/ชื่อที่แสดง/i), "Test User")
    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "password123")
    await user.click(screen.getByRole("button", { name: /สมัครสมาชิก/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith(
        "test@example.com",
        "password123",
        "Test User",
      )
    })
  })

  it("shows error on 409 conflict (email already exists)", async () => {
    const user = userEvent.setup()
    mockRegister.mockRejectedValueOnce(new Error("409 Conflict"))
    renderRegister()

    await user.type(screen.getByLabelText(/ชื่อที่แสดง/i), "Test User")
    await user.type(screen.getByLabelText(/อีเมล/i), "test@example.com")
    await user.type(screen.getByLabelText(/รหัสผ่าน/i), "password123")
    await user.click(screen.getByRole("button", { name: /สมัครสมาชิก/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled()
    })
  })

  it("links to login page", () => {
    renderRegister()

    const link = screen.getByRole("link", { name: /เข้าสู่ระบบ/i })
    expect(link).toHaveAttribute("href", "/login")
  })
})
