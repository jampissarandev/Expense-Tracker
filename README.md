# Expense Tracker

A multi-user **expense & income tracker** with a clean ASP.NET Core 10 backend and a React + Vite + shadcn/ui frontend. Designed for personal finance tracking with **THB** currency, Thai-friendly UI, system + custom categories, transaction CRUD, dashboard with charts, and CSV export.

> 📘 **Full plan & architecture** → [docs/PLAN.md](docs/PLAN.md)
>
> 📐 **Project standards** → [.github/copilot-instructions.md](.github/copilot-instructions.md)

---

## ✨ Features

- **Multi-user** with email + password login
- **Refresh-token JWT** in `HttpOnly` + `SameSite=Strict` cookies (15-min access token in memory, 7-day rotated refresh token)
- **Transactions** with amount (decimal precision), date, category, note, type (income/expense)
- **Categories** — seeded system categories (read-only) + per-user custom categories
- **Dashboard** — current-month KPIs, 6-month trend line chart, top-10 by-category bar chart
- **CSV export** (Phase 2) — transactions and monthly summary, with filters
- **RFC 7807** error responses; **ProblemDetails** middleware
- **CSV injection** guard (cells starting with `=`, `+`, `-`, `@` are prefixed with `'`)
- **E2E tests** via Playwright CLI (CI) + Playwright-MCP (browser-driven dev/QA)

---

## 🧰 Tech Stack

| Layer | Tech |
|---|---|
| Backend | .NET 10 (latest), ASP.NET Core, EF Core 10, Npgsql, FluentValidation, Serilog, BCrypt, CsvHelper |
| Frontend | React 19, Vite, TypeScript, shadcn/ui, Tailwind CSS, Recharts, React Query, React Hook Form + Zod, axios |
| Database | PostgreSQL 16 (Docker Compose locally; Testcontainers in CI) |
| Testing | xUnit + FluentAssertions (BE), Vitest + RTL + MSW (FE), Playwright (E2E) |

---

## 📋 Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **.NET SDK** | **10.0.x** (latest feature band) | `rollForward: latestFeature` in `backend/global.json` — installs the newest 10.0.x automatically |
| **Node.js** | **22 LTS** (≥ 22.0.0, < 23) | `frontend/.nvmrc` and `frontend/.node-version` pin this. `nvm use`, `fnm use`, `nvs`, or `asdf` auto-switch on `cd frontend/` |
| **Docker** | Engine 24+ with Compose v2 | Required for the local Postgres |
| **Git** | latest | — |

> 💡 The frontend declares `"engines": { "node": ">=22.0.0 <23" }` in `package.json` — a Node 23+ install will fail `npm ci`.

### Windows + WSL2 networking note

If your host is **Windows 11 with WSL2** (and Postgres is running **inside WSL2** via Docker or systemd), `localhost:5432` from a Windows process will not reach WSL2's Postgres by default. WSL2's eth0 IP is NAT'd and unreachable from Windows user-mode processes.

The API and the integration tests in `tests/ExpenseTracker.IntegrationTests/` already work end-to-end (the test host spins up Postgres via Testcontainers, which routes through the same Windows loopback as the API). But for a **manual** `dotnet run` of the API on Windows, you need a portproxy:

```powershell
# Run PowerShell as Administrator
make db-wsl-ip          # prints the current WSL IP
make db-portproxy       # forwards localhost:5432 -> WSL:5432
make db-portproxy-remove
```

Under the hood: `netsh interface portproxy add v4tov4 listenport=5432 listenaddress=0.0.0.0 connectport=5432 connectaddress=<WSL_IP>`. See `scripts/db-portproxy.ps1` for the script.

On macOS, Linux, or when the API runs **inside** WSL2, this is unnecessary — `localhost:5432` works directly.

---

## 🚀 Quickstart

