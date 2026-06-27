# Lighthouse — local run

This directory contains the tooling to audit the dashboard against
[Phase 2 Success Criteria](../docs/PLAN.md) (`Lighthouse > 90 on dashboard`).

## What is here

| File | Purpose |
|---|---|
| `lighthouserc.cjs` (parent) | lhci config — desktop preset, score ≥ 0.9 on all 4 categories |
| `login-and-collect.cjs` | Puppeteer script: log in as the seeded user, wait for dashboard |
| `debug-login.cjs` | Manual Puppeteer trace (console + network logs) for diagnosing login issues |
| `check-api-url.ps1` | Verifies the production build bakes in `VITE_API_URL` |
| `start-frontend.ps1` | Starts the Vite dev server in the background (used during initial setup) |
| `start-frontend.sh` | WSL wrapper for the same (no longer needed; production build + sirv is preferred) |

## How to run

The simplest way is via the npm script — it runs the whole `collect → assert → upload` pipeline:

```bash
npm run lighthouse
```

Under the hood this requires:

1. **Postgres** running and migrated (the dashboard calls `/api/dashboard/summary`).
2. **Backend API** running on `http://localhost:5117` (any way you prefer).
3. **Seeded user** — `python scripts/lh-seed.py` writes `lh-user.txt` with
   email/password/token/userId. The puppeteer script reads it on each run.
4. **Production build** — `npm run build` produces `dist/`. lhci is configured
   to audit `http://localhost:4173/` (the Vite preview / sirv port), not the
   dev server (which is unminified and won't pass the performance audit).

The full bring-up sequence is:

```bash
# 1. DB + API
docker compose -f docker/postgres.yml up -d
# Apply migrations (one-time)
cd backend && dotnet-ef database update --project src/ExpenseTracker.Infrastructure --startup-project src/ExpenseTracker.Api && cd ..

# 2. Seed the lighthouse user
python scripts/lh-seed.py

# 3. Build + serve + audit
cd frontend
npm run build
npx sirv dist --port 4173 --host 127.0.0.1 --single &
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run lighthouse
```

## What gets audited

- **Performance** — desktop preset, no throttling (we want the *raw* score
  of the production build, not a 4G simulation).
- **Accessibility** — checks contrast, ARIA, alt text, form labels, etc.
- **Best Practices** — console errors, deprecated APIs, image aspect ratios.
- **SEO** — meta description, robots.txt, viewport, lang attribute.

## When a category fails

Open the latest HTML report (path is printed at the end of the run; the
`.lighthouseci/lhr-*.html` files are also uploaded to a public URL). The
report lists every audit with a red/yellow/green dot. Common fixes:

- **Performance < 90** — usually means a new chunk is too large. Check the
  `unused-javascript` and `uses-text-compression` audits. The build is
  already configured with vendor `manualChunks` (recharts, react, radix, …)
  and `vite-plugin-compression` (gzip). The static server (`sirv`) must
  serve `.gz` files in production.
- **SEO < 90** — usually means the page has no `<meta name="description">`
  or `robots.txt` is blocking indexing. The defaults are already correct in
  `index.html`; if a new page is added, mirror them.
- **Accessibility < 90** — almost always a missing form label or low contrast
  text. `LoginPage.tsx` and other shadcn-based forms already wire labels
  through `FormLabel`; if a new form is added, follow the same pattern.

## CI

The `e2e-ci` GitHub Actions job already starts the backend with a fresh DB;
to add Lighthouse as a separate job, mirror the steps above inside
`.github/workflows/ci.yml`. `@lhci/cli` is already in `devDependencies`.
