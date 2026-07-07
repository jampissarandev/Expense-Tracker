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
- **Popup elevation**: `--shadow-popover` CSS token (light + dark) + `bg-black/60` overlay + `ring-foreground/20` on Dialog, AlertDialog, Sheet

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

### Data at rest (E2 / R22)

The PII and credential material in the database is stored as follows:

| Field | Table | Encoding | Why |
|---|---|---|---|
| `Email` | `users` | Plaintext | Displayed in the UI; used as the login identifier; indexed for `WHERE email = $1` lookups. |
| `DisplayName` | `users` | Plaintext | Free-text profile field. |
| `PasswordHash` | `users` | BCrypt (work factor 12) | One-way hash; cleartext is never recoverable. |
| `TokenHash` | `refresh_tokens` | SHA-256 of the cookie plaintext | One-way hash; the cleartext token is in the `et_rt` HttpOnly cookie. |

**No application-level encryption of PII.** `Email` and `DisplayName` are stored as plaintext. The compensating control is **disk-level encryption of the Postgres data volume** at the infrastructure layer — this is a deployment-time requirement, not a code-time one. The single Postgres instance is treated as a trust boundary: anyone with read access to the DB can read the plaintext PII. See [ADR-0008](../adr/0008-pii-encryption-at-rest.md) for the full decision (alternatives considered, threat model, follow-up). The audit's log-redaction rule (no raw email in logs — only the truncated SHA-256 `EmailHash`) is independent of this decision and continues to apply; see §Security Events.

**Operator runbook requirement**: when bringing up a production Postgres (AWS RDS, Azure Database for PostgreSQL, GCP Cloud SQL, or self-hosted on an encrypted volume), the storage encryption option must be enabled. The application does not verify this at runtime; the operator is responsible.

### Security Events (A6 / R10)

Every authentication-lifecycle event is logged via `ISecurityEventLogger` (Serilog-backed) with the following schema. All events include `MachineName`, `ThreadId`, and `RequestId` (C1 / R17) via Serilog enrichers. Email addresses are **never** logged in raw form — only their SHA-256 hash (first 16 hex chars, lowercased + trimmed before hashing) appears, which is enough to correlate events for the same email without exposing the address.

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

### Request-ID propagation (C1 / R17)

Every HTTP request flows through `RequestIdMiddleware` (registered before the global exception handler and Serilog request logging). The middleware:

1. Reads the inbound `X-Request-Id` request header.
2. If the header is missing, empty, whitespace, or longer than 128 characters (defense against log-flooding), generates a new 32-char hex id via `Guid.NewGuid().ToString("N")`.
3. Publishes the resolved id on `HttpContext.Items["RequestId"]` so in-process consumers (exception handler, controllers, services) can read it.
4. Pushes the id into the Serilog `LogContext` as `RequestId` so every log entry written during the request (including `ISecurityEventLogger` events) carries it.
5. Sets the response `X-Request-Id` header (via `OnStarting`) so error responses (4xx/5xx) keep the header even if a downstream middleware short-circuits.

The Serilog request-log completion event additionally attaches the id via `EnrichDiagnosticContext` (necessary because `UseSerilogRequestLogging` emits its completion log after the response has been sent, by which time the `LogContext` scope has been unwound). The custom `MessageTemplate` renders `RequestId=…` on the same line as method/path/status/elapsed for at-a-glance correlation.

`GlobalExceptionMiddleware` reads the id from `HttpContext.Items["RequestId"]` (falling back to `HttpContext.TraceIdentifier`) and embeds it in the `traceId` extension field of the `application/problem+json` response, so an error report from a client includes the same correlation id the operator sees in the logs.

**Acceptance**:
- `curl -H "X-Request-Id: test-1" http://localhost:5117/health -I` echoes `X-Request-Id: test-1` on the response.
- A request without the header receives a server-generated 32-char hex id in the response header.
- Every Serilog request log line ends with `RequestId=<id>`.

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

## Security

This is the authoritative description of the security controls the v1 API enforces. The `## Boundaries` section above is a quick-reference bullet list — this section is the detailed chapter that backs it. Every subsection cross-links to the relevant ADR (where one exists) and to the corresponding fix in `docs/plans/security-hardening.md` (where the control was introduced or is planned).

> **Adding a new endpoint or feature?** Read [ADR-0009](../adr/0009-threat-model.md) (Threat-Model Baseline) first and update its endpoint-inventory table before opening a PR. The PR template's "Threat model reviewed" checkbox enforces this.

### Authentication

