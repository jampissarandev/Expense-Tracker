# E2E Testing — Playwright CLI + Playwright MCP

## Two tools, two purposes

| Tool | Runner | When | Where |
|------|--------|------|-------|
| **Playwright CLI** (`@playwright/test`) | Automated, headless | CI gate, regression suite, nightly | `.github/workflows/ci.yml` (`e2e-ci` job) |
| **Playwright MCP** (`@playwright/mcp`) | Interactive, headed | Dev, manual QA, AI-assisted debugging | VS Code Copilot Chat (MCP panel) |

### Playwright CLI (automated tests)

Run the full E2E suite:

```bash
cd frontend
npx playwright test              # headless
npx playwright test --ui         # interactive UI mode
npx playwright show-report       # open HTML report
```

Spec files live in `tests/e2e/`:
- `auth.spec.ts` — register, login, logout, unauthenticated redirect
- `categories.spec.ts` — system read-only, custom CRUD
- `transactions.spec.ts` — create, filter, paginate, delete
- `dashboard.spec.ts` — KPI cards, charts render
- `export.spec.ts` — CSV download, BOM + Thai characters
- `mobile-tabbar.spec.ts` — Phase E: bottom tab bar visibility on mobile vs
  desktop, `+` button navigation to `/transactions`, tab link routing.

CI runs these with `--reporter=html,github` and uploads artifacts.

> **Note on rate limiting:** when running the full e2e suite locally against a
> dev backend, set `E2E_TESTS=true` on the backend so the `AuthRateLimit`
> limiter (5 req/min on `/api/auth/*`) is disabled — otherwise the per-spec
> `registerViaApi` calls return `429`. See
> `backend/src/ExpenseTracker.Api/Program.cs`.
>
> ```bash
> E2E_TESTS=true dotnet run --project backend/src/ExpenseTracker.Api
> ```

### Playwright MCP (interactive browser control)

The Playwright MCP server is configured in `.vscode/mcp.json` and is reachable
from VS Code Copilot Chat via the MCP panel. It launches a real Chromium browser
and lets you interact with the page through structured accessibility snapshots —
no screenshots or vision models needed.

**Prerequisites (one-time setup):**
- Node.js ≥ 22 (matches `frontend/package.json` `engines.node`)
- Chromium browser binary for Playwright:
  ```bash
  cd frontend
  npx playwright install chromium
  ```
- VS Code with Copilot Chat extension

**Prerequisites (per session — backend + frontend must be running):**
- Backend API on `http://localhost:5117`
- Frontend dev server on `http://localhost:5173`

**Start the stack in two terminals:**

```bash
# Terminal 1 — backend (WSL2)
wsl -d Ubuntu -- bash -c "export DOTNET_ROOT=/home/jusaku/dotnet; export PATH=/home/jusaku/dotnet:\$PATH; export ASPNETCORE_URLS=http://0.0.0.0:5117; export ASPNETCORE_ENVIRONMENT=Development; nohup /home/jusaku/dotnet/dotnet run --project /mnt/d/JamProject/ExpenseTracker/backend/src/ExpenseTracker.Api --no-build -c Release > /tmp/api.log 2>&1 < /dev/null & disown"

# Terminal 2 — frontend (PowerShell)
cd frontend
npm run dev
```

Wait for both ports to be reachable (`curl http://localhost:5117/health` and `http://localhost:5173` in a browser) before invoking MCP recipes.

**How to use:**
1. Open VS Code Copilot Chat
2. The `playwright` MCP server should appear in the MCP panel (auto-launched)
3. Ask the agent to navigate, interact, inspect, etc.

**MCP flags (configured in `.vscode/mcp.json`):**
- `@playwright/mcp@0.0.76` — pinned (bump via `npm view @playwright/mcp version` then update both `mcp.json` and this README)
- `--isolated` — temp profile, wiped on close. Safe for testing; no leakage into personal browser state.
- `--viewport-size=1280x800` — matches typical desktop breakpoint for the app layout.
- `--caps=devtools` — enables DevTools panel access (network, console, performance).
- `--console-level=warn` — surfaces warnings + errors so deprecations and perf hints are visible during dev.

