import { test, expect } from "@playwright/test";
import {
  uniqueEmail,
  TEST_PASSWORD,
  registerViaApi,
  seedAuthCookie,
} from "./helpers";

let userEmail: string;

test.beforeAll(async () => {
  userEmail = uniqueEmail("mtab");
  await registerViaApi(userEmail, TEST_PASSWORD, "Mobile Tab Tester");
});

// Mobile viewport — bottom MobileTabBar is `lg:hidden`, so we must shrink the
// window below the `lg` breakpoint (1024px) for the bar to be visible.
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test.describe("MobileTabBar (mobile viewport)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await seedAuthCookie(page, userEmail, TEST_PASSWORD);
  });

  test("shows the bottom tab bar with a primary Add button", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/");

    const bottomnav = page.getByRole("navigation", {
      name: /เมนูนำทางด้านล่าง/i,
    });
    await expect(bottomnav).toBeVisible();
    await expect(
      bottomnav.getByRole("button", { name: /เพิ่มรายการใหม่/i }),
    ).toBeVisible();
  });

  test("tapping the Add button navigates to /transactions", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForURL("**/");

    await page
      .getByRole("button", { name: /เพิ่มรายการใหม่/i })
      .click();

    await page.waitForURL("**/transactions");
    await expect(page).toHaveURL(/\/transactions$/);
  });

  test("bottom tab bar links navigate between routes", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/");

    const bottomnav = page.getByRole("navigation", {
      name: /เมนูนำทางด้านล่าง/i,
    });

    // Navigate to categories
    await bottomnav.getByRole("link", { name: /หมวดหมู่/i }).click();
    await page.waitForURL("**/categories");
    await expect(page).toHaveURL(/\/categories$/);

    // Navigate back to overview
    await bottomnav.getByRole("link", { name: /ภาพรวม/i }).click();
    await page.waitForURL("**/");
    await expect(page).toHaveURL(/\/$/);
  });

  test("bottom tab bar is hidden on desktop viewport", async ({ page }) => {
    // Default Playwright Desktop Chrome viewport is 1280x720 — > lg (1024px)
    await page.goto("/");
    await page.waitForURL("**/");

    const bottomnav = page.getByRole("navigation", {
      name: /เมนูนำทางด้านล่าง/i,
    });
    await expect(bottomnav).toBeHidden();
  });
});