import { type Page } from "@playwright/test"

export const API_URL = process.env.API_URL ?? "http://localhost:5117"
export const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173"

export const TEST_PASSWORD = "TestPass123!"

/** Unique email per test run to avoid collisions. */
export function uniqueEmail(prefix = "e2e"): string {
  const ts = Date.now()
  const rand = Math.random().toString(36).slice(2, 6)
  return `${prefix}-${ts}-${rand}@test.local`
}

// ── API helpers (bypass UI for speed where appropriate) ─────────────────────

interface ApiAuthResult {
  /** The raw response from /api/auth/{register,login} — accessToken is a
   *  {token, expiresAt} object. Callers should use `result.accessToken.token`
   *  to get the bearer token, matching how AuthContext does it. */
  accessToken: { token: string; expiresAt: string }
  refreshToken: string
  refreshTokenExpiresAt: string
  user: { id: string; email: string; displayName: string }
}

/** Convenience: extract the bearer token string from an auth result. */
export function bearer(result: ApiAuthResult): string {
  return result.accessToken.token
}

/** Register a user via the API and return tokens + user. */
export async function registerViaApi(
  email: string,
  password: string,
  displayName: string,
): Promise<ApiAuthResult> {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`registerViaApi failed (${res.status}): ${body}`)
  }
  return res.json()
}

/** Login via the API and return tokens + user. */
export async function loginViaApi(
  email: string,
  password: string,
): Promise<ApiAuthResult> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`loginViaApi failed (${res.status}): ${body}`)
  }
  return res.json()
}

// ── UI helpers ──────────────────────────────────────────────────────────────

/**
 * Login through the UI to seed the HttpOnly `et_rt` refresh cookie.
 * The browser must receive the cookie from the server — can't set it via JS.
 */
export async function seedAuthCookie(
  page: Page,
  email: string,
  password: string,
) {
  await page.goto("/login")
  await page.getByLabel("อีเมล (Email)").fill(email)
  await page.getByLabel("รหัสผ่าน (Password)").fill(password)
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()
  // Wait for redirect to dashboard (the "/" route)
  await page.waitForURL(`${FRONTEND_URL}/`, { timeout: 15_000 })
}

/** Create a category via the API (with bearer token). */
export async function createCategoryViaApi(
  accessToken: string,
  body: { name: string; type: "income" | "expense"; color?: string },
) {
  const res = await fetch(`${API_URL}/api/categories`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: body.name,
      type: body.type === "income" ? 0 : 1,
      icon: null,
      color: body.color ?? null,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createCategoryViaApi failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<{
    id: string
    name: string
    type: number
    isSystem: boolean
  }>
}

/** Create a transaction via the API (with bearer token). */
export async function createTransactionViaApi(
  accessToken: string,
  body: {
    categoryId: string
    type: "income" | "expense"
    amount: string
    occurredOn: string
    note?: string
  },
) {
  const res = await fetch(`${API_URL}/api/transactions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      categoryId: body.categoryId,
      type: body.type === "income" ? 0 : 1,
      amount: body.amount,
      occurredOn: body.occurredOn,
      note: body.note ?? null,
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`createTransactionViaApi failed (${res.status}): ${text}`)
  }
  return res.json() as Promise<{
    id: string
    note: string | null
    amount: string
  }>
}
