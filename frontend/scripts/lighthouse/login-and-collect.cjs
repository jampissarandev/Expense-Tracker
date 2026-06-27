/**
 * Puppeteer script run by lhci before each Lighthouse audit.
 *
 * Reads the seeded user credentials from lh-user.txt (produced by
 * scripts/lh-seed.py), navigates to /login, fills the form, submits, and
 * waits for the dashboard to render. The page is then handed to Lighthouse
 * for the actual audit.
 *
 * Why no `waitForNavigation` after submit: LoginPage uses
 *   setTimeout(() => navigate("/"), 1500)
 * after the API call resolves. `waitForNavigation` races that setTimeout
 * and times out at 15s. Instead we wait for the dashboard's "รายรับ" /
 * "รายจ่าย" KPI labels to appear, which is the only signal that the SPA
 * has actually mounted the dashboard route.
 */
const fs = require("fs");
const path = require("path");

const CRED_FILE = path.resolve(__dirname, "..", "..", "..", "lh-user.txt");
const APP_URL = "http://localhost:4173";

module.exports = async (browser) => {
  if (!fs.existsSync(CRED_FILE)) {
    throw new Error(
      `lh-user.txt not found at ${CRED_FILE}. Run scripts/lh-seed.py first.`,
    );
  }
  const [email, password] = fs.readFileSync(CRED_FILE, "utf-8")
    .trim()
    .split("\n");

  const page = await browser.newPage();
  // Match lighthouserc.cjs screenEmulation
  await page.setViewport({ width: 1280, height: 800 });

  // Navigate to login
  await page.goto(`${APP_URL}/login`, { waitUntil: "networkidle0" });

  // Fill the form (label-based selectors — the form uses shadcn <Label> + <Input>)
  await page.waitForSelector('input[name="email"]', { timeout: 15000 });
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);

  // Click submit. LoginPage calls login() → toast.success → setTimeout(navigate, 1500).
  await page.click('button[type="submit"]');

  // Wait for the dashboard to render: KPI labels appear after the API call
  // for /api/dashboard/summary resolves. Allow up to 45s for first cold start.
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      return text.includes("รายรับ") && text.includes("รายจ่าย");
    },
    { timeout: 45000 },
  );

  // Close any toasts that may have appeared (sonner) so they don't get audited
  // and skew the accessibility / best-practices scores
  await page.evaluate(() => {
    document
      .querySelectorAll('[data-sonner-toast]')
      .forEach((el) => el.remove());
  });

  // Pause briefly so the Recharts SVGs finish animating in
  await new Promise((r) => setTimeout(r, 1000));
};
