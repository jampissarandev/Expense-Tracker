# ADR-0009: Threat-Model Baseline (STRIDE) for the v1 API

## Status

Accepted

## Date

2026-06-29

## Context

The 2026-06-27 security audit ([`docs/plans/security-hardening.md`](../plans/security-hardening.md)) produced 22 findings (R1–R22). The audit was an *ad-hoc* STRIDE walkthrough over the v1 API: each finding is a control, but the reasoning that produced it lives in the reviewer's head, not in the repo. Future changes — file uploads, webhooks, OAuth, exporting data to a third-party accounting app, an admin role for support — will all need the same reasoning, and the next reviewer should not have to re-derive it from scratch.

This ADR captures the **baseline threat model**: the trust boundaries, the assets, the threats, and the controls that the v1 API already has. It is the single page a future engineer should read before adding a new endpoint, feature, or integration. It is also the reference the PR template (`.github/PULL_REQUEST_TEMPLATE.md`) points to.

### Method

We use **STRIDE** ([`.github/skills/security-and-hardening/SKILL.md`](../../.github/skills/security-and-hardening/SKILL.md) §"Process: Threat Model First") — a quick lens, not a ceremony. For each **trust boundary** we list the assets reachable through it and the six STRIDE threats. For each threat we list the existing control that mitigates it and the audit finding that introduced or documented the control.

### Trust boundaries

A *trust boundary* is a place where untrusted data crosses into the system. The v1 API has the following boundaries:

| # | Boundary | Untrusted side | Trusted side | Notes |
|---|---|---|---|---|
| B1 | Browser → API | The end user's browser (any origin) | The ASP.NET Core HTTP pipeline in `ExpenseTracker.Api` | All endpoints. Includes all 19 routes in [`docs/api-contract.md`](../api-contract.md) §"Endpoints". |
| B2 | API → Postgres | The Postgres wire protocol (loopback in dev, private network in prod) | The `expensetracker` database, including `users`, `refresh_tokens`, `categories`, `transactions` | The DB is treated as a *trust boundary itself* (see ADR-0008): a privileged reader can read plaintext PII. |
| B3 | CI/CD → repo & registry | GitHub Actions runners, NuGet, npm | The `main` branch and the published images | The boundary is the commit + the dependency manifest; the controls are PR review and `security-audit.yml` (E1 / R15). |
| B4 | Dev machine → repo | The developer's local shell, dotnet CLI, npm, Docker | The tracked files in the working tree | A dev can `git add` a secret by accident. The control is `.gitignore` + `dotnet user-secrets` for dev-only secrets (A4 / R5). |

There is no B5 today — we do **not** fetch URLs server-side, do not accept file uploads, do not consume webhooks, and do not call out to a third-party API. If any of those features lands, the next trust boundary appears at that point and this ADR is updated (see "How to extend" below).

### Assets

Assets are what an attacker would want. For v1:

| Asset | Where it lives | Sensitivity |
|---|---|---|
| User email | `users.email` (plaintext) | PII — see ADR-0008 |
| User display name | `users.display_name` (plaintext) | PII — see ADR-0008 |
| Password hashes | `users.password_hash` (BCrypt) | Compromise = offline cracking risk |
| Refresh-token hashes | `refresh_tokens.token_hash` (SHA-256) | Compromise = token-replay window until rotation |
| Transaction amounts + notes | `transactions` (plaintext) | PII (financial behavior) |
| Categories (custom) | `categories` (plaintext) | Low — by-design per-user data |
| JWT signing key | `Jwt:SecretKey` config | Compromise = forge any user's access token |
| Log files (Serilog JSON) | `backend/src/ExpenseTracker.Api/logs/*.log` | Contains `EmailHash` (SHA-256, first 16 hex) but never raw email; can still correlate per-user activity |
| The API process itself | The container/VM | DoS target; see D-stride below |

### STRIDE baseline

For each STRIDE category, the *typical* v1 mitigation, the *boundary* it applies to, and the audit finding that records the control.

#### S — Spoofing

> *Can someone impersonate a user or service?*