```bash
# 1. Clone the repository
git clone <repo-url> ExpenseTracker
cd ExpenseTracker

# 2. Start Postgres (detached, with healthcheck)
make db-up

# 3. One-time: populate per-developer user-secrets (Jwt:SecretKey + connection string).
#    Secrets are stored OUTSIDE the repo, never in tracked files.
make dev-secrets

# 4. Backend: install tools, apply migrations, run
cd backend
dotnet tool restore
dotnet ef database update --project src/ExpenseTracker.Infrastructure --startup-project src/ExpenseTracker.Api
dotnet run --project src/ExpenseTracker.Api
# → API at http://localhost:5000  ·  Swagger at http://localhost:5000/swagger

# 5. Frontend: install deps, run dev server (in a new terminal)
cd ../frontend
nvm use             # auto-switches to Node 22 LTS
npm ci
npm run dev
# → App at http://localhost:5173
```

Then open **<http://localhost:5173>**, register an account, and start logging transactions.

---

## 🧪 Verification

Run the full suite locally before opening a PR:

```bash
# Backend
cd backend
dotnet format --verify-no-changes
dotnet build -c Release
dotnet test

# Frontend
cd ../frontend
npm run lint
npm run typecheck
npm test
npm run build
```

| Gate | Command | When |
|---|---|---|
| Format | `dotnet format --verify-no-changes` | Before commit |
| Lint | `npm run lint` | Before commit |
| Typecheck | `dotnet build` / `npm run typecheck` | Before commit |
| Unit | `dotnet test` (BE) / `npm test` (FE) | Before commit |
| Build | `dotnet build -c Release` / `npm run build` | Before commit |
| E2E | `npx playwright test` (FE) | Phase 5; CI job `e2e-ci` |

---

## 🗂️ Project Structure

```
ExpenseTracker/
├── backend/                  # ASP.NET Core 10 Web API (Clean Architecture)
│   ├── ExpenseTracker.sln
│   ├── global.json           # .NET SDK pin (rollForward: latestFeature)
│   ├── Directory.Build.props # Nullable, warnings-as-errors
│   ├── .editorconfig
│   ├── src/
│   │   ├── ExpenseTracker.Domain/         # Entities, enums, exceptions
│   │   ├── ExpenseTracker.Application/    # Services, DTOs, validators
│   │   ├── ExpenseTracker.Infrastructure/ # DbContext, EF migrations, JWT
│   │   └── ExpenseTracker.Api/            # Controllers, middleware, Program.cs
│   └── tests/
│       ├── ExpenseTracker.UnitTests/         # xUnit + FluentAssertions
│       └── ExpenseTracker.IntegrationTests/  # WebApplicationFactory + Testcontainers
│
├── frontend/                 # React 19 + Vite + TypeScript
│   ├── package.json          # engines: node >=22.0.0 <23
│   ├── .nvmrc                # 22
│   ├── .node-version         # 22.11.0
│   ├── .editorconfig
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/           # React Router v6/v7
│   │   ├── pages/            # Login, Register, Dashboard, Transactions, Categories
│   │   ├── features/         # auth, transactions, categories, dashboard
│   │   ├── components/       # shadcn/ui + layout
│   │   ├── lib/              # apiClient, format, utils
│   │   ├── hooks/
│   │   └── types/
│   └── tests/
│       ├── unit/             # Vitest + RTL + MSW
│       └── e2e/              # Playwright (CLI in CI, MCP for dev/QA)
│
├── docker/
│   └── postgres.yml          # Postgres 16 + healthcheck
│
├── .github/
│   ├── workflows/            # ci.yml (lint, typecheck, test, build, e2e)
│   ├── agents/               # Custom Copilot agents
│   ├── skills/               # Domain skills
│   └── copilot-instructions.md
│
├── docs/
│   ├── PLAN.md               # Living implementation plan
│   ├── SPEC.md               # Product spec (Phase 4)
│   ├── api-contract.md       # OpenAPI / endpoint reference
│   └── adr/                  # Architecture Decision Records
│
├── Makefile                  # db-up, db-down, db-reset
├── .gitignore
├── LICENSE
└── README.md                 # ← you are here
```