Users authenticate with **email + password**. Passwords are hashed with **BCrypt** (work factor 12); the cleartext is never recoverable. Authenticated requests carry a **JWT access token** in the `Authorization: Bearer` header (15-minute lifetime, in-memory only on the client), and a **refresh token** in an `HttpOnly + Secure + SameSite=Strict` cookie named `et_rt` (7-day lifetime, SHA-256 hash stored in the `refresh_tokens` table). Every successful `/api/auth/refresh` call **rotates** the refresh token: the old token is revoked atomically with the new token's creation, and reuse of a revoked token revokes the entire rotation chain (defense against token theft).

**Local dev**: a dev-only `Jwt:SecretKey` is stored in `dotnet user-secrets`, never in tracked `appsettings.Development.json`. In non-Development environments the app fails fast at startup if `Jwt:SecretKey` is empty or shorter than 32 characters (ADR-0006).

See [ADR-0002](../adr/0002-jwt-refresh-token-with-rotation.md) (JWT + refresh-token design), [ADR-0006](../adr/0006-jwt-secret-validation.md) (secret-length startup assertion), and `docs/plans/security-hardening.md` §A2, §A4, §A6.

### Authorization

Every authenticated request is scoped to the **current user** via two layers:

1. **ASP.NET Core `[Authorize]`** on the 4 protected controllers (`Transactions`, `Categories`, `Dashboard`, `Exports`) — the request must carry a valid `sub` claim.
2. **EF Core global query filter** on the `UserId` column of `Category` and `Transaction` — every read, write, and delete is automatically restricted to rows where `UserId == currentUserId`. The filter is set up in `OnModelCreating` and cannot be bypassed from a controller without explicitly calling `IgnoreQueryFilters()`. No controller does.

This is the **OWASP A01: Broken Access Control** defense in depth. The first layer stops unauthenticated requests; the second layer stops authenticated requests from reading or mutating another user's data even if the controller has a logic bug. The threat-model ADR's "if you can't fill the Authorization column" test applies here — every new endpoint must fill that column, or the PR is incomplete.

