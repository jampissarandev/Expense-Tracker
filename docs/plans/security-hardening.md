# Plan: Security Hardening — Phase 6

> Origin: Security audit on 2026-06-27 against the project's `security-and-hardening` skill.
> Scope: Resolve all P0 and P1 findings (R1–R17) from the audit. P2 items documented in §10 for future planning.
> Format: 5 phases, each with independently testable PRs, ≤100 LOC per fix, TDD where behavior changes.

## TL;DR

22 fixes across 5 phases. No new runtime dependencies in Phases A–B (only `Microsoft.AspNetCore.HttpOverrides` may be added in Phase A; everything else uses the BCL or already-installed packages). No database schema changes. No behavior changes outside listed items.

| Phase | Goal | PRs | Blocking? |
|---|---|---|---|
| **A** | Production gate (must ship before first prod deploy) | 6 | Yes |
| **B** | Hardening (next sprint) | 5 | No |
| **C** | Observability & audit (week 2) | 4 | No |
| **D** | Frontend hardening (week 2–3) | 3 | No |
| **E** | Documentation & process (week 3) | 4 | No |

---

## Conventions

- **PR size**: target ≤100 LOC changed per fix. Multi-fix PRs explicitly justified.
- **TDD**: failing test first for any behavior change. Pure config / doc / refactor items skip test-first.
- **One concern per commit** — no drive-by formatting or refactors.
- **Branch naming**: `sec/<phase>-<id>-<slug>` (e.g. `sec/a1-security-headers`).
- **Verification per PR** (run before requesting review):
  - `dotnet test` (UnitTests + IntegrationTests)
  - `dotnet format --verify-no-changes`
  - `npm test` + `npm run lint` + `npm run typecheck`
  - For header/CSRF work: also `curl -I http://localhost:5117/...` and inspect headers
- **Docs to update in the same PR** when behavior changes: `docs/SPEC.md`, `docs/api-contract.md`, the relevant ADR.

---

## Risk-prioritized fix list (from audit)

| ID | Severity | Title | Phase |
|---|---|---|---|
| R1  | P0 | Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | A |
| R2  | P0 | HTTPS enforcement (HSTS + UseHttpsRedirection) outside Development | A |
| R3  | P0 | `/health` endpoint response gating | A |
| R5  | P0 | Move dev JWT secret out of tracked `appsettings.Development.json` | A |
| R6  | P0 | Request body size limit | A |
| R10 | P0 | Security-event audit log (login, refresh, logout) | A |
| R7  | P1 | Global request rate limit (in addition to auth-specific) | B |
| R8  | P1 | CSRF mitigation for cookie-bearing state-changing endpoints | B |
| R11 | P1 | Per-account login lockout | B |
| R4  | P1 | `AddSwaggerGen()` registration guarded by environment | B |
| R16 | P1 | CORS `PreflightMaxAge` | B |
| R17 | P2 | Request-ID propagation in Serilog | C |
| R9  | P2 | Trace-ID disclosure in error responses (gate by env) | C |
| R12 | P2 | Frontend refresh interceptor — consistent `withCredentials` | C |
| R13 | P2 | Frontend CSP `<meta>` tag | D |
| R15 | P2 | Dependency audit in CI (`dotnet list package --vulnerable`, `npm audit`) | E |
| R18 | P2 | `frame-ancestors 'none'` in CSP (rolled into R1) | A |
| R19 | P2 | `Permissions-Policy` header (rolled into R1) | A |
| R14 | P2 | SRI for any future external scripts | E (deferred — no externals today) |
| R20 | — | SSRF surface check (no action — N/A) | — |
| R21 | P2 | `AuthProvider` loading-state correctness | D |
| R22 | P2 | Document no-PII-encryption-at-rest decision | E |

---

# Phase A — Production Gate (must ship before first prod deploy)

> **Goal**: Every P0 finding resolved. App is safe to expose on the public internet.
> **Exit criteria**: Smoke test against a production-mode build (`ASPNETCORE_ENVIRONMENT=Production`) passes OWASP ZAP baseline scan with no High alerts.

## A1. Security headers (R1, R18, R19)

**Files**:
- `backend/src/ExpenseTracker.Api/Middleware/SecurityHeadersMiddleware.cs` (new)
- `backend/src/ExpenseTracker.Api/Program.cs` (register middleware)
- `backend/tests/ExpenseTracker.UnitTests/Middleware/SecurityHeadersMiddlewareTests.cs` (new)

**Why**: The audit found **no** security headers on responses. Without them, every XSS / clickjacking / MIME-sniff finding in a future ZAP scan blames the app, not the framework.

**What we add** (and why each value):

| Header | Value | Reason |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME-sniff attacks on user-controlled `Icon`/`Category.Name` (currently stored as plain text but the API returns JSON only; still defense-in-depth) |
| `X-Frame-Options` | `DENY` | Clickjacking — app has no iframe use case |
| `Referrer-Policy` | `no-referrer` | Don't leak `?token=…` style query strings to third parties (none exist today; future-proofing) |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` | Disable unused powerful APIs |
| `Content-Security-Policy` | `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` | Strict default; covers R1 + R18 |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Sent only in non-Development (R2 — see A2 for the `UseHsts()` overlap; HSTS header is added in A2 to keep A1 environment-agnostic) |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolation |
| `Cross-Origin-Resource-Policy` | `same-origin` | Isolation |
| `Cross-Origin-Embedder-Policy` | `require-corp` | Isolation |