| Threat | Boundary | Mitigation | Finding |
|---|---|---|---|
| Impersonate an existing user (email + password) | B1 | BCrypt verification in `AuthService.LoginAsync`; 5 req/min auth rate limit | (baseline) + R7, R11 |
| Forge a JWT | B1 | HMAC-SHA256 with server-side `Jwt:SecretKey`; fail-fast on short/empty key in non-Dev | ADR-0002, R5 |
| Steal a refresh-token cookie | B1 | `HttpOnly + Secure + SameSite=Strict`; rotation on every use; reuse-detection revokes the whole chain | ADR-0002 |
| Impersonate via CSRF on a cookie-bearing state-changing request | B1 | Double-submit cookie (`XSRF-TOKEN` cookie + `X-XSRF-TOKEN` header); `[AutoValidateAntiforgeryToken]` on `AuthController` | R8 |
| Submit a forged `X-Request-Id` to confuse the audit log | B1 | `RequestIdMiddleware` regenerates if the inbound header is empty / whitespace / > 128 chars | R17 |

#### T — Tampering

> *Can data be altered in transit or at rest?*

| Threat | Boundary | Mitigation | Finding |
|---|---|---|---|
| Modify request body in flight | B1 | HTTPS in production (TLS terminated at reverse proxy) | R2 |
| Modify response body (downgrade security headers) | B1 | Security headers set by middleware, not by the client | R1 |
| Inject a transaction note that becomes a CSV formula when exported | B1 → B2 → file | Single-quote prefix on cells starting with `= + - @ \t \r` | ADR-0004 |
| SQL injection via request body | B1 → B2 | EF Core parameterizes every query; no raw SQL anywhere in the codebase | (baseline) |
| Modify the JWT payload after signing | B1 | HMAC signature is verified on every request by the JWT bearer middleware | ADR-0002 |
| Tamper with the `users` table directly (insider) | B2 | Out of scope — DB is the trust boundary; the mitigation is disk encryption (ADR-0008) and DB-level `GRANT` review | ADR-0008 |

#### R — Repudiation

> *Can an action be denied later?*

| Threat | Boundary | Mitigation | Finding |
|---|---|---|---|
| "I never logged in" — user denies a session | B1 | `ISecurityEventLogger` emits `auth.login.success` / `auth.login.failure.*` with `UserId` + `EmailHash` + `RequestId` | R10 |
| "I never refreshed my token" | B1 | `auth.refresh.success` and `auth.refresh.failure.invalid` events with `old_token_id` + `new_token_id` | R10 |
| "I never logged out" | B1 | `auth.logout.success` event with `userId` + `token_id` | R10 |
| Correlate events across services | B1 → logs | `X-Request-Id` echoed in the response and stamped on every Serilog line via `LogContext` | R17 |
| Email leaked via the audit log | logs | `EmailHash` is SHA-256, first 16 hex chars — enough to correlate, never recovers the address | R10 (negative requirement) |

#### I — Information disclosure

> *Can data leak?*