See [ADR-0001](../adr/0001-clean-architecture.md) (the architectural seam between controllers and the DB), [ADR-0003](../adr/0003-ef-core-over-dapper.md) (why EF Core's global query filter is the right primitive), and the integration test `backend/tests/ExpenseTracker.IntegrationTests/Persistence/GlobalQueryFilterTests.cs`.

### Transport

The API enforces HTTPS in non-Development and emits a full set of security headers on every response (the 9 headers from `docs/plans/security-hardening.md` §A1; HSTS is sent only outside Development):

| Header | Value | Notes |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevents MIME-sniff attacks on user-controlled fields. |
| `X-Frame-Options` | `DENY` | App has no iframe use case; clickjacking defense. |
| `Referrer-Policy` | `no-referrer` | No `?token=…` style query strings; future-proofing. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disable unused powerful browser APIs. |
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Covers R1 + R18. Applies to the API's own responses (e.g. `/swagger` in Dev); the frontend has its own CSP via `<meta>` (`docs/plans/security-hardening.md` §D1). |
| `Cross-Origin-Opener-Policy` | `same-origin` | Process isolation. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Resource isolation. |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Resource isolation. |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Sent only in non-Development via `app.UseHsts()`. Production deployment sends `; preload` additionally (see `### Deployment` above). |

**CSRF**: state-changing cookie-bearing endpoints (`POST /api/auth/logout`) require a double-submit antiforgery token: the `XSRF-TOKEN` cookie (JS-readable) and the `X-XSRF-TOKEN` header (set by the frontend axios interceptor) must match. The frontend reads the cookie and sets the header on every state-changing request (`docs/plans/security-hardening.md` §B2 + §D2).

**CORS**: configured for `http://localhost:5173` (Vite dev) and `http://localhost:4173` (Vite preview / Lighthouse CI) with `Access-Control-Max-Age: 600` so browsers cache the preflight for 10 minutes (§B5).

**Deployment**: see `### Deployment` above. The app expects to run behind a reverse proxy that terminates TLS and forwards `X-Forwarded-Proto`. The `appsettings.Production.json` stub is the deterministic config source for non-Dev environments.

See `docs/plans/security-hardening.md` §A1 (security headers), §A2 (HTTPS + HSTS), §A3 (`/health` minimal body in Prod), §B2 (CSRF), §B4 (Swagger guarded by env), §B5 (CORS preflight), §D1 (frontend CSP), §R9 (traceId disclosure gated by env — see `### Security Events` below for the related event-log behavior).

### Rate limiting

Two rate-limit policies run independently:

| Policy | Scope | Limit | Applies to | Plan ref |
|---|---|---|---|---|
| **Auth** | Per IP, single shared bucket | 5 requests / minute | `POST /api/auth/*` (register, login, refresh, logout) | Pre-audit baseline; unchanged by Phase A/B. |
| **Global** | Per authenticated user (JWT `sub`), with IP fallback for any future anonymous routes | 200 requests / minute | All `[Authorize]` controllers (`Transactions`, `Categories`, `Dashboard`, `Exports`) | §B1 (R7) |

**Why per-user and not per-IP** (deviation from the audit's original B1 plan): per-user reads the verified JWT `sub` and is consistent with the per-account lockout policy below — an attacker rotating IPs is stopped by the lockout, not the IP-based limit. Per-IP would also require `UseForwardedHeaders` to be configured behind a reverse proxy, which expands trust of `X-Forwarded-For` (RFC 7239 caveat). See `docs/plans/security-hardening.md` §B1 for the full deviation note and the test that locks the per-user behavior in place.

**E2E test override**: the `E2E_TESTS=true` env var (and a matching knob for the global limit) raises both limits so the Playwright suite can run to completion. The override is a deployment-time setting, not a code-time one.

### Security event audit

Every authentication-lifecycle event is emitted as a structured Serilog event by `ISecurityEventLogger`. The full event schema and the toggle (`SecurityEvents:Enabled`) live in `### Security Events` above. The two most important properties are:

- **`EmailHash`** is **always** a SHA-256 hash of the lowercased+trimmed email, truncated to 16 hex chars — never the raw email. The log file is therefore a *correlatable* but not *recoverable* store of user activity. A grep for `email.*@` against the log directory returns 0 matches (acceptance criterion).
- **`RequestId`** is stamped on every event via the Serilog `LogContext`, so a user-reported incident can be traced end-to-end through the log lines that handled the request (`### Request-ID propagation` above).

**Why audit logs are first-class**: OWASP **A09: Security Logging & Monitoring Failures**. Without the audit log, a brute-force attacker hammering `/api/auth/login` produces only one INFO line per request — no way to distinguish "user doesn't exist" from "wrong password", no alert on 50 failures in 60 s, no trail for "who logged in as X at 3 AM".

**Trade-off (ADR-0007)**: the `POST /api/auth/register` endpoint reveals whether a given email is already registered (a user-enumeration vector). The 5 req/min auth rate limit is the primary bulk-enumeration mitigation. Adding a send-email-on-register pattern (the proper fix) is deferred to a future ADR if the product scope changes.

See `docs/plans/security-hardening.md` §A6, [ADR-0007](../adr/0007-register-endpoint-enumeration.md).

### Account lockout

> **Status: planned, not yet shipped.** This policy is in `docs/plans/security-hardening.md` §B3 (R11) and is gated on a database-schema change (two new columns on `users`: `failed_login_count`, `lockout_end`). See `.github/copilot-instructions.md` §"Ask first" — schema changes require approval before implementation.

When shipped, the policy is:

- **5 consecutive failed logins** for a given account → the account is locked for **15 minutes**.
- The `lockout_end` check runs **before** password verification (cheap short-circuit, prevents a timing oracle).
- A successful login resets the counter to 0 and clears `lockout_end`.
- The counter increment uses a single `UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1` to avoid a read-modify-write race across concurrent requests.

The lockout complements the rate-limit policy above: the rate limit stops a single IP from brute-forcing, the lockout stops an attacker rotating IPs (or attacking a single user from a botnet).

### Data at rest

`Email` and `DisplayName` are stored as **plaintext** in the `users` table. `PasswordHash` is BCrypt(work factor 12) and `TokenHash` is SHA-256 of the refresh-token cookie plaintext. The compensating control is **disk-level encryption of the Postgres data volume** at the infrastructure layer — this is a deployment-time requirement, not a code-time one. The single Postgres instance is treated as a trust boundary: anyone with read access to the DB can read the plaintext PII.

The operator runbook must verify the storage volume is encrypted when bringing up a production Postgres (AWS RDS encryption, Azure Database for PostgreSQL storage encryption, GCP Cloud SQL encryption, or self-hosted on an encrypted volume). The application does not verify this at runtime.

> **Cross-link**: see [ADR-0008](../adr/0008-pii-encryption-at-rest.md) for the full decision (threat model, alternatives considered, follow-ups). ADR-0008 is the citable answer to "why isn't `User.Email` encrypted?"

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