> **Note on `script-src 'self'`**: The frontend is a separate Vite app served on a different origin, so this CSP applies to the **API's own** responses (the `/swagger` UI in Dev). The frontend gets its own CSP via `<meta>` (R13 in Phase D).

**Sub-steps**:
1. **Test first** — `SecurityHeadersMiddlewareTests`:
   - All 9 headers present on `/health` response
   - `X-Frame-Options` equals `DENY`
   - CSP contains `frame-ancestors 'none'` and `default-src 'self'`
   - `X-Frame-Options` is **not** sent twice (idempotency)
2. Implement `SecurityHeadersMiddleware` with a static header dictionary. HSTS excluded — that one is added by A2 via `UseHsts()` to avoid double-set.
3. Register in `Program.cs` immediately after `UseMiddleware<GlobalExceptionMiddleware>()` so even error responses get headers.
4. **Manual verify**: `curl -I http://localhost:5117/health` shows all 9 headers.
5. Update `docs/api-contract.md` with the headers table.

**Acceptance**:
- All 9 headers on every response from `/api/*` and `/health`.
- Unit tests pass.
- `dotnet format` clean.

**Branch**: `sec/a1-security-headers`

---

## A2. HTTPS enforcement & HSTS (R2)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (add HSTS + redirect)
- `backend/src/ExpenseTracker.Api/appsettings.Production.json` (new — empty config + comment)
- `backend/tests/ExpenseTracker.IntegrationTests/HttpsRedirectionTests.cs` (new)

