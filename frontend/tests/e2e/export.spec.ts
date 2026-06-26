import { test, expect } from "@playwright/test"
import { readFile } from "fs/promises"
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
  userEmail = uniqueEmail("exp")
  const result = await registerViaApi(
    userEmail,
    TEST_PASSWORD,
    "Export Tester",
  )
  const accessToken = result.accessToken

  const cat = await createCategoryViaApi(accessToken, {
    name: `Export Cat-${Date.now()}`,
    type: "expense",
  })
  await createTransactionViaApi(accessToken, {
    categoryId: cat.id,
    type: "expense",
    amount: "999.99",
    occurredOn: "2026-06-25",
    note: "export test data",
  })
})

test.describe("CSV export", () => {
  test.beforeEach(async ({ page }) => {
    await seedAuthCookie(page, userEmail, TEST_PASSWORD)
  })

  test("downloads transactions CSV via UI", async ({ page }) => {
    await page.goto("/transactions")
    await page.waitForResponse(
      (res) =>
        res.url().includes("/api/transactions") && res.status() === 200,
    )

    // Click the export button
    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "ส่งออก" }).click()
    await page.getByRole("menuitem", { name: "ส่งออกรายการ (CSV)" }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/transactions.*\.csv/i)

    // Read the downloaded file and verify BOM + Thai headers
    const path = await download.path()
    if (path) {
      const content = await readFile(path, "utf-8")
      // UTF-8 BOM is \ufeff
      expect(content.charCodeAt(0)).toBe(0xfeff)
      expect(content).toContain("วันที่")
      expect(content).toContain("หมวดหมู่")
    }
  })

  test("downloads summary CSV via UI", async ({ page }) => {
    await page.goto("/")

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "ส่งออก" }).click()
    await page.getByRole("menuitem", { name: "ส่งออกรายงานสรุป (CSV)" }).click()

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/summary.*\.csv/i)

    const path = await download.path()
    if (path) {
      const content = await readFile(path, "utf-8")
      expect(content.charCodeAt(0)).toBe(0xfeff)
      expect(content).toContain("เดือน")
      expect(content).toContain("รายรับ")
    }
  })
})