---

## 🔑 Environment Variables

The backend reads configuration from `appsettings*.json` + environment variables (12-factor). For local dev, the defaults work against the Docker Compose Postgres.

| Variable | Default (dev) | Purpose |
|---|---|---|
| `ConnectionStrings__DefaultConnection` | `Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense` | Postgres connection string |
| `Jwt__Issuer` | `ExpenseTracker` | JWT issuer |
| `Jwt__Audience` | `ExpenseTracker.Client` | JWT audience |
| `Jwt__SigningKey` | _(must be set in production)_ | 32+ byte signing key |

> **Never commit secrets.** See `.gitignore` — `.env`, `*.pem`, `*.key` are excluded.

For the frontend, set `VITE_API_URL=http://localhost:5000/api` in a local `frontend/.env.local` (gitignored) if you need to override the default.

---

## 🛠️ Common Tasks

```bash
# Database
make db-up       # docker compose -f docker/postgres.yml up -d
make db-down     # docker compose -f docker/postgres.yml down
make db-reset    # down -v && up -d (drops volume — destroys data)

# Backend — format, build, test
cd backend
dotnet format
dotnet build -c Release
dotnet test
dotnet ef migrations add <Name> \
  --project src/ExpenseTracker.Infrastructure \
  --startup-project src/ExpenseTracker.Api
dotnet ef database update \
  --project src/ExpenseTracker.Infrastructure \
  --startup-project src/ExpenseTracker.Api

# Frontend — lint, typecheck, test, build
cd frontend
nvm use
npm ci
npm run lint
npm run typecheck
npm test
npm run build

# E2E (Phase 5)
npx playwright install --with-deps chromium
npx playwright test
```

---

## 🤝 Contributing

1. **TDD**: write the failing test first, then implement ([.github/copilot-instructions.md](.github/copilot-instructions.md)).
2. **Small increments**: implement → test → verify → commit.
3. **Never mix formatting with behavior changes** — `dotnet format` / `prettier` runs separately.
4. **No secrets in version control** — see `.gitignore`.
5. All five CI gates must pass: `lint`, `typecheck`, `test`, `build`, `format --verify-no-changes`.

See [docs/PLAN.md](docs/PLAN.md) for the full phased breakdown (Phase 0 → Phase 5).

---

## 🔒 Security

### Reporting vulnerabilities

Please email security issues to the maintainers (do **not** open a public GitHub issue) so we can patch and disclose responsibly.

### Dependency audit (R15 / Phase E1)

NuGet and npm packages are scanned for known CVEs both in CI and locally. Any finding at severity **High** or **Critical** fails the build.

**CI** — `.github/workflows/security-audit.yml` runs:

- On every push to `main`
- On every PR that touches a dependency manifest (`*.csproj`, `*.props`, `frontend/package.json`, `frontend/package-lock.json`)
- Weekly on Monday 06:00 UTC (background sweep)

**Local** — equivalent commands in the Makefile:

```bash
make audit             # audit both backend (NuGet) and frontend (npm)
make audit-backend     # backend only — `dotnet list package --vulnerable --include-transitive`
make audit-frontend    # frontend only — `npm audit --omit=dev --audit-level=high`
```

Run `make audit` before opening a PR that touches a dependency manifest. The CI workflow will catch the same issues, but catching them locally saves a round trip.

### Other hardening

- Production-mode builds apply security headers (CSP, HSTS, `X-Frame-Options`, etc.) — see [docs/plans/security-hardening.md §A1](docs/plans/security-hardening.md).
- Dev JWT secret is loaded from per-user `dotnet user-secrets`, never from tracked `appsettings.Development.json` — see [R5](docs/plans/security-hardening.md).
- Full audit + remediation plan: [docs/plans/security-hardening.md](docs/plans/security-hardening.md).

---

## 📜 License

See [LICENSE](LICENSE).
