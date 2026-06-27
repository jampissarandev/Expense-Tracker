/* Lighthouse CI config — targets the Dashboard page after login.
 *
 * Why: the Dashboard is the first impression for a returning user (KPI cards,
 * 6-month trend line, top-10 by-category bar). PLAN.md Phase 2 success
 * criteria requires Lighthouse > 90 on the dashboard.
 *
 * Flow: lhci boots the dev server, navigates to /login, fills the form with
 * the seeded user (lh-user.txt from scripts/lh-seed.py), waits for the
 * dashboard route, then audits. Credentials are loaded from the env to keep
 * secrets out of source control.
 */
module.exports = {
  ci: {
    collect: {
      // Single URL — the dashboard after login. Lighthouse audits the fully
      // rendered page (KPI cards + 2 charts visible).
      url: [
        "http://localhost:4173/",
      ],
      numberOfRuns: 1,
      settings: {
        preset: "desktop",
        // Skip the throttling that desktop preset already applies — we want
        // local-host performance, not simulated slow 4G.
        throttlingMethod: "provided",
        onlyCategories: [
          "performance",
          "accessibility",
          "best-practices",
          "seo",
        ],
        // Use a viewport large enough for the 6-month line chart and the
        // top-10 category bar chart to render side by side.
        screenEmulation: {
          mobile: false,
          width: 1280,
          height: 800,
          deviceScaleFactor: 1,
          disabled: false,
        },
        // Use the locally-installed Google Chrome so lhci doesn't need to
        // download its own Chrome (faster + works behind firewalls).
        chromePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      },
      puppeteerScript: "./scripts/lighthouse/login-and-collect.cjs",
      puppeteerLaunchOptions: {
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
      },
    },
    assert: {
      assertions: {
        // Phase 2 success criterion
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