| Threat | Boundary | Mitigation | Finding |
|---|---|---|---|
| PII on disk (stolen volume, stolen backup) | B2 | Disk-level encryption at the infra layer is a deployment requirement | ADR-0008 |
| Raw email written to logs | logs | `EmailHash` everywhere; the structured log line never carries the plaintext address | R10 |
| Internal error details leak through the response body | B1 → client | `application/problem+json` (RFC 7807) with a fixed schema; `traceId` extension only included in `Development`; no stack traces ever | R9 |
| `/health` leaks DB connectivity state to an internet scanner | B1 → client | In `Production`, the response body is `{"status":"Healthy"}` (or `{"status":"Unhealthy"}`) only — no `database` or `timestamp` field | R3 |
| Browser renders our JSON in a malicious iframe | B1 → browser | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` | R1, R18 |
| Browser-side XSS via a future `dangerouslySetInnerHTML` slip | browser | Frontend `<meta>` CSP `script-src 'self'`, `style-src 'self' 'unsafe-inline'` | R13 |
| Old browser caches a pre-HSTS redirect and serves HTTP | B1 → browser | `Strict-Transport-Security: max-age=31536000; includeSubDomains` in non-Dev | R2 |
| Swagger UI exposes the API surface in production | B1 | `AddSwaggerGen()` and `AddEndpointsApiExplorer()` registered only when `IsDevelopment()` | R4 |
| An attacker learns whether an email is registered | B1 | 5 req/min auth rate limit; the trade-off is documented in ADR-0007 | ADR-0007 |
| Disclosure of a vulnerable dependency version | B3 (CI) | `security-audit.yml` fails the build on `High`/`Critical` from `dotnet list package --vulnerable` and `npm audit` | R15 |
| Cross-origin embed in a malicious page | B1 | `Cross-Origin-Resource-Policy: same-origin`, `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp` | R1 |

#### D — Denial of service

> *Can it be overwhelmed?*

| Threat | Boundary | Mitigation | Finding |
|---|---|---|---|
| 30 MB JSON body to `/api/transactions` | B1 | `KestrelServerOptions.Limits.MaxRequestBodySize = 64_000` + per-action `[RequestSizeLimit(64_000)]`; `GlobalExceptionMiddleware` maps `BadHttpRequestException` → 413 | R6 |
| Brute-force a single user's password from a botnet | B1 | 5 req/min auth rate limit + (planned) per-account 5-failure / 15-min lockout | R7, R11 |
| One authenticated user scraping `/transactions?pageSize=100` at 100 rps | B1 | Global rate limit, 200 req/min per authenticated user (JWT `sub`) | R7 |
| Known-vulnerable package with a public CVE (e.g. `node-ipc`, `event-stream`, `colors`) | B3 | Weekly CI audit + PR-time audit on any change to `*.csproj` / `package.json` | R15 |
| OPTIONS round trip on every state-changing request | B1 | `Access-Control-Max-Age: 600` (10 min) on preflight responses | R16 |
| Subdomain takeover / wildcard DNS | infra | Out of scope of this ADR; mitigated by DNS hygiene at the operator's cloud | — |

#### E — Elevation of privilege

> *Can a user gain rights they shouldn't?*

| Threat | Boundary | Mitigation | Finding |
|---|---|---|---|
| Read another user's transactions | B1 → B2 | EF Core global query filter on `Transaction.UserId` and `Category.UserId` — every query is restricted to the current user. The filter cannot be bypassed from a controller without explicitly removing it (and no controller does). | ADR-0001, ADR-0003 |
| Edit a system category (a category `IsSystem = true`) | B1 | `CategoriesController` returns 403 on a `PUT` to a system category; the `IsSystem` flag is set in the seed and never writable via the API | (baseline) |
| Delete a category that is referenced by transactions | B1 | 400 with a clear message; the FK `ON DELETE RESTRICT` is enforced at the DB | (baseline) |
| Forge an admin role by manipulating the JWT | B1 | No admin role exists in v1. The JWT has no `role` claim, only `sub`, `email`, `jti`. Adding a role is a deliberate future change. | ADR-0002 |
| Submit a CSRF request that escalates (e.g., changes password) | B1 | Antiforgery token required on cookie-bearing state-changing endpoints | R8 |
| Mass-register accounts (DoS-amplifier for the auth rate limit) | B1 | 5 req/min on `/api/auth/*` applies to `/auth/register` too | R7 |
| Bypass the rate limit by rotating JWTs | B1 | Global rate limit is per **user** (JWT `sub`), not per IP — see the C-option deviation note in security-hardening.md §B1 | R7 |
| Account takeover via brute force | B1 | 5-failure / 15-min lockout (planned) | R11 |
| Access Swagger endpoints in production | B1 | `AddSwaggerGen` not registered in `IsProduction` | R4 |

### How to extend

When you add a new endpoint, a new feature, or a new integration, **do not** skip the threat model. The PR template (`.github/PULL_REQUEST_TEMPLATE.md`) requires a one-line answer to "did you update the boundary table?". The bar is low — five minutes of thought, not a re-derivation.

**Step 1 — Does this add a new trust boundary?**

If you are about to:

- accept a file upload,
- consume a webhook from a third party,
- call a third-party HTTP API (payment, email, OCR, AI, …),
- read a URL supplied by the user (SSRF surface),
- run user-supplied JavaScript / Python / SQL (sandbox escape surface),
- or expose a new port / protocol,

then **add a new boundary row to the table above** and a STRIDE pass for it. The expansion should look like this — invent the row inline in the PR description, the next reviewer will fold it into this ADR.

```markdown
| B5 | API → ExternalService | The external service's API | The API process | We now POST user data to https://example.com/foo |
```

**Step 2 — For each new endpoint, fill the boundary table.**

The project maintains a *boundary table* — one row per endpoint — under "Endpoint inventory" below. The columns are:

| Column | What goes here | Empty means |
|---|---|---|
| Method + path | `[HttpGet("/foo")]` | — |
| Auth | `public` / `bearer` / `cookie` | — |
| Authorization rule | Who can call it. E.g. *"any authenticated user, only their own row"* | **A01: Broken Access Control** — you do not know who is allowed here. Stop. |
| Data classification | What data crosses the boundary. E.g. *PII* / *credentials* / *none* | You have not classified what you are protecting. Stop. |
| STRIDE notes | Free-form: which of S/T/R/I/D/E apply specifically to this endpoint | You have not thought about it. Stop. |
| Test refs | Names of the tests that lock the behavior in | The control is not regression-tested |

The litmus test from the plan: **if you can't fill the Authorization column, you have A01: Broken Access Control.** That is the most common failure mode in the OWASP Top 10, and the most preventable. Filling the column forces you to answer "who is allowed to call this, and how do I prove they are who they say they are?"

**Step 3 — Re-run the STRIDE pass if the endpoint enables a new threat category.**

If your endpoint, for example, accepts a `redirect_uri` parameter, you have just enabled an open-redirect or OAuth-flow-injection threat. Add a row to the relevant STRIDE table. If the new control is a config flag, add it to the test matrix. If the control is a code change, link the PR in the finding's row.

**Step 4 — Update the audit finding list (`docs/plans/security-hardening.md` §"Risk-prioritized fix list").**

If your change is a security fix or a new security control, give it the next `R` number and add a row. Future readers of the audit will thank you.

### Endpoint inventory (v1)

The test class names below are the **actual** class names in `backend/tests/ExpenseTracker.UnitTests/` and `backend/tests/ExpenseTracker.IntegrationTests/Api/`. The "Test refs" column is a regression-net — if a row has no test ref, the control is not pinned by an automated test, and that is itself a finding.

| Method | Path | Auth | Authorization rule | Data classification | STRIDE notes | Test refs |
|---|---|---|---|---|---|---|
| POST | `/api/auth/register` | public | Anyone with a unique email + 8+ char password | PII (email, display name); credential (password) | S (account creation), I (registration enumeration — see ADR-0007) | `ExpenseTracker.UnitTests/Auth/AuthServiceTests.cs` |
| POST | `/api/auth/login` | public | Anyone with valid credentials | Credential (password) | S (impersonation), R (login audit) | `ExpenseTracker.UnitTests/Auth/AuthServiceTests.cs`, `ExpenseTracker.UnitTests/Auth/SecurityEventLoggerTests.cs` |
| POST | `/api/auth/refresh` | cookie (`et_rt`) | Holder of a non-revoked, non-expired refresh token | Credential (refresh token) | S (token theft), R (rotation audit) | `ExpenseTracker.IntegrationTests/Api/AuthEndpointsTests.cs` (covers the full register → login → refresh round-trip) |
| POST | `/api/auth/logout` | bearer + antiforgery | The authenticated user (resolves to their current refresh token) | None | R (logout audit), S (CSRF) | `ExpenseTracker.IntegrationTests/Api/AuthEndpointsTests.cs` (CSRF + logout both covered here — the standalone `CsrfTests` file from the B2 plan was rolled into this class) |
| GET | `/api/auth/me` | bearer | The authenticated user | PII (email, display name) | I (PII read), R (audit) | `ExpenseTracker.IntegrationTests/Api/AuthEndpointsTests.cs` |
| GET | `/api/categories` | bearer | Any authenticated user (returns their own + system) | None | E (data isolation via global filter) | `ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs`, `ExpenseTracker.IntegrationTests/Persistence/GlobalQueryFilterTests.cs` |
| GET | `/api/categories/{id}` | bearer | Owner OR system category | None | E (ownership) | `ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs` |
| POST | `/api/categories` | bearer | Any authenticated user (creates their own) | PII (name, icon, color) | — | `ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs` |
| PUT | `/api/categories/{id}` | bearer + antiforgery | Owner only (system → 403) | PII | E (ownership), T (CSRF) | `ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs` |
| DELETE | `/api/categories/{id}` | bearer + antiforgery | Owner only, only if no transactions reference it | — | E (ownership + FK), T (CSRF) | `ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs` |
| GET | `/api/transactions` | bearer | Any authenticated user (paged + filtered, scoped via global filter) | PII (financial) | I (PII listing), D (large result set — page-size cap) | `ExpenseTracker.UnitTests/Transactions/TransactionServiceTests.cs`, `ExpenseTracker.IntegrationTests/Api/GlobalRateLimitTests.cs` |
| GET | `/api/transactions/{id}` | bearer | Owner only | PII | E (ownership) | `ExpenseTracker.UnitTests/Transactions/TransactionServiceTests.cs` |
| POST | `/api/transactions` | bearer + antiforgery + body-size cap | Any authenticated user (creates their own) | PII | T (CSV injection in `note`), I (PII) | `ExpenseTracker.UnitTests/Transactions/TransactionServiceTests.cs`, `ExpenseTracker.IntegrationTests/Api/RequestSizeLimitEndpointsTests.cs` |
| PUT | `/api/transactions/{id}` | bearer + antiforgery + body-size cap | Owner only | PII | T (CSV injection), I (PII) | `ExpenseTracker.UnitTests/Transactions/TransactionServiceTests.cs` |
| DELETE | `/api/transactions/{id}` | bearer + antiforgery | Owner only | — | E (ownership) | `ExpenseTracker.UnitTests/Transactions/TransactionServiceTests.cs` |
| GET | `/api/dashboard/summary` | bearer | Any authenticated user (aggregates their own data) | Aggregated PII | I (PII aggregation), D (expensive query) | `ExpenseTracker.UnitTests/Dashboard/DashboardServiceTests.cs` |
| GET | `/api/exports/transactions.csv` | bearer | Any authenticated user (exports their own) | PII (financial) | T (CSV injection — see ADR-0004), I (PII), D (large export) | `ExpenseTracker.UnitTests/Exports/ExportServiceTests.cs` |
| GET | `/api/exports/summary.csv` | bearer | Any authenticated user (exports their own) | Aggregated PII | T (CSV injection), I (PII) | `ExpenseTracker.UnitTests/Exports/ExportServiceTests.cs` |
| GET | `/health` | public | Anyone | In Dev: DB status. In Prod: `{"status":"Healthy"}` only | I (info disclosure in Dev — see R3) | `ExpenseTracker.IntegrationTests/Api/HealthEndpointsTests.cs` |

## Decision

We adopt this ADR as the **baseline threat model** for v1. It is the source of truth for:

- The trust-boundary inventory (B1–B4 today; expandable as features land).
- The asset inventory and its sensitivity classification.
- The STRIDE baseline per boundary, with each control linked back to the audit finding that introduced it (`R1`–`R22`) or to the ADR that documented it (ADR-0001 through ADR-0008).
- The endpoint-inventory table — one row per endpoint, with an explicit **Authorization rule** column. An empty Authorization cell is the litmus test for A01: Broken Access Control.
- The "How to extend" procedure that the PR template points to.

This ADR **does not introduce a new control** — every STRIDE row references an existing control. Its job is to make the *reasoning* durable, so that the next engineer does not re-derive it from the audit plan and so that a future feature (file uploads, webhooks, OAuth, admin role) has a clear template to follow.

## Consequences

### Positive

- The threat model is in the repo, version-controlled, and reviewable. The PR template enforces a one-line confirmation that the author considered the boundary impact.
- The endpoint-inventory table doubles as a permission matrix. A reviewer can spot a missing `[Authorize]` or a wrong ownership check by reading the row.
- The STRIDE baseline is a defensive position: if a new control is proposed (e.g. "let's add an admin role"), the same STRIDE pass over the new boundary can be appended to this ADR.
- Future audits can diff against the baseline: "endpoint #14 used to say `bearer`; now it says `bearer + antiforgery` — that's a regression that should be in the audit log."

### Negative

- The endpoint-inventory table will drift. Mitigations: the PR template's "did you update the boundary table?" checkbox; a future CI check could diff `docs/adr/0009-threat-model.md` against the actual controller attributes and fail the build on drift.
- The ADR is a long document (~300 lines). Reading the whole thing is not required — the "How to extend" + STRIDE sections are the only ones an author of a new endpoint must read.
- STRIDE is not exhaustive. It does not cover, for example, supply-chain attacks on the build host or post-deployment lateral movement. Those are out of scope for v1 and live in a separate "operational security" runbook if it ever exists.

### Neutral

- The ADR does not change runtime behavior. It is a documentation change.
- The PR template is the only behavior change (a new required checkbox). The behavior of the application is unchanged.

## Alternatives Considered

### Keep the threat model in the audit plan only

- **Pros**: Single source of truth; no duplication.
- **Cons**: The plan is treated as a *one-time deliverable*, not as living documentation. Future readers will discover it from a stale link and a hand-wave. The "How to extend" ritual disappears with the audit. The endpoint-inventory table would have to be re-typed by every reviewer who wants to confirm a `[Authorize]` attribute.
- **Rejected**: the plan's purpose is to *resolve* the findings, not to be the long-term reference. The ADR is the long-term reference.

### Threat-model-as-code (e.g. `threatspec`, `pytm`)

- **Pros**: Machine-checkable, can be diffed, can run in CI.
- **Cons**: New tool to learn, new dependency, new CI job. The team has 22 findings and 19 endpoints — the *value* of tooling is low at this scale. The data is narrative-heavy (the "Why" column) and doesn't fit a structured schema well.
- **Rejected**: revisit if the endpoint count grows past ~50 or if a future audit demands machine-readable evidence.

### STRIDE-per-ADR (one ADR per STRIDE category)

- **Pros**: Each ADR is shorter; clearer ownership per category.
- **Cons**: Splits the threat model across 6 documents. The boundaries and the assets are *shared* across categories — splitting forces duplication or a 7th "index" ADR that points to the other 6. The plan's acceptance criterion ("ADR merged; PR template updated") describes a single artifact, not seven.
- **Rejected**: one ADR per category is the right move when categories have independent lifecycles (e.g. a separate ADR for "audit-log retention" with its own R-number). For v1 the categories are tightly coupled and a single document is easier to keep in sync.

### STRIDE-per-feature (one ADR per feature, e.g. one for `auth/*`, one for `transactions/*`)

- **Pros**: Closer to where the code lives; easier to extend.
- **Cons**: Loses the cross-cutting view. Authentication and rate-limiting and audit-logging are cross-cutting concerns; a per-feature view duplicates the cross-cutting analysis in every ADR. The plan's E3 brief is explicitly about a "STRIDE baseline", not a feature matrix.
- **Rejected**: revisit when the project has 3+ features that need different threat models (e.g. an admin console that needs its own trust boundary). For v1 there is one product surface.

## Follow-Up

- The PR template is the enforcement mechanism for "How to extend". If the project grows past ~50 endpoints, consider a CI check that diffs the controller attributes (`[Authorize]`, `[AutoValidateAntiforgeryToken]`, `[EnableRateLimiting]`, `[RequestSizeLimit]`) against the boundary table in this ADR and fails the build on drift.
- When a new trust boundary appears (B5+), the STRIDE pass for it must be appended to this ADR. Do not start a new ADR — append to this one. The whole point of the baseline is that the next reviewer can read one document.
- If the project adopts a structured threat-modeling tool (`threatspec`, `pytm`, OWASP Threat Dragon), migrate this ADR into the tool's source format and keep the rendered version here for human readers.
- The endpoint-inventory table is a snapshot. Refresh it whenever a new endpoint lands. The "Test refs" column should reference test classes that exist in `backend/tests/ExpenseTracker.UnitTests/` and `backend/tests/ExpenseTracker.IntegrationTests/`. If a row has no test refs, the control is not regression-tested.
- When the audit is re-run (next year, or after a significant feature lands), this ADR is the reference baseline. The audit's job is to find the *delta* from this baseline, not to re-derive the model from scratch.
