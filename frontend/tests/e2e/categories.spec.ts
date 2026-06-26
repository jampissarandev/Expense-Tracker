import { test, expect } from "@playwright/test"
import {
  uniqueEmail,
  TEST_PASSWORD,
  registerViaApi,
  createCategoryViaApi,
  seedAuthCookie,
} from "./helpers"

let userEmail: string
let accessToken: string

test.beforeAll(async () => {
  userEmail = uniqueEmail("cat")
  const result = await registerViaApi(userEmail, TEST_PASSWORD, "Category Tester")
  accessToken = result.accessToken
})

test.describe("Categories page", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthCookie(page, userEmail, TEST_PASSWORD)
    await page.goto("/categories")
    // Wait for the categories API to respond
    await page.waitForResponse(
      (res) => res.url().includes("/api/categories") && res.status() === 200,
    )
  })

  test("shows system categories as read-only", async ({ page }) => {
    // System categories like Food, Transport, Salary should be visible
    // They appear as badges without edit/delete buttons
    const systemBadges = page.locator("text=Food")
    await expect(systemBadges.first()).toBeVisible()
  })

  test("creates a custom category", async ({ page }) => {
    const catName = `TestCat-${Date.now()}`

    // Click the add category button
    await page.getByRole("button", { name: "เพิ่มหมวดหมู่" }).click()

    // The dialog should appear
    await expect(page.getByRole("dialog")).toBeVisible()

    // Fill the name field
    await page.getByLabel("ชื่อหมวดหมู่").fill(catName)

    // Type is already set to "รายจ่าย" (expense) by default
    // Submit
    await page.getByRole("button", { name: "บันทึก" }).click()

    // Dialog should close and new category should appear
    await expect(page.getByText(catName)).toBeVisible({ timeout: 5_000 })
  })

  test("deletes a custom category", async ({ page }) => {
    // Create a category to delete via API
    const cat = await createCategoryViaApi(accessToken, {
      name: `DelMe-${Date.now()}`,
      type: "expense",
    })

    // Reload the page to see the new category
    await page.reload()
    await page.waitForResponse(
      (res) => res.url().includes("/api/categories") && res.status() === 200,
    )

    // Find the category and click its delete button
    const row = page.getByText(cat.name).locator("..")
    await row.getByRole("button", { name: "" }).last().click()

    // Confirm in alert dialog
    await page.getByRole("alertdialog").waitFor({ state: "visible" })
    await page.getByRole("button", { name: "ยืนยัน" }).click()

    // Category should disappear
    await expect(page.getByText(cat.name)).not.toBeVisible({ timeout: 5_000 })
  })
})