**Why**: Currently nothing forces HTTPS. A misconfigured reverse proxy in front of this app would let refresh-token cookies travel in cleartext (their `Secure` flag is `IsHttps`-based, so they're set without `Secure` on plain HTTP — defense-in-depth gap).

**Sub-steps**:
1. **Test first** — `HttpsRedirectionTests`:
   - In `Production` environment, GET on HTTP redirects to HTTPS (301/302)
   - In `Development`, no redirect (current behavior preserved)
   - HSTS header present in Production response
2. Add `app.UseHsts()` (only outside Development) **before** `app.UseHttpsRedirection()`. HSTS sent with `max-age=31536000; includeSubDomains; preload` (configurable via options).
3. Add `app.UseHttpsRedirection()` outside Development.
4. Create `appsettings.Production.json` as a stub (empty sections) so Production config has a deterministic source.
5. Document in `docs/SPEC.md` "Deployment" section: reverse proxy must terminate TLS, app expects `X-Forwarded-Proto` if behind a proxy.

**Acceptance**:
- Production build redirects HTTP → HTTPS.
- HSTS header present, valid for 1 year.
- Development behavior unchanged.

**Branch**: `sec/a2-https-hsts`

---

## A3. `/health` response gating (R3)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (rewrite the `MapHealthChecks` block)

**Why**: Today `/health` returns `{ status, database: "Unhealthy", timestamp }` — this leaks DB connectivity state to any internet scanner. Not a credential leak, but aids targeting (e.g., "they use Postgres").

**Sub-steps**:
1. **Test first** — `HealthEndpointTests`:
   - In Production: response body is `{"status":"Healthy"}` only (200) or `{"status":"Unhealthy"}` only (503). No `database` field.
   - In Development: full payload (current behavior).
2. Refactor the `ResponseWriter` delegate to read `app.Environment` and choose a body accordingly. **Do not** remove the rich response from Development — engineers need it during deploy debugging.

**Acceptance**:
- Production `GET /health` body ≤ 30 bytes.
- Existing health-check status codes (200/503) preserved.
- No regression in Development mode.

**Branch**: `sec/a3-health-gating`

---

## A4. Move dev JWT secret out of tracked `appsettings.Development.json` (R5)

**Files**:
- `backend/src/ExpenseTracker.Api/appsettings.Development.json` (remove `Jwt:SecretKey`)
- `backend/src/ExpenseTracker.Api/Properties/launchSettings.json` (no change needed)
- `backend/src/ExpenseTracker.Api/Program.cs` (improve fail-fast message)
- `Makefile` (add `make dev-secrets` target)
- `docs/SPEC.md` (add "Local dev secrets" section)
- `README.md` (mention `dotnet user-secrets` in Quick Start)

**Why**: A 32-char dev secret is committed. The fail-fast in A2 (R5 in audit) only blocks Production, so Development continues to use whatever it finds. A future engineer copy-pasting Production config into Development would be misled. The fix: rely on `dotnet user-secrets` for dev — never store secrets in tracked files.

**Sub-steps**:
1. **No test** — pure config change. Smoke-test by running `dotnet run` after `dotnet user-secrets init` + `dotnet user-secrets set "Jwt:SecretKey" "DevSuperSecretKey_…"` and confirming the app starts.
2. Replace the `Jwt:SecretKey` value in `appsettings.Development.json` with `null` (and add a JSON comment via the existing file's structure — note: JSON has no comments; we'll use a sibling `_README.md` in the same directory).
3. Add `Makefile` target:
   ```make
   dev-secrets:
   	dotnet user-secrets init --project backend/src/ExpenseTracker.Api
   	dotnet user-secrets set "Jwt:SecretKey" "DevSuperSecretKey_ThisIsAtLeast32CharsLong!" --project backend/src/ExpenseTracker.Api
   	dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense" --project backend/src/ExpenseTracker.Api
   ```
4. Update the fail-fast message in `Program.cs` (line 56–63) to mention `dotnet user-secrets set Jwt:SecretKey …` for Development users who hit it.
5. Update `docs/SPEC.md` §Commands with the `make dev-secrets` step.
6. Verify: existing `dotnet test` still passes (tests use WebApplicationFactory which wires its own config).

**Acceptance**:
- `git grep -i "secret" -- appsettings.Development.json` returns no `SecretKey` line.
- New contributor can run `make db-up && make dev-secrets && make dev` to get a working local stack.

**Branch**: `sec/a4-dev-secrets`

---

## A5. Request body size limit (R6)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (configure Kestrel limits + Form options)
- `backend/src/ExpenseTracker.Api/Middleware/GlobalExceptionMiddleware.cs` (map `BadHttpRequestException` → 413)
- `backend/src/ExpenseTracker.Api/Controllers/{Auth,Transactions,Categories}Controller.cs` (`[RequestSizeLimit(64_000)]` on POST/PUT actions)
- `backend/tests/ExpenseTracker.IntegrationTests/Api/RequestSizeLimitEndpointsTests.cs` (new)
- `docs/SPEC.md`, `docs/api-contract.md` (document the limit)

**Why**: A single 30 MB JSON body to `/api/transactions` (where `Note` is 500 chars and `Amount` is 14 chars) is an obvious DoS amplifier. Kestrel's default 30 MB is 600,000× larger than the largest legitimate request.

**What we limit**:
- `KestrelServerOptions.Limits.MaxRequestBodySize = 64_000` (64 KB — generous headroom for a transaction with a long note)
- `FormOptions.MultipartBodyLengthLimit = 64_000` (no multipart in this app today, but cheap defense-in-depth in case a future upload route forgets to declare its own limit)
- Explicit `[RequestSizeLimit(64_000)]` on all POST/PUT action methods as defense-in-depth (Kestrel limit can be bypassed by misconfiguration)
- `GlobalExceptionMiddleware` maps `BadHttpRequestException` → 413 `application/problem+json` so Kestrel body-size rejections return a structured RFC 7807 response instead of leaking a 500.

**Sub-steps**:
1. **Test first** — `RequestSizeLimitEndpointsTests`:
   - POST `/api/transactions` with 100 KB JSON body → 413 (production Kestrel) or 400 (in-memory TestServer) — either proves the body is rejected.
   - POST `/api/transactions` with a normal 1 KB body → 201.
   - POST `/api/categories` with 100 KB body → 413 or 400.
2. Configure Kestrel limits in `Program.cs` via `builder.WebHost.ConfigureKestrel(opts => { opts.Limits.MaxRequestBodySize = 64_000; })`.
3. Configure `FormOptions.MultipartBodyLengthLimit = 64_000` via `builder.Services.Configure<FormOptions>(...)`.
4. Add `[RequestSizeLimit(64_000)]` to every POST/PUT action method in `TransactionsController`, `CategoriesController`, `AuthController` (6 mechanical additions — `ExportsController` has only GET endpoints, so no attribute needed there). `DashboardController` likewise has no POST/PUT today.
5. Add a `BadHttpRequestException` switch arm to `GlobalExceptionMiddleware.HandleExceptionAsync` so an oversize body returns 413 with `application/problem+json` instead of 500.

> **Implementation note**: Originally the plan called for a dedicated `RequestSizeLimitMiddleware.cs`. The actual implementation reuses the existing `GlobalExceptionMiddleware` to translate the Kestrel-thrown `BadHttpRequestException` into a 413 problem+json. This avoids adding a new middleware file and keeps the response shape consistent with every other error in the API.

> **Test caveat**: `WebApplicationFactory` (TestServer) does not enforce Kestrel's `MaxRequestBodySize` — oversized requests reach the model binder, which rejects them with a 400. The integration tests therefore assert `413 OR 400`. In a production Kestrel deployment, the 413 fires first and is the user-visible behavior.

**Acceptance**:
- 100 KB body → 413 in production Kestrel, 400 in TestServer (both = rejected).
- 1 KB valid body → 201.
- 413 response is `application/problem+json` with RFC 7807 `ProblemDetails`.
- Smoke test against `/health` still works (it has no body).

**Branch**: `sec/a5-body-size-limit`

---

## A6. Security-event audit log (R10)

**Files**:
- `backend/src/ExpenseTracker.Application/Abstractions/ISecurityEventLogger.cs` (new interface)
- `backend/src/ExpenseTracker.Infrastructure/Services/SecurityEventLogger.cs` (new impl using Serilog)
- `backend/src/ExpenseTracker.Application/Auth/AuthService.cs` (inject + log register/login success/failure/refresh/logout)
- `backend/src/ExpenseTracker.Api/Controllers/AuthController.cs` (log logout)
- `backend/src/ExpenseTracker.Infrastructure/Configuration/SecurityEventSettings.cs` (new — toggles + redaction)
- `backend/tests/ExpenseTracker.UnitTests/Auth/SecurityEventLoggerTests.cs` (new)

**Why**: OWASP **A09: Security Logging & Monitoring Failures**. Today, a brute-force attacker hammering `/api/auth/login` produces only one INFO log line per request — no way to distinguish "user doesn't exist" from "wrong password", no easy way to alert on 50 failures in 60 s, no audit trail for "who logged in as X at 3 AM".

**What we log** (structured fields, never the values themselves):

| Event | Fields | When |
|---|---|---|
| `auth.register.success` | `userId`, `email_hash` (SHA-256 of email, not email itself) | After `AddAsync` |
| `auth.register.failure.duplicate` | `email_hash` | When `ExistsByEmailAsync` is true |
| `auth.login.success` | `userId`, `email_hash` | After `_passwordHasher.VerifyPassword` |
| `auth.login.failure.unknown_user` | `email_hash` | When `FindByEmailAsync` returns null |
| `auth.login.failure.bad_password` | `userId`, `email_hash` | When `VerifyPassword` returns false |
| `auth.refresh.success` | `userId`, `old_token_id`, `new_token_id` | After `RotateAsync` |
| `auth.refresh.failure.invalid` | `token_id` (if extractable) | When `ValidateAsync` throws |
| `auth.logout.success` | `userId`, `token_id` | After `RevokeAsync` |

**Why hash email?** Emails are PII. Logging the raw email creates a parallel PII store in the log file. SHA-256 + truncation is enough to correlate across events (same email → same hash) without exposing the address.

**Sub-steps**:
1. **Test first** — `SecurityEventLoggerTests`:
   - Calling `LogRegisterSuccessAsync(userId, email)` writes a structured log with `EventId = "auth.register.success"`, `UserId = userId`, `EmailHash = sha256(email)`.
   - Log level = `Information` for success, `Warning` for failure.
   - Email is **not** present in the rendered log message.
2. Implement `ISecurityEventLogger` with the 8 methods above.
3. Inject into `AuthService`. Add try/catch around `_passwordHasher.VerifyPassword` to log `auth.login.failure.bad_password` before rethrowing.
4. Inject into `AuthController.Logout` (it has direct access to the cookie → can resolve `token_id` after `ValidateAsync`).
5. Add `Serilog` enricher in `Program.cs` to add `MachineName` + `ThreadId` (already present) **and** `TraceId` (added in C1).
6. Update `docs/SPEC.md` "Security Events" subsection with the event table above.

**Acceptance**:
- All 8 events written with the documented fields.
- `grep -i "email.*@" backend/src/ExpenseTracker.Api/logs/*.log` returns 0 matches.
- `grep "auth.login.failure" logs/` returns structured JSON.
- Unit tests pass.

**Branch**: `sec/a6-security-audit-log`

---

# Phase B — Hardening (next sprint)

> **Goal**: Defense-in-depth on auth, requests, and metadata leakage.
> **Exit criteria**: OWASP ZAP baseline + manual `curl` probes pass with no Medium+ alerts.

## B1. Global request rate limit (R7)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (add `GlobalRateLimit` policy)
- `backend/src/ExpenseTracker.Api/Controllers/*.cs` (`[EnableRateLimiting("GlobalRateLimit")]` on the 4 protected controllers)
- `backend/tests/ExpenseTracker.IntegrationTests/GlobalRateLimitTests.cs` (new)

**Why**: A single authenticated user can scrape `/api/transactions?pageSize=100` 100×/s and consume the whole DB connection pool. Auth-specific limit doesn't help.

**What we add**:
- `GlobalRateLimit` policy: 200 req/min **per IP** (sliding window), applied to all `[Authorize]`-bearing controllers.
- Auth-specific `AuthRateLimit` (5/min) stays untouched.

**Sub-steps**:
1. **Test first** — `GlobalRateLimitTests`:
   - 200 successful GETs to `/api/transactions` then a 201st → 429.
   - Counter resets after 60 s (assert with a fake time provider, or skip and document manual test).
2. Register `AddSlidingWindowLimiter("GlobalRateLimit", ...)` in `Program.cs`.
3. Add `[EnableRateLimiting("GlobalRateLimit")]` to `TransactionsController`, `CategoriesController`, `DashboardController`, `ExportsController`. **Not** on `AuthController` (it has its own policy).
4. Verify E2E tests still pass (they use `E2E_TESTS=true` to disable auth limit; we need a similar knob for global limit OR raise the global limit when E2E_TESTS=true — pick the latter, document the override).

**Acceptance**:
- 200 reqs pass, 201st returns 429.
- E2E suite (`npm run test:e2e`) still green.
- 5 reqs/min auth limit unchanged.

> **Implementation note (C-option deviation)**: The plan originally specified
> per-IP partitioning. The shipped implementation uses per-**user** (JWT `sub`
> claim), with IP as fallback for any future anonymous `[Authorize]`-free
> routes that opt into the same policy. Rationale:
>
> 1. Per-IP would require `UseForwardedHeaders` to be configured behind a
>    reverse proxy — it is not, and adding it expands trust of `X-Forwarded-For`
>    headers (RFC 7239 caveat). Per-user reads the verified JWT `sub` instead.
> 2. Per-user aligns with the R11 threat model (§B3): "IP-based rate limit
>    doesn't stop an attacker rotating IPs." B1 was always a defense-in-depth
>    complement to B3; making it per-user keeps the two layers consistent.
> 3. `HttpContextAccessor` and `ICurrentUserService` are already wired — no
>    new infrastructure.
>
> **Middleware ordering note**: `app.UseRateLimiter()` is registered **after**
> `app.UseAuthentication()` (and before `app.UseAuthorization()`) so the
> partition callback can read the authenticated `User` claims. Placing it
> before auth would force the per-user partition to fall back to IP for
> every request (since `User` is still anonymous), collapsing the per-user
> behavior back into a single IP bucket — the bug discovered during
> integration test development and locked down by
> `Rate_limit_is_per_user_not_shared_across_users`.
>
> The 200 req/min budget is preserved **per partition**. `AuthRateLimit`
> (5/min) keeps its single shared bucket because it guards anonymous auth
> traffic where there is no user id yet. Test
> `GlobalRateLimitTests.Rate_limit_is_per_user_not_shared_across_users`
> locks in the per-user behavior. `SPEC.md` and `api-contract.md` reflect
> this choice.

**Branch**: `sec/b1-global-rate-limit`

---

## B2. CSRF mitigation (R8)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (add antiforgery services)
- `backend/src/ExpenseTracker.Api/Controllers/AuthController.cs` (`[ValidateAntiForgeryToken]` on `Logout`)
- `backend/tests/ExpenseTracker.IntegrationTests/CsrfTests.cs` (new)

**Why**: Today, `POST /api/auth/logout` accepts a cookie with no CSRF protection. A same-site attacker page can call it. Same applies to any future cookie-auth endpoints. Defense-in-depth: even though `SameSite=Strict` blocks most cross-site abuse, a sub-domain takeover or browser bug could bypass it.

**What we add**:
- `AddAntiforgery(opts => { opts.HeaderName = "X-XSRF-TOKEN"; opts.Cookie.Name = "XSRF-TOKEN"; opts.Cookie.HttpOnly = false; })` — the standard double-submit cookie pattern.
- `[AutoValidateAntiforgeryToken]` on `AuthController` class → all its state-changing actions (Logout) require the header.
- Frontend reads the cookie via `axios` defaults and sets the header — done in D2.

**Sub-steps**:
1. **Test first** — `CsrfTests`:
   - `POST /api/auth/logout` with cookie but no `X-XSRF-TOKEN` header → 400.
   - Same with the header set to the cookie value → 204.
2. Register services in `Program.cs`.
3. Add `[AutoValidateAntiforgeryToken]` to `AuthController` (excludes `Register`/`Login`/`Refresh` — they're `[AllowAnonymous]` and don't yet need it; revisit if cookie auth is added).
4. Manually test with `curl` to confirm 400.

**Acceptance**:
- Missing header → 400.
- Matching header → 204.
- Unit + integration tests pass.

**Branch**: `sec/b2-csrf`

---

## B3. Per-account login lockout (R11)

**Files**:
- `backend/src/ExpenseTracker.Infrastructure/Migrations/<timestamp>_AddLoginLockout.cs` (new — schema change!)
- `backend/src/ExpenseTracker.Domain/Entities/User.cs` (add `FailedLoginCount`, `LockoutEnd` properties)
- `backend/src/ExpenseTracker.Infrastructure/Configuration/UserConfiguration.cs` (map new fields)
- `backend/src/ExpenseTracker.Application/Auth/AuthService.cs` (check + increment + reset)
- `backend/tests/ExpenseTracker.UnitTests/Auth/LoginLockoutTests.cs` (new)

> ⚠️ **Database schema change** — flagged in `.github/copilot-instructions.md` "Ask first". Obtain approval before starting B3.

**Why**: IP-based rate limit doesn't stop an attacker rotating IPs (or attacking a single user from a botnet). Account-based lockout is the right granularity.

**Policy**:
- 5 consecutive failures → 15-minute lockout
- Successful login resets the counter
- Lockout end is checked **before** password verification (cheap short-circuit, prevents timing oracle)

**Sub-steps**:
1. **DB approval gate** — describe the migration in `#eng` channel; wait for one 👍.
2. **Test first** — `LoginLockoutTests`:
   - 5 bad-password attempts → 6th attempt returns `DomainValidationException("Account locked. Try again in …")` even with correct password
   - Successful login resets counter
   - Lockout end of 15 min ago → login succeeds
3. Migration adds two nullable columns: `failed_login_count int NOT NULL DEFAULT 0`, `lockout_end timestamptz NULL`.
4. `AuthService.LoginAsync`: read user (or `null`) → check `LockoutEnd` → if null, verify password → on fail, increment counter, set `LockoutEnd` if count >= 5 → on success, reset counter to 0, clear `LockoutEnd`.
5. Use a single SQL UPDATE for the counter increment to avoid a read-modify-write race (`UPDATE users SET failed_login_count = failed_login_count + 1 WHERE id = $1`).
6. Document in `docs/SPEC.md` "Account lockout" subsection.

**Acceptance**:
- 5 fails → 6th attempt blocked.
- Counter resets on success.
- Migration applies cleanly to a fresh DB and to a DB on the previous schema (idempotent).
- New integration test using `WebApplicationFactory` + real Postgres container verifies the path.

**Branch**: `sec/b3-login-lockout`

---

## B4. Swagger registration guarded by environment (R4)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (move `AddSwaggerGen` / `AddEndpointsApiExplorer` inside `if (IsDevelopment)`)
- `backend/tests/ExpenseTracker.IntegrationTests/SwaggerRegistrationTests.cs` (new)

**Why**: `AddSwaggerGen()` is unconditionally called. Even though `app.UseSwagger()` is gated, the metadata is still in the service container — and a future code path that exposes it (a custom OpenAPI middleware, a third-party library) would leak. Belt-and-suspenders.

**Sub-steps**:
1. **Test first** — `SwaggerRegistrationTests`:
   - In `Production`, `app.Services.GetService<Swashbuckle.AspNetCore.SwaggerGen.SwaggerGeneratorOptions>()` returns null.
   - In `Development`, returns non-null.
2. Wrap `AddEndpointsApiExplorer()` and `AddSwaggerGen()` in `if (builder.Environment.IsDevelopment()) { … }`.
3. `app.UseSwagger()` block already gated — no change needed there.

**Acceptance**:
- Production: no Swagger services registered.
- Development: `GET /swagger/v1/swagger.json` still works.

**Branch**: `sec/b4-swagger-guard`

---

## B5. CORS `PreflightMaxAge` (R16)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (one line)

**Why**: Browsers re-issue preflights on every state-changing request without `PreflightMaxAge`. With our CORS policy, every `POST /api/transactions` carries an extra OPTIONS round trip. Minor perf, but worth fixing.

**Sub-steps**:
1. **No test** — pure config; manual `curl -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" http://localhost:5117/api/transactions -I` should show `Access-Control-Max-Age: 600`.
2. Add `.SetPreflightMaxAge(TimeSpan.FromMinutes(10))` to the CORS policy.

**Acceptance**:
- `Access-Control-Max-Age: 600` header on preflight responses.

**Branch**: `sec/b5-cors-preflight`

---

# Phase C — Observability & Audit (week 2)

> **Goal**: When an incident happens, we can answer "what happened, when, to whom" in 5 minutes.
> **Exit criteria**: A simulated brute-force attack produces a coherent audit trail in 5 minutes without log-file reading.

## C1. Request-ID propagation in Serilog (R17)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs` (add `UseSerilogRequestLogging` options)
- `backend/src/ExpenseTracker.Api/Middleware/RequestIdMiddleware.cs` (new — emit + accept `X-Request-Id`)
- `backend/src/ExpenseTracker.Infrastructure/Services/SecurityEventLogger.cs` (include request-id in all events)

**Why**: A user reports "I can't log in" — we need to find their request across 4 services (frontend log, API log, Serilog, DB slow-query log). Today there's no common correlation ID.

**Sub-steps**:
1. **Test first** — `RequestIdMiddlewareTests`:
   - Incoming `X-Request-Id: abc-123` is echoed back in the response header.
   - Missing header → middleware generates a `Guid.NewGuid().ToString("N")` and uses it.
2. Implement middleware: read `X-Request-Id` header, generate if missing, push into `HttpContext.TraceIdentifier`, push into Serilog `LogContext` as `RequestId`.
3. Update `GlobalExceptionMiddleware` to include `RequestId` (not `TraceIdentifier`) in the `traceId` extension field — `TraceIdentifier` is per-request but the same value, so it's fine; we'll add `RequestId` as a separate field that propagates to upstream callers.

**Acceptance**:
- `curl -H "X-Request-Id: test-1" http://localhost:5117/health -I` shows `X-Request-Id: test-1` echoed.
- Serilog output contains `[RequestId: test-1]`.

**Branch**: `sec/c1-request-id`

---

## C2. Trace-ID disclosure gated by environment (R9) ✅ implemented 2026-06-28

**Files**:
- `backend/src/ExpenseTracker.Api/Middleware/GlobalExceptionMiddleware.cs` (inject `IWebHostEnvironment`; gate `traceId` extension by `IsDevelopment()`)
- `backend/tests/ExpenseTracker.UnitTests/Middleware/GlobalExceptionMiddlewareTests.cs` (new — 8 tests covering Development includes, Production/Staging/Test omit, other ProblemDetails fields preserved, success responses untouched)
- `backend/tests/ExpenseTracker.UnitTests/ExpenseTracker.UnitTests.csproj` (added `<ProjectReference>` to `ExpenseTracker.Api` so the middleware type is reachable from unit tests)
- `docs/api-contract.md` (errors row + the example JSON block)

**Files**:
- `backend/src/ExpenseTracker.Api/Middleware/GlobalExceptionMiddleware.cs` (one condition)

**Why**: The `traceId` field in error responses helps engineers debug but also gives attackers a correlation handle. Trade-off: useful in Dev, leaky in Prod.

**Sub-steps**:
1. **Test first** — `GlobalExceptionMiddlewareTests`:
   - In Development: error response includes `traceId`.
   - In Production: error response omits `traceId` (but still logs it server-side).
2. Wrap the `problemDetails.Extensions["traceId"]` block in `if (app.Environment.IsDevelopment())`. Resolve the env via `IWebHostEnvironment` injected into the middleware.

**Acceptance**:
- Dev: `traceId` present.
- Prod: `traceId` absent from response body, present in server logs.

**Branch**: `sec/c2-trace-id-gate`

---

## C3. Frontend refresh interceptor `withCredentials` consistency (R12) ✅ implemented 2026-06-28

**Files**:
- `frontend/src/lib/apiClient.ts` (replaced the raw `axios.post(...)` with `apiClient.post('/api/auth/refresh', null, { headers: { 'X-Refresh-Request': '1' } })`; added a matching short-circuit in the response interceptor so a 401 on the refresh request itself is not retried)
- `frontend/tests/unit/apiClient.test.ts` (replaced the previous "passes withCredentials: true for cookie-based refresh" test — which was actually asserting the buggy hand-built-URL behavior — with two new tests: one asserts the refresh goes through `apiClient.post('/api/auth/refresh', ...)` with the `X-Refresh-Request` sentinel, the other pins the `withCredentials: include` propagation through the refresh call)
- `docs/api-contract.md` (added a "Client note (C3 / R12)" callout under the `/api/auth/refresh` table)

**Why**: The refresh interceptor previously used a raw `axios.post` with
`withCredentials: true` and a hand-built URL of
`` `${import.meta.env.VITE_API_URL}/api/auth/refresh` ``. If `VITE_API_URL`
ends with a trailing slash, the produced URL is `http://…//api/auth/refresh`
(double slash) — the refresh cookie isn't sent on the same path the main
client uses, the refresh fails, and the user is silently logged out. We
should use the configured `apiClient` instance, which delegates URL-joining
to axios and reuses the same `baseURL` and `withCredentials: true` for
every request.

**Sub-steps**:
1. **Test first** — `apiClient.test.ts`: spy on `apiClient.post` and assert the refresh call goes through it (not raw `axios.post`) with the `X-Refresh-Request: '1'` sentinel. The test was RED before the fix because the raw `axios.post` call didn't trigger the spy.
2. Replace the raw `axios.post` with `apiClient.post('/api/auth/refresh', null, { headers: { 'X-Refresh-Request': '1' } })` so it uses the same `baseURL` and `withCredentials`.
3. Add a short-circuit in the response interceptor so a 401 on the refresh request (identified by the `X-Refresh-Request` header) is not retried — otherwise routing the refresh through `apiClient` (instead of raw `axios`) introduces an infinite "refresh-the-refresh" loop.

**Acceptance**:
- Refresh flow works against `/api/auth/refresh` regardless of `VITE_API_URL` value (no double-slash in the URL).
- No infinite refresh loop (the `X-Refresh-Request` sentinel short-circuits the interceptor).
- All 149 frontend tests pass; typecheck and lint clean; prettier clean on touched files.

**Branch**: `sec/c3-refresh-interceptor`

---

## C4. Auth provider loading-state correctness (R21)

**Files**:
- `frontend/src/features/auth/AuthContext.tsx` (the `isLoading` flag handling)

**Why**: The audit caught a corner case: if the initial silent-refresh call rejects with a non-401 error (e.g., 5xx), `setIsLoading(false)` still fires in the `finally` block, so the UI proceeds. That's actually correct, but the more subtle issue is that if `setIsLoading` runs twice in the same render (once in try, once in finally — no, it doesn't, but worth verifying), or if the catch block swallows the error silently leaving `isLoading = true` forever. Confirm and fix.

