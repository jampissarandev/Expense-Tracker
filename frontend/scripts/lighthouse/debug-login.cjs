/* Manual debug script: opens browser, tries to log in, dumps state. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const APP = "http://localhost:4173";
const CRED = fs.readFileSync(path.resolve(__dirname, "..", "..", "..", "lh-user.txt"), "utf-8").trim().split("\n");
const [email, password] = CRED;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on("console", (msg) => console.log("[browser]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  page.on("requestfailed", (req) => console.log("[reqfail]", req.url(), req.failure()?.errorText));
  page.on("response", (res) => {
    if (!res.url().includes("localhost:51") && !res.url().includes("localhost:41")) return;
    console.log("[resp]", res.status(), res.url());
  });

  console.log("Goto /login");
  await page.goto(`${APP}/login`, { waitUntil: "networkidle0" });
  console.log("URL after goto:", page.url());

  console.log("Filling form");
  await page.type('input[name="email"]', email);
  await page.type('input[name="password"]', password);

  console.log("Click submit");
  await page.click('button[type="submit"]');

  // Wait and inspect periodically
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const state = await page.evaluate(() => ({
      url: location.href,
      bodyLen: document.body.innerText.length,
      hasKPI: document.body.innerText.includes("รายรับ"),
      hasError: document.body.innerText.includes("error") || document.body.innerText.includes("ผิดพลาด"),
      title: document.title,
      visibleText: document.body.innerText.slice(0, 200),
    }));
    console.log(`T+${(i+1)*2}s`, JSON.stringify(state));
  }

  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
