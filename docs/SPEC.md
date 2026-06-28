# Expense Tracker — Living Specification

> Last updated: 2026-06-26
> This document captures the current state of the application as implemented.
> When behavior changes, update this file in the same PR.

---

## Objective

Expense Tracker is a **multi-user personal finance web application** that lets users log income and expenses, categorize them, visualize spending patterns on a dashboard, and export reports as CSV files. The application is Thai-language friendly, uses THB currency, and enforces strict per-user data isolation.

**Primary goals:**

1. Secure multi-user authentication with zero-trust data isolation
2. Fast, accurate transaction logging with decimal precision
3. Visual dashboard with 6-month trend and category breakdown
4. CSV export with proper Thai encoding and injection protection

---

## Tech Stack

### Backend

| Component | Technology | Version |
|---|---|---|
| Runtime | .NET | 10.0 |
| Web framework | ASP.NET Core | 10.0 |
| ORM | Entity Framework Core | 10.x |
| Database driver | Npgsql | 10.0 |
| Validation | FluentValidation | 12.1.x |
| Authentication | Microsoft.AspNetCore.Authentication.JwtBearer | 10.0 |
| Password hashing | BCrypt.Net-Next | 4.2.0 |
| Logging | Serilog.AspNetCore | 13.x |
| CSV generation | CsvHelper | 33.1.0 |
| Testing | xUnit + FluentAssertions | latest |

### Frontend

| Component | Technology | Version |
|---|---|---|
| UI library | React | 19.x |
| Build tool | Vite | latest |
| Language | TypeScript | latest |
| UI components | shadcn/ui + Tailwind CSS | latest |
| Charts | Recharts | latest |
| Server state | @tanstack/react-query | latest |
| HTTP client | axios | latest |
| Forms | react-hook-form + Zod | latest |
| Routing | React Router | latest |
| Testing | Vitest + React Testing Library + MSW | latest |

### Infrastructure

| Component | Technology |
|---|---|
| Database | PostgreSQL 16 |
| Local dev DB | Docker Compose |
| CI DB | Testcontainers.PostgreSql |
| E2E testing | Playwright (CLI in CI, MCP for dev/QA) |
| CI/CD | GitHub Actions |

---

## Commands

### Quick Start

```bash
# Start Postgres
make db-up

# One-time: populate per-developer user-secrets (Jwt:SecretKey + connection string).
# This stores secrets outside the repo (see appsettings.Development.README.md).
make dev-secrets

# Backend
cd backend
dotnet tool restore
dotnet ef database update \
  --project src/ExpenseTracker.Infrastructure \
  --startup-project src/ExpenseTracker.Api
dotnet run --project src/ExpenseTracker.Api

# Frontend (new terminal)
cd frontend
nvm use        # auto-switches to Node 22
npm ci
npm run dev
```

### Development

```bash
# Backend
dotnet build                            # Compile
dotnet test                             # Run all tests
dotnet format --verify-no-changes       # Check formatting
dotnet ef migrations add <Name> \
  --project src/ExpenseTracker.Infrastructure \
  --startup-project src/ExpenseTracker.Api  # New migration

# Frontend
npm run dev                             # Dev server (HMR)
npm run build                           # Production build
npm test                                # Unit tests (Vitest)
npm run lint                            # ESLint
npm run typecheck                       # TypeScript check
```

### Database Management

```bash
make db-up                              # Start Postgres
make db-down                            # Stop Postgres
make db-reset                           # Delete volume + recreate
make db-portproxy                       # Windows WSL2 workaround
```

---

## Project Structure