**Sub-steps**:
1. **Test first** — `AuthContext.test.tsx` (already exists in `frontend/tests/unit/`):
   - On mount with 500 response: `isLoading` becomes `false` after settle.
   - On mount with successful refresh: `user` is set, `isLoading` becomes `false`.
2. Verify current code path; if correct, document. If a path is wrong, fix.

**Acceptance**:
- All paths out of the initial refresh set `isLoading = false`.
- No new lint warnings.

**Branch**: `sec/c4-auth-loading`

---

# Phase D — Frontend Hardening (week 2–3)

## D1. Frontend CSP `<meta>` tag (R13) ✅ Done (PR `sec/d1-frontend-csp`)

**Files**:
- `frontend/index.html` (add `<meta http-equiv="Content-Security-Policy" content="…">`)
- `frontend/vite.config.ts` (add CSP-Reporting-Only header in dev for testing)

**Why**: Backend has CSP (A1) for its own responses, but the frontend (served as static files) gets no CSP. Any future `dangerouslySetInnerHTML` slip would be unmitigated.

**Value**:
```
default-src 'self';
img-src 'self' data: blob:;
style-src 'self' 'unsafe-inline';
script-src 'self';
font-src 'self' data:;
connect-src 'self' http://localhost:5117 ws://localhost:5173;
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

> Note `connect-src` allows `http://localhost:5117` for the API. In prod, the API is on the same origin (reverse proxy) so this becomes just `'self'`. We'll use a Vite env var to switch.

