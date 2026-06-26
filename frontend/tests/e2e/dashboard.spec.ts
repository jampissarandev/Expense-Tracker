import { test, expect } from "@playwright/test"
import {
  uniqueEmail,
  TEST_PASSWORD,
  registerViaApi,
  createCategoryViaApi,
  createTransactionViaApi,
  seedAuthCookie,
} from "./helpers"

let userEmail: string

test.beforeAll(async () => {
  userEmail = uniqueEmail("dash")
  const result = await registerViaApi(
    userEmail,
    TEST_PASSWORD,
    "Dashboard Tester",
  )
  const accessToken = result.accessToken.token

  // Seed data for the dashboard
  const expCat = await createCategoryViaApi(accessToken, {
    name: `Dash Expense-${Date.now()}`,
    type: "expense",
  })
  const incCat = await createCategoryViaApi(accessToken, {
    name: `Dash Income-${Date.now()}`,
    type: "income",
  })

  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const year = today.getFullYear()

  await createTransactionViaApi(accessToken, {
    categoryId: incCat.id,
    type: "income",
    amount: "50000",
    occurredOn: `${year}-${month}-05`,
    note: "salary",
  })
  await createTransactionViaApi(accessToken, {
    categoryId: expCat.id,
    type: "expense",
    amount: "1200",
    occurredOn: `${year}-${month}-10`,
    note: "groceries",
  })
})

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthCookie(page, userEmail, TEST_PASSWORD)
    await page.goto("/")
    // Wait for dashboard data to load
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/dashboard/summary") && res.status() === 200,
    )
  })

  test("renders KPI cards with values", async ({ page }) => {
    // Should show รายรับ (income), รายจ่าย (expense), คงเหลือ (balance)
    await expect(page.getByText("รายรับ").first()).toBeVisible()
    await expect(page.getByText("รายจ่าย").first()).toBeVisible()
    await expect(page.getByText("คงเหลือ").first()).toBeVisible()
  })

  test("renders charts", async ({ page }) => {
    // Recharts renders SVG elements with class "recharts-surface"
    const svgs = page.locator("svg.recharts-surface")
    await expect(svgs.first()).toBeVisible({ timeout: 10_000 })
  })
})