---

## When to use MCP vs CLI

| Use case | Tool | Why |
|----------|------|-----|
| CI regression gate | CLI | Deterministic, parallel, headless, artifact upload |
| Reproduce a reported bug | MCP | Interactive, step-by-step, real DOM inspection |
| Verify visual layout / styling | MCP | Accessibility tree + optional screenshots |
| Debug a failing E2E test | MCP | Same browser engine, interactive REPL |
| Quick smoke after a code change | MCP | No test-file overhead, one-shot |
| Accessibility audit | MCP | Accessibility tree is built-in |
| Network/API debugging | MCP | Network monitor via `--caps=devtools` |
| Exploratory testing | MCP | No spec needed, click through freely |

**Do NOT use MCP for:** routine test runs (use CLI), performance benchmarking (use Lighthouse), or backend-only changes.

---

## MCP Recipes

These are ready-to-paste prompts for Copilot Chat with the Playwright MCP server active.

### Recipe 1: Register → Create Category → Add Transaction

```
Open http://localhost:5173/register, fill in display name "MCP Test User",
email "mcp-test-{timestamp}@test.local", password "TestPass123!", and click
the register button. After redirect to dashboard, navigate to /categories,
click "เพิ่มหมวดหมู่", create a category named "MCP Coffee" of type "expense"
with color "#8B4513". Then go to /transactions, click "เพิ่มรายการ", and create
an expense of 150.00 THB in the "MCP Coffee" category dated today with note
"MCP recipe test". Verify the transaction appears in the list.
```

### Recipe 2: Dashboard Visual Check

```
Navigate to http://localhost:5173/. Take a screenshot. Check the DOM for the
three KPI cards (รายรับ, รายจ่าย, คงเหลือ) and verify they contain numeric
values. Check that the Recharts SVG elements exist for the line chart and
category bar chart. Report what you see.
```

### Recipe 3: Login Flow + Error Handling

```
Navigate to http://localhost:5173/login. Try logging in with email
"nonexistent@test.local" and password "WrongPass123!". Verify the page stays
on /login and an error toast appears. Then try logging in with a registered
user and verify redirect to dashboard.
```

### Recipe 4: Responsive Layout Check

```
Set the viewport to 375x667 (iPhone SE). Navigate to http://localhost:5173/.
Check if the sidebar collapses into a hamburger menu (sheet). Click the
hamburger and verify the navigation links (Dashboard, Transactions, Categories)
are visible. Resize back to 1280x800 and verify the sidebar is fully visible.
```

### Recipe 5: Export CSV Verification

```
Navigate to http://localhost:5173/transactions. Click the export dropdown and
select "Export Transactions (CSV)". Verify a file download is triggered. Then
go to the dashboard, click the export dropdown, and select "Export Summary (CSV)".
Confirm both downloads complete without errors.
```

### Recipe 6: Accessibility Quick Audit

```
Navigate to http://localhost:5173/login. Read the accessibility tree. Check that:
1. All form inputs have associated labels
2. The login button has an accessible name
3. The page has a proper heading hierarchy
4. Focus order is logical (tab through the form)
Report any issues found.
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP server not appearing in VS Code | Check `.vscode/mcp.json` exists at workspace root. Reload VS Code window. |
| Browser doesn't open | Run `npx playwright install chromium` in `frontend/` to install browser binaries. |
| Backend connection refused | Ensure API is running on `http://localhost:5117`. |
| Frontend not loading | Run `npm run dev` in `frontend/` or let Playwright's `webServer` start it. |
| `@playwright/mcp` not found | `npx` auto-downloads; if behind a proxy, set `HTTP_PROXY` env var. |