```
ExpenseTracker/
├── backend/
│   ├── ExpenseTracker.sln
│   ├── global.json                     # .NET SDK pin (rollForward: latestFeature)
│   ├── Directory.Build.props           # Nullable, warnings-as-errors
│   ├── .editorconfig
│   ├── src/
│   │   ├── ExpenseTracker.Domain/          # Entities, enums, exceptions (zero deps)
│   │   ├── ExpenseTracker.Application/     # Services, DTOs, validators, interfaces
│   │   ├── ExpenseTracker.Infrastructure/  # EF Core, JWT, BCrypt, repositories
│   │   └── ExpenseTracker.Api/             # Controllers, middleware, Program.cs
│   └── tests/
│       ├── ExpenseTracker.UnitTests/
│       └── ExpenseTracker.IntegrationTests/
│
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── routes/                    # React Router v6/v7
│   │   ├── pages/                     # Login, Register, Dashboard, Transactions, Categories
│   │   ├── features/                  # auth, transactions, categories, dashboard, exports
│   │   ├── components/                # shadcn/ui + layout
│   │   ├── lib/                       # apiClient, format, utils
│   │   ├── hooks/
│   │   └── types/
│   └── tests/
│       └── unit/                      # Vitest + RTL + MSW
│
├── docker/
│   └── postgres.yml
├── docs/
│   ├── PLAN.md
│   ├── SPEC.md                        # This file
│   ├── api-contract.md
│   └── adr/                           # Architecture Decision Records
├── Makefile
├── README.md
└── LICENSE
```

### Backend Layer Responsibilities

| Layer | Project | Contains | Does NOT contain |
|---|---|---|---|
| **Domain** | `ExpenseTracker.Domain` | Entities, enums, domain exceptions, business rules | No NuGet packages, no interfaces for infrastructure |
| **Application** | `ExpenseTracker.Application` | Service interfaces, repository interfaces, DTOs, validators, orchestration logic | No EF Core, no JWT, no HTTP |
| **Infrastructure** | `ExpenseTracker.Infrastructure` | DbContext, EF migrations, repository/service implementations, JWT, BCrypt | No controllers, no HTTP |
| **Api** | `ExpenseTracker.Api` | Controllers, middleware, DI wiring, Swagger | No business logic |

**Dependency rule**: Arrows point inward only. Application → Domain. Infrastructure → Application. Api → Application + Infrastructure.

---

## Code Style

### Backend (C# / .NET)

- **Nullable**: enabled globally (`Directory.Build.props`)
- **Warnings as errors**: enabled (`TreatWarningsAsErrors`)
- **Formatting**: `.editorconfig` + `dotnet format`
  - 4-space indentation for `.cs` files
  - UTF-8, LF line endings
  - Final newline required
- **Naming**:
  - PascalCase for classes, methods, properties, public fields
  - _camelCase for private fields (underscore prefix)
  - Interface names prefixed with `I` (e.g., `IAuthService`)
- **Async**: All I/O methods are `async`/`await` with `CancellationToken`
- **Entities**: Private parameterless constructors + public constructors with validation (no public setters)

### Frontend (TypeScript / React)

- **Formatting**: Prettier + Tailwind CSS plugin
- **Linting**: ESLint with `@typescript-eslint`, `react-hooks`, `jsx-a11y`
- **Components**: Functional components only, React hooks for state/side-effects
- **Forms**: react-hook-form + Zod schemas for validation
- **State**: @tanstack/react-query for server state; React state for UI state
- **CSS**: Tailwind CSS utility classes; shadcn/ui component library

### General Rules

- No secrets in code or version control
- Never mix formatting changes with behavior changes
- Run tests before commits
- Validate all user input (FluentValidation on backend, Zod on frontend)

---

## Testing Strategy

### Test Pyramid

```
        ╱╲
       ╱E2E╲           Playwright (Phase 5)
      ╱──────╲
     ╱Integration╲     WebApplicationFactory + Testcontainers
    ╱──────────────╲
   ╱    Unit Tests   ╲  xUnit (BE), Vitest + RTL (FE)
  ╱────────────────────╲
```

### Backend Tests

| Layer | Tool | Scope | Count |
|---|---|---|---|
| Unit | xUnit + FluentAssertions | Domain entities, Application services (mocked repos) | ~90 |
| Integration | xUnit + WebApplicationFactory + Testcontainers | Full HTTP pipeline against real Postgres | ~73 |

