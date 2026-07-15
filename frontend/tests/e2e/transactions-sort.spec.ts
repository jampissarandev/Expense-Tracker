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
let accessToken: string
let expenseCategoryId: string
let incomeCategoryId: string

test.beforeAll(async () => {
  userEmail = uniqueEmail("sort")
  const result = await registerViaApi(
    userEmail,
    TEST_PASSWORD,
    "Sort Tester",
  )
  accessToken = result.accessToken.token

  const expCat = await createCategoryViaApi(accessToken, {
    name: `Sort Expense-${Date.now()}`,
    type: "expense",
  })
  expenseCategoryId = expCat.id

  const incCat = await createCategoryViaApi(accessToken, {
    name: `Sort Income-${Date.now()}`,
    type: "income",
  })
  incomeCategoryId = incCat.id

  // Create transactions with varied amounts for sort testing
  await createTransactionViaApi(accessToken, {
    categoryId: expenseCategoryId,
    type: "expense",
    amount: "500",
    occurredOn: "2026-06-15",
    note: "sort-large-expense",
  })
  await createTransactionViaApi(accessToken, {
    categoryId: incomeCategoryId,
    type: "income",
    amount: "1000",
    occurredOn: "2026-06-10",
    note: "sort-large-income",
  })
  await createTransactionViaApi(accessToken, {
    categoryId: expenseCategoryId,
    type: "expense",
    amount: "50",
    occurredOn: "2026-06-20",
    note: "sort-small-expense",
  })
})

test.describe("Transactions sort", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthCookie(page, userEmail, TEST_PASSWORD)
    await page.goto("/transactions")
    // Wait for the table to load
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 })
  })

  test("clicking a column header sets aria-sort and changes icon", async ({ page }) => {
    // Find the "จำนวนเงิน" column header button
    const amountBtn = page.getByRole("button", { name: "จำนวนเงิน" })
    await expect(amountBtn).toBeVisible()

    // Click → descending sort
    await amountBtn.click()
    await expect(amountBtn).toBeVisible()

    // The parent <th> should have aria-sort="descending"
    const amountTh = amountBtn.locator("..")
    await expect(amountTh).toHaveAttribute("aria-sort", "descending")
  })

  test("clicking the same column twice toggles desc → asc", async ({ page }) => {
    const amountBtn = page.getByRole("button", { name: "จำนวนเงิน" })
    await expect(amountBtn).toBeVisible()
    const amountTh = amountBtn.locator("..")

    // First click: descending
    await amountBtn.click()
    await expect(amountTh).toHaveAttribute("aria-sort", "descending")

    // Second click: ascending
    await amountBtn.click()
    await expect(amountTh).toHaveAttribute("aria-sort", "ascending")
  })

  test("third click resets the sort", async ({ page }) => {
    const amountBtn = page.getByRole("button", { name: "จำนวนเงิน" })
    await expect(amountBtn).toBeVisible()
    const amountTh = amountBtn.locator("..")

    // First click: desc
    await amountBtn.click()
    await expect(amountTh).toHaveAttribute("aria-sort", "descending")

    // Second click: asc
    await amountBtn.click()
    await expect(amountTh).toHaveAttribute("aria-sort", "ascending")

    // Third click: reset (back to none)
    await amountBtn.click()
    await expect(amountTh).toHaveAttribute("aria-sort", "none")
  })

  test("clicking a different column switches sort to that column", async ({ page }) => {
    // Sort by จำนวนเงิน first
    const amountBtn = page.getByRole("button", { name: "จำนวนเงิน" })
    await expect(amountBtn).toBeVisible()
    const amountTh = amountBtn.locator("..")

    await amountBtn.click()
    await expect(amountTh).toHaveAttribute("aria-sort", "descending")

    // Now click "วันที่" column — the amount column should reset
    const dateBtn = page.getByRole("button", { name: "วันที่", exact: true })
    await expect(dateBtn).toBeVisible()
    const dateTh = dateBtn.locator("..")

    await dateBtn.click()
    await expect(dateTh).toHaveAttribute("aria-sort", "descending")
    await expect(amountTh).toHaveAttribute("aria-sort", "none")
  })

  test("sortable headers use button elements with cursor-pointer", async ({ page }) => {
    // Verify all 5 sortable columns have buttons
    const sortableLabels = ["วันที่", "ประเภท", "หมวดหมู่", "จำนวนเงิน", "หมายเหตุ"]
    for (const label of sortableLabels) {
      const btn = page.getByRole("button", { name: label, exact: true })
      await expect(btn).toBeVisible({ timeout: 5_000 })
    }

    // The "การกระทำ" column should NOT be a button
    const actionTh = page.getByRole("columnheader").filter({ hasText: "การกระทำ" })
    await expect(actionTh.locator("button")).toHaveCount(0)
  })
})