**Sub-steps**:
1. **Test first** — Lighthouse audit passes "No CSP" warning.
2. Add `<meta>` tag. Use `import.meta.env.VITE_API_ORIGIN` to build the `connect-src` value.
3. Verify all current feature pages load (no inline scripts blocked — there shouldn't be any).

**Acceptance**:
- Lighthouse "Best Practices" score unchanged or improved.
- No console errors on any route.

**Branch**: `sec/d1-frontend-csp`

---

## D2. Frontend CSRF token wiring

**Files**:
- `frontend/src/lib/apiClient.ts` (read `XSRF-TOKEN` cookie, set `X-XSRF-TOKEN` header on all state-changing requests)

**Why**: Backend (B2) now requires the header. Frontend must send it.

**Sub-steps**:
1. **Test first** — `apiClient.csrf.test.ts`:
   - GET request doesn't carry the header.
   - POST request carries the header if the cookie exists.
2. Add a `xsrfCookieName` / `xsrfHeaderName` config to the axios instance (axios supports this natively for same-origin cookies; for cross-origin, do it manually with a request interceptor).
3. Document the read pattern in `frontend/README.md` (none exists today — small addition).

**Acceptance**:
- After B2 + D2 combined: POST `/api/auth/logout` works from the frontend.
- E2E tests green.

**Branch**: `sec/d2-frontend-csrf`

---

## D3. Subresource integrity for any future external scripts (R14)

**Files**: None today. Document the rule.

**Why**: The audit found no external scripts. If anyone later adds a CDN, the rule must be "every `<script src>` and `<link href>` to a non-`self` origin MUST have `integrity="sha384-…"` and `crossorigin="anonymous"`".

**Sub-steps**:
1. Add a section to `frontend/README.md`: "External script policy".
2. Add a comment in `frontend/index.html` near the existing `<head>` content: `<!-- If you add a CDN <script>, also add integrity + crossorigin. See README#external-scripts. -->`.

**Acceptance**: Doc-only change.

**Branch**: `sec/d3-sri-doc`

---

# Phase E — Documentation & Process (week 3)

## E1. Dependency audit in CI (R15)

**Files**:
- `.github/workflows/ci.yml` (or new `.github/workflows/security-audit.yml`)
- `Makefile` (add `make audit` target)

**Why**: Without automated CVE scanning, dependencies drift and the next big vuln (think `node-ipc`, `event-stream`, `colors`) catches us.

**Sub-steps**:
1. Create `.github/workflows/security-audit.yml`:
   - `dotnet list package --vulnerable --include-transitive` → fail on severity High or Critical
   - `npm audit --omit=dev --audit-level=high` → fail on High
   - Run weekly (cron) + on PRs that touch `*.csproj` or `package.json`
2. Add `make audit` local equivalent.
3. Document in `README.md` "Security" section.

**Acceptance**:
- CI workflow visible in the Actions tab.
- A test PR with a known-vulnerable dep fails the build (or we manually inject a vulnerable version to verify).

**Branch**: `sec/e1-ci-audit`

---

## E2. Document no-PII-encryption-at-rest decision (R22)

**Files**:
- `docs/adr/0008-pii-encryption-at-rest.md` (new ADR)

**Why**: A future engineer asking "why isn't `User.Email` encrypted?" needs a citable answer.

**Sub-steps**:
1. Use the [adr skill](d:\JamProject\ExpenseTracker\.github\skills\documentation-and-adrs\SKILL.md) template.
2. ADR content:
   - **Context**: Personal-finance app, multi-tenant, single Postgres instance
   - **Decision**: Email and DisplayName stored in plaintext; PasswordHash via BCrypt; RefreshToken via SHA-256
   - **Consequences**: DB file = PII. Disk-level encryption (e.g., AWS RDS encryption) is the compensating control. Document that this is required if hosted on a shared host.
   - **Alternatives considered**: column-level encryption (rejected — query complexity); field-level encryption via app (rejected — key management overhead)
3. Cross-link from `docs/SPEC.md` "Data protection" subsection.

**Acceptance**: ADR merged.

**Branch**: `sec/e2-pii-adr`

---

## E3. Threat-model ADR (covering STRIDE baseline)

**Files**:
- `docs/adr/0009-threat-model.md` (new ADR)

**Why**: The audit was an ad-hoc STRIDE walkthrough. Codify it so future features (e.g., file uploads, webhooks) have a reference.

**Sub-steps**:
1. Convert the audit's STRIDE table into the ADR's Context section.
2. Add a "How to extend" section: "When adding a new endpoint, add a row to the boundary table; if you can't fill the Authorization column, you have A01: Broken Access Control".
3. Link from each new PR's template.

**Acceptance**: ADR merged; PR template updated.

**Branch**: `sec/e3-threat-model-adr`

---

## E4. Update `docs/SPEC.md` "Security" section

**Files**:
- `docs/SPEC.md`

**Why**: The spec is the source of truth for "what the app does". It currently has no Security section.

**Sub-steps**:
1. Add a "Security" top-level section with subsections:
   - Authentication (BCrypt, JWT, refresh rotation)
   - Authorization (global query filter)
   - Transport (HSTS, HTTPS, CSP, COOP/COEP/CORP — references A1+A2)
   - Rate limiting (auth-specific + global — references A6 + B1)
   - Security event audit (references A6)
   - Account lockout (references B3)
   - Data at rest (PII plaintext — references E2)
2. Cross-link to ADRs.

**Acceptance**: Spec section merged.

**Branch**: `sec/e4-spec-security`

---

# Verification matrix (end of Phase A)

| Check | Tool | Pass criteria |
|---|---|---|
| Security headers on all responses | `curl -I` | All 9 headers present |
| HTTPS redirect in Production | `dotnet run` + `curl` | 301/302 to https |
| HSTS header | `curl -I` | `Strict-Transport-Security: max-age=31536000; includeSubDomains` |
| `/health` minimal body in Production | `curl /health` with `ASPNETCORE_ENVIRONMENT=Production` | Body ≤ 30 bytes, no `database` field |
| Body size limit | `curl -d @large.json` | 413 response |
| Audit log entries | `tail -f logs/expensetracker-*.log` | Structured JSON for each auth event |
| No secrets in tracked files | `git grep -i secret` | Zero matches in `appsettings.*.json` |
| All tests pass | `dotnet test && npm test` | Green |
| Format clean | `dotnet format --verify-no-changes && npm run format` | No diff |

---

# Out of scope (deferred)

- **R20 SSRF surface**: N/A — no server-side URL fetches. Re-evaluate if webhook / image-proxy features land.
- **R14 SRI for current externals**: N/A — no externals. See D3 for the policy.
- **Password reset flow**: Out of scope; not in current product surface. If added, must include: token expiry (≤ 1 hour), single-use, rate-limited, audit-logged.

---

# Sign-off

| Role | Name | Date |
|---|---|---|
| Tech lead | | |
| Security reviewer | | |
| Product owner | | |