**Key patterns:**
- Unit tests mock repository interfaces (no database)
- Integration tests use `WebApplicationFactory<Program>` + `Testcontainers.PostgreSql`
- TDD: write failing test → implement → verify green
- Bug fix: write failing test that reproduces → fix → verify green

### Frontend Tests

| Layer | Tool | Scope |
|---|---|---|
| Unit | Vitest + React Testing Library | Components, hooks, utilities |
| Mocking | MSW (Mock Service Worker) | API responses in component tests |
| E2E | Playwright (Phase 5) | Full user flows in real browser |

### Verification Gates

| Gate | Command | When |
|---|---|---|
| Format | `dotnet format --verify-no-changes` | Before every commit |
| Lint | `npm run lint` | Before every commit |
| Type check | `dotnet build` / `npm run typecheck` | Before every commit |
| Unit tests | `dotnet test` / `npm test` | After every change |
| Build | `dotnet build -c Release` / `npm run build` | Before PR |

### CI Pipeline (GitHub Actions)

Two parallel jobs:

1. **backend-ci**: restore → format → build → test (with code coverage)
2. **frontend-ci**: npm ci → lint → typecheck → test → build

---

## Boundaries

### Security Boundaries

- **Data isolation**: EF Core global query filters enforce `UserId` on all `Category` and `Transaction` queries. No repository method can bypass this.
- **Auth**: HttpOnly + Secure + SameSite=Strict cookies for refresh tokens. Access tokens in JS memory only.
- **Password hashing**: BCrypt with work factor 12. Passwords are never stored in plaintext.
- **CSV injection**: User-generated text fields prefixed with `'` when they start with `=`, `+`, `-`, `@`, `\t`, or `\r`.
- **Rate limiting**: 5 req/min on auth endpoints; 200 req/min per authenticated user (JWT `sub` claim) on all other authenticated endpoints (B1 / R7 — C-option deviation from the original per-IP plan; see security-hardening.md §B1).
- **Request body size limit**: 64 KB max (A5 / R6). Oversized bodies return `413 Payload Too Large`.
- **Transport security**: HTTPS enforcement + HSTS in Production (A2). See §Deployment.
- **Security-event audit log** (A6 / R10): every register, login, refresh, and logout attempt is emitted as a structured Serilog event with a stable correlation handle (see §Security Events).

### Security Events (A6 / R10)

Every authentication-lifecycle event is logged via `ISecurityEventLogger` (Serilog-backed) with the following schema. All events include `MachineName`, `ThreadId`, and (once C1 ships) `RequestId` via Serilog enrichers. Email addresses are **never** logged in raw form — only their SHA-256 hash (first 16 hex chars, lowercased + trimmed before hashing) appears, which is enough to correlate events for the same email without exposing the address.

| Event id | Level | Fields | When |
|---|---|---|---|
| `auth.register.success` | Information | `UserId`, `EmailHash` | After `User` is persisted |
| `auth.register.failure.duplicate` | Warning | `EmailHash` | `ExistsByEmailAsync` returns true |
| `auth.login.success` | Information | `UserId`, `EmailHash` | After `VerifyPassword` returns true |
| `auth.login.failure.unknown_user` | Warning | `EmailHash` | `FindByEmailAsync` returns null |
| `auth.login.failure.bad_password` | Warning | `UserId`, `EmailHash` | `VerifyPassword` returns false |
| `auth.refresh.success` | Information | `UserId`, `OldTokenId`, `NewTokenId` | After `RotateAsync` |
| `auth.refresh.failure.invalid` | Warning | `TokenId` (if extractable), `Reason` | `ValidateAsync` throws |
| `auth.logout.success` | Information | `UserId`, `TokenId` | After `RevokeAsync` |

**Toggling**: `SecurityEvents:Enabled = false` in config (or `SecurityEvents__Enabled=false` env var) disables all events without code changes. Default: enabled.

