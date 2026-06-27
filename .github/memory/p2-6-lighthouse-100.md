# Phase 2 — Lighthouse > 90 ✅ (2026-06-27)

## Result

Dashboard at `http://localhost:4173/` (production build + sirv, after login):

| Category | Score | Δ from baseline (87/96/100/82) |
|---|---|---|
| Performance | **100** | +13 |
| Accessibility | **96** | 0 |
| Best Practices | **100** | 0 |
| SEO | **100** | +18 |

Deterministic across re-runs. Baseline 2026-06-27 (vite dev audit), final 2026-06-27 (dist + sirv audit).

## Key metrics (final)

- FCP: 0.1 s
- LCP: 0.4 s
- TBT: 80 ms
- CLS: 0.006
- Speed Index: 0.4 s

## What it took to get there

1. **Installed `@lhci/cli`** (latest). `lighthouserc.cjs` with desktop preset
   and `assert minScore: 0.9` on all 4 categories.
2. **Fixed SEO** — `index.html` was missing `<meta name="description">` (score
   0) and a `robots.txt` with `Disallow: /` blocked indexing (also score 0).
   Removed `robots.txt`, added Thai description + `lang="th"` + `theme-color`.
3. **Fixed Performance** — vite dev server is unminified and un-compressed.
   Switched to auditing the **production build**:
   - `vite build` with `rollupOptions.output.manualChunks` splitting
     Recharts (225 kB), React (216 kB), Radix (149 kB), Forms (107 kB),
     Dates (~misc), and main (75 kB) into separate vendor chunks.
   - `vite-plugin-compression` pre-generates `.gz` siblings at build time.
   - Serve `dist/` with `sirv --port 4173 --host 127.0.0.1 --single` (SPA
     fallback built in). Rejected `http-server` because it doesn't serve
     `.gz` with `--gzip` and doesn't have a `--spa` flag in v14.
4. **Fixed CORS** — `Program.cs` `AddCors` originally only allowed
   `http://localhost:5173`. Added `http://localhost:4173` (Vite preview /
   sirv). Without this, the Puppeteer login script logged in via the form
   but the page never mounted the dashboard because `/api/auth/refresh`
   was blocked with `No 'Access-Control-Allow-Origin' header`.
5. **Puppeteer script** — `scripts/lighthouse/login-and-collect.cjs` reads
   `lh-user.txt` (produced by `scripts/lh-seed.py`), navigates to
   `/login`, fills the form, clicks submit, then waits up to 45 s for the
   dashboard's "รายรับ" / "รายจ่าย" KPI labels to appear. We do NOT use
   `waitForNavigation` because `LoginPage.tsx` does
   `setTimeout(() => navigate("/"), 1500)` after a successful login, which
   races the navigation watcher and times out at 15 s.

## Files added/changed

- `frontend/package.json` — added `@lhci/cli`, `http-server`, `sirv-cli`,
  `vite-plugin-compression` to devDependencies; added `lighthouse` and
  `lighthouse:collect` scripts.
- `frontend/vite.config.ts` — added `compression()` plugin (gzip + brotli)
  and `manualChunks` for vendor split.
- `frontend/index.html` — added Thai `meta description`, `lang="th"`,
  `theme-color`, descriptive title.
- `frontend/lighthouserc.cjs` — new, lhci config.
- `frontend/public/robots.txt` — added then removed (was blocking SEO).
- `frontend/scripts/lighthouse/login-and-collect.cjs` — new, Puppeteer
  login script.
- `frontend/scripts/lighthouse/debug-login.cjs` — new, manual Puppeteer
  trace for diagnosing login.
- `frontend/scripts/lighthouse/check-api-url.ps1` — new, verifies
  `VITE_API_URL` is baked into the build.
- `frontend/scripts/lighthouse/README.md` — new, bring-up docs.
- `backend/src/ExpenseTracker.Api/Program.cs` — added port 4173 to CORS.
- `scripts/lh-seed.py` — new, seeds a dedicated LH user.
- `scripts/start-api-lighthouse.sh`, `scripts/wait-api-lighthouse.sh`,
  `scripts/reup-pg.sh`, `scripts/install-ef.sh` — new WSL helpers for
  bringing up the local stack.
- `docs/PLAN.md` — Phase 2 success criteria all checked.

## Bring-up sequence (works on this Windows + WSL host)

```bash
# 1. DB
wsl -d Ubuntu -- bash /mnt/d/JamProject/ExpenseTracker/scripts/reup-pg.sh

# 2. API
wsl -d Ubuntu -- bash /mnt/d/JamProject/ExpenseTracker/scripts/start-api-lighthouse.sh
wsl -d Ubuntu -- bash /mnt/d/JamProject/ExpenseTracker/scripts/wait-api-lighthouse.sh

# 3. Seed user
cd d:\JamProject\ExpenseTracker
$env:SMOKE_RUN_SUFFIX = "lh$(Get-Date -Format 'MMddHHmmss')"
python scripts/lh-seed.py

# 4. Build + serve + audit
cd frontend
npm run build
npx sirv dist --port 4173 --host 127.0.0.1 --single &
$env:CHROME_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run lighthouse
```

## Follow-ups

- **CI** — add an `lhci-ci` job to `.github/workflows/ci.yml` mirroring the
  Playwright job's structure (start backend with seeded data, build, serve
  with sirv, run lhci). Out of scope for this checkpoint.
- **Re-audit on PR** — lhci supports `upload.target: 'temporary-public-storage'`
  for trend tracking, but it requires a GitHub token to set the PR status.
  Defer until CI job is added.
- **Production CSP** — for a real deployment, add a Content-Security-Policy
  header to lock down the Lighthouse-approved origin list.
