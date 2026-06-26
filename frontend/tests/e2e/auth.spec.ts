import { test, expect } from "@playwright/test"
import {
  uniqueEmail,
  TEST_PASSWORD,
  registerViaApi,
  seedAuthCookie,
} from "./helpers"

test.describe("Auth flow", () => {
  test("register → redirect to dashboard", async ({ page }) => {
    const email = uniqueEmail("reg")
    await page.goto("/register")

    await page.getByLabel("ชื่อที่แสดง (Display Name)").fill("E2E User")
    await page.getByLabel("อีเมล (Email)").fill(email)
    await page.getByLabel("รหัสผ่าน (Password)").fill(TEST_PASSWORD)
    await page.getByRole("button", { name: "สมัครสมาชิก" }).click()

    // Should redirect to dashboard after success toast + setTimeout
    await page.waitForURL(`${page.url().split("/register")[0]}/`, {
      timeout: 15_000,
    })
  })

  test("login → redirect to dashboard", async ({ page }) => {
    const email = uniqueEmail("login")
    await registerViaApi(email, TEST_PASSWORD, "Login Test User")

    await page.goto("/login")
    await page.getByLabel("อีเมล (Email)").fill(email)
    await page.getByLabel("รหัสผ่าน (Password)").fill(TEST_PASSWORD)
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()

    await page.waitForURL(`${page.url().split("/login")[0]}/`, {
      timeout: 15_000,
    })
  })

  test("wrong password → stays on login", async ({ page }) => {
    const email = uniqueEmail("wrong")
    await registerViaApi(email, TEST_PASSWORD, "Wrong PW User")

    await page.goto("/login")
    await page.getByLabel("อีเมล (Email)").fill(email)
    await page.getByLabel("รหัสผ่าน (Password)").fill("WrongPassword999!")
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()

    // Should stay on /login and show an error toast
    await expect(page).toHaveURL(/\/login/)
    // sonner toast with error class appears
    await expect(page.locator("[data-sonner-toast]")).toBeVisible({
      timeout: 8_000,
    })
  })

  test("logout → redirect to login", async ({ page }) => {
    const email = uniqueEmail("logout")
    await registerViaApi(email, TEST_PASSWORD, "Logout Test User")
    await seedAuthCookie(page, email, TEST_PASSWORD)

    // Open user menu and click logout
    await page.getByRole("button", { name: "เปิดเมนูผู้ใช้" }).click()
    await page.getByRole("menuitem", { name: /ออกจากระบบ/ }).click()

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })

  test("unauthenticated → redirect to login", async ({ page }) => {
    await page.goto("/")
    await page.waitForURL(/\/login/, { timeout: 10_000 })
  })
})