**Acceptance**:
- `grep -i "email.*@" backend/src/ExpenseTracker.Api/logs/*.log` returns 0 matches.
- `grep "auth.login.failure" logs/` returns structured Serilog output (one JSON line per failure with `UserId`, `EmailHash`, `Level=Warning`).

### API Boundaries

- All errors return RFC 7807 `application/problem+json`
- All monetary amounts are `decimal(18,2)` in PostgreSQL, exposed as strings in JSON (invariant culture, 2 dp)
- Dates are `DateOnly` (wire format `YYYY-MM-DD`)
- IDs are UUID v4
- Pagination: max 100 items per page

### External Dependencies

| Dependency | Purpose | Required for Dev |
|---|---|---|
| PostgreSQL 16 | Primary database | Yes (via Docker) |
| Docker | Local Postgres + CI Testcontainers | Yes |
| .NET 10 SDK | Backend compilation | Yes |
| Node.js 22 LTS | Frontend compilation | Yes |

### Deployment (A2)

The API is designed to run behind a **reverse proxy** (Nginx, Caddy, cloud LB) that terminates TLS.

| Setting | Development | Production |
|---|---|---|
| HTTPS redirect | Disabled | Enabled (`UseHttpsRedirection`) |
| HSTS header | Not sent | `max-age=31536000; includeSubDomains; preload` |
| `Jwt:SecretKey` | Via `dotnet user-secrets` | Via env var `Jwt__SecretKey` or secrets manager |

**Reverse proxy requirements:**
- Terminate TLS and forward traffic as HTTP to the app.
- Set `X-Forwarded-Proto` header so the app knows the original protocol.
- The app listens on HTTP only — `UseHttpsRedirection` handles the HTTP→HTTPS redirect when the app is exposed directly (not behind a proxy).

**Local dev secrets:** Use `dotnet user-secrets` — never store secrets in tracked files. See `Makefile` for the `dev-secrets` target.

---

## Success Criteria

### Functional

- [x] Multi-user registration and login
- [x] JWT refresh token with rotation and reuse detection
- [x] Transaction CRUD with decimal precision
- [x] System categories (seeded, read-only) + user custom categories
- [x] Dashboard: current month KPIs, 6-month trend, top-10 by category
- [x] CSV export (transactions + monthly summary) with Thai headers
- [x] CSV injection mitigation
- [x] RFC 7807 error responses
- [x] UTF-8 BOM in CSV for Excel compatibility

### Non-Functional

- [x] All unit + integration tests passing (163 tests)
- [x] `dotnet format` clean, `dotnet build -c Release` 0 warnings
- [x] Docker-based local dev (single command: `make db-up`)
- [x] CI pipeline: lint + typecheck + test + build for both backend and frontend
- [x] Clean Architecture enforced (no reverse dependencies)
- [x] Global query filters for multi-user isolation

### Quality Gates (P4.4)

- [ ] Register two users; verify data isolation
- [ ] Create custom categories; verify system categories are read-only
- [ ] Log transactions across 6 months
- [ ] Dashboard renders KPIs, line chart, top-10 chart
- [ ] Filter and paginate transactions
- [ ] Export transactions CSV and summary CSV; open in Excel with Thai characters correct
- [ ] Logout invalidates refresh token
- [ ] Health endpoint reports DB healthy

---

## Open Questions

1. **Background job for expired refresh tokens**: Should we add a periodic cleanup job to purge refresh tokens older than 7 days + grace period? Currently they accumulate in the `refresh_tokens` table. Low priority for Phase 1, but worth considering for production.
2. **Multi-currency support**: The current design is single-currency (THB). If multi-currency is needed later, the `amount` column would need a `currency` companion field and conversion logic — a significant schema change.
3. **Audit trail**: No soft-delete or audit-log is implemented. If regulatory requirements emerge, a `deleted_at` column or an `audit_logs` table would be needed.
4. **Mobile app**: The API is REST + JWT, so a mobile client could be added without backend changes. However, the refresh token cookie strategy would need adaptation (mobile apps typically use secure storage instead of cookies).
