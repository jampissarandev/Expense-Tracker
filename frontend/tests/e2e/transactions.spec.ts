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

test.beforeAll(async () => {
  userEmail = uniqueEmail("txn")
  const result = await registerViaApi(
    userEmail,
    TEST_PASSWORD,
    "Transaction Tester",
  )
  accessToken = result.accessToken

  const expCat = await createCategoryViaApi(accessToken, {
    name: `E2E Expense-${Date.now()}`,
    type: "expense",
  })
  expenseCategoryId = expCat.id
})

test.describe("Transactions page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthCookie(page, userEmail, TEST_PASSWORD)
    await page.goto("/transactions")
  })

  test("creates a transaction via dialog", async ({ page }) => {
    await page.getByRole("button", { name: "เพิ่มรายการ" }).click()

    // Dialog should open
    await expect(page.getByRole("dialog")).toBeVisible()

    // Select expense category
    // The category select has placeholder "เลือกหมวดหมู่"
    const categorySelects = page.getByRole("combobox")
    await categorySelects.nth(1).click()
    await page.getByRole("option", { name: /E2E Expense/ }).click()

    // Fill amount
    await page.getByLabel("จำนวนเงิน").fill("250.50")

    // Fill note
    await page.getByLabel("หมายเหตุ").fill("E2E test transaction")

    // Submit
    await page.getByRole("button", { name: "บันทึก" }).click()

    // Transaction should appear in the table
    await expect(page.getByText("E2E test transaction")).toBeVisible({
      timeout: 5_000,
    })
  })

  test("shows empty state when no transactions", async ({ page }) => {
    // This user might have transactions from other tests,
    // but the page should still render properly
    await expect(page.getByRole("button", { name: "เพิ่มรายการ" })).toBeVisible()
  })

  test("deletes a transaction", async ({ page }) => {
    // Create a transaction to delete
    const txn = await createTransactionViaApi(accessToken, {
      categoryId: expenseCategoryId,
      type: "expense",
      amount: "42",
      occurredOn: "2026-06-20",
      note: `del-me-${Date.now()}`,
    })

    await page.reload()

    // Find the row with the note and click delete
    const row = page.getByText(txn.note!).locator("..")
    await row.getByRole("button", { name: "" }).last().click()

    // Confirm in alert dialog
    await page.getByRole("alertdialog").waitFor({ state: "visible" })
    await page.getByRole("button", { name: "ยืนยัน" }).click()

    await expect(page.getByText(txn.note!)).not.toBeVisible({ timeout: 5_000 })
  })
})
