# Plan: Code Review — Required Fixes

> Origin: Multi-axis code review (5-axis) on 2026-06-27 after Phase 5.3.
> Source review findings: see conversation log 2026-06-27.
> Scope: Only **Required** severity items I judged worth doing. Optional / FYI items deferred.

## TL;DR

7 small, focused fixes across 5 PRs. Each PR is independently testable, has a clear acceptance criterion, and follows the project's TDD + small-increment rules. **No new dependencies, no schema changes, no behavior changes outside the listed fixes.**

## Required items — decision matrix

| # | Title | Verdict | Notes |
|---|---|---|---|
| #1  | Redundant `Where` in `TransactionRepository` | **Skip** | Working as defense-in-depth with an explanatory comment. Removing it is a "DRY for DRY's sake" change with no real benefit. |
| #3  | Duplicate `ParseDate` in two controllers | **Do** (R-1) | Real DRY + correctness issue: same input → different HTTP status (400 vs 500). |
| #12 | Multi-layer user isolation strategy | **Do** (R-2) | Security-critical. Code-trap today. |
| #17 | `Jwt:SecretKey` length assert at startup | **Do** (R-3) | Critical — prod deploy with empty key is silently broken. |
| #18 | `.gitignore` for dev secret | **Do** (rolled into R-3) | Same fix; one startup assertion covers both. |
| #19 | Document register enumeration | **Do** (R-4) | Lightweight ADR update. No code change. |
| #22 | Sanitize `Category` in CSV export | **Do** (R-5) | Real formula-injection vector. One-line fix. |
| #29 | Verify `HasTransactionsAsync` intent | **Do** (R-6) | Likely a design bug; needs decision before next category delete. |
| #39 | Logout-on-refresh-failure in `apiClient` | **Do** (R-7) | Auth-state drift today. |
| #40 | FE/BE rule drift (Zod vs FluentValidation) | **Skip** | Structural debt; needs tooling or ADR, not a 1-line fix. Out of scope. |

---

## Conventions for this plan

- **PR size**: target ≤100 lines changed per fix (per `.github/copilot-instructions.md`).
- **TDD**: failing test first for any behavior change. No test-first required for doc-only or refactor-only items.
- **Format / behavior separation**: one commit per fix. No drive-by formatting.
- **Verification**: each PR must run `dotnet test` + `npm test` + `dotnet format --verify-no-changes` + `npm run lint` + `npm run typecheck` before merge.
- **Branch naming**: `fix/review-<r-id>-<short-slug>` (e.g. `fix/review-r3-shared-date-parser`).

---

## R-1 — Shared `ParseDate` helper (`#3`)

**Files**:
- `backend/src/ExpenseTracker.Application/Common/DateOnlyParser.cs` (new)
- `backend/src/ExpenseTracker.Api/Controllers/TransactionsController.cs`
- `backend/src/ExpenseTracker.Api/Controllers/ExportsController.cs`
- `backend/tests/ExpenseTracker.UnitTests/Common/DateOnlyParserTests.cs` (new)

**Sub-steps**:
1. Write failing test: `DateOnlyParser.Parse("2026-06-27") == new DateOnly(2026,6,27)`; `Parse(null/empty)` returns null; `Parse("not-a-date")` throws `DomainValidationException` with the existing message.
2. Create `DateOnlyParser` static class in `Application/Common/` (single source of truth for both controllers).
3. Move logic from `TransactionsController.ParseDate` (uses `ArgumentException`) and `ExportsController.ParseDate` (uses `DomainValidationException`) into the helper. **Always throw `DomainValidationException`** so both endpoints return 400.
4. Replace both controllers' local helpers with a call to the shared one.
5. Add 5 unit tests covering: ISO date, ISO datetime, null, empty, garbage, 2-digit year (rejected).
6. Verify `dotnet test` green, integration tests for `TransactionsEndpointsTests` and `ExportsEndpointsTests` still pass (400 mapping preserved).

**Acceptance**:
- Both controllers route through the shared parser.
- `ParseDate("garbage")` returns 400 with `application/problem+json` on both endpoints (was: 500 on `/api/transactions`).
- Unit tests ≥ 5 pass.
- No diff in `git log --stat` larger than 50 lines net.

---

## R-2 — Single-source user isolation (`#12`)

**Files**:
- `backend/src/ExpenseTracker.Infrastructure/Persistence/TransactionRepository.cs`
- `backend/src/ExpenseTracker.Infrastructure/Persistence/CategoryRepository.cs`
- `backend/src/ExpenseTracker.Infrastructure/Persistence/ExpenseTrackerDbContext.cs` (doc only)
- `backend/tests/ExpenseTracker.IntegrationTests/Persistence/GlobalQueryFilterTests.cs` (new — proves the filter does its job)

**Decision**: Keep the global query filter (single source of truth for security). **Remove the redundant explicit `Where(t => t.UserId == userId)`** in the repository. Add a regression test that proves the global filter isolates users when the explicit `Where` is absent — if a future maintainer removes the global filter, the test fails.

**Sub-steps**:
1. Write failing test: register user A, create 3 transactions; register user B, query `/api/transactions` — must return 0 items. With the global filter removed, this should fail. Test will pass with the current implementation.
2. Add a comment on `ExpenseTrackerDbContext.OnModelCreating` explaining the **single source of truth** strategy and pointing to the regression test.
3. Remove the explicit `query.Where(t => t.UserId == userId)` in `TransactionRepository.ListAsync` (lines 18-22).
4. Remove the equivalent in `CategoryRepository` if present (it isn't — the global filter handles it).
5. Verify all integration tests pass; manually smoke two-user isolation per `phase-2-checkpoint.md` checklist.

**Acceptance**:
- Global filter remains the only isolation mechanism.
- `MigrationsTests.Global_Query_Filter_Isolates_Users` (existing) still passes.
- New `Persistence/GlobalQueryFilterTests.cs` proves the global filter does the work (3+ cases: list, get-by-id, dashboard).
- No diff larger than 30 lines net.

**Out of scope** (will be a separate ADR — see R-4):
- Whether to use a global filter vs explicit per-query filter in the long term.

---

## R-3 — JWT secret length assertion (`#17` + `#18`)

**Files**:
- `backend/src/ExpenseTracker.Api/Program.cs`
- `.gitignore` (root) — confirm dev secret is not ignored, but document the rule
- `docs/adr/0006-jwt-secret-validation.md` (new, short)

**Sub-steps**:
1. Write failing test: instantiate `WebApplicationFactory<Program>` with `Jwt:SecretKey=""` and `ASPNETCORE_ENVIRONMENT=Production`; assert app fails to build / throws on first use.
2. In `Program.cs` after `builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()!`, add:
   ```csharp
   if (!builder.Environment.IsDevelopment())
   {
       if (string.IsNullOrWhiteSpace(jwtSettings.SecretKey) || jwtSettings.SecretKey.Length < 32)
           throw new InvalidOperationException(
               "Jwt:SecretKey must be at least 32 characters in non-Development environments. " +
               "Set it via environment variable, user-secrets, or a secrets manager.");
   }
   ```
3. Update `.gitignore` comment (not a new rule — the dev secret is in `appsettings.Development.json` which is committed) to document the rule: "The dev secret in appsettings.Development.json is intentional for local dev only. Production must override via env var `Jwt__SecretKey`."
4. Write a short ADR (`0006-jwt-secret-validation.md`) explaining the fail-fast approach.
5. Verify `dotnet test` (all existing tests use `Environment=Development` and the dev secret, so they must still pass), and add a new test `Security/JwtSecretValidationTests` with 3 cases: empty key in Production → throws; short key in Production → throws; valid key in Production → no throw.

**Acceptance**:
- App refuses to start in Production with `Jwt:SecretKey` length < 32 or empty.
- All existing tests (which use Development) still pass.
- ADR explains the decision.
- No diff larger than 40 lines net.

---

## R-4 — Document register enumeration (`#19`)

**Files**:
- `docs/adr/0007-register-endpoint-enumeration.md` (new, short)
- `docs/api-contract.md` (one-line note)

**Sub-steps**:
1. Write a 30-line ADR: context, decision (accept the enumeration trade-off for v1 because the personal-finance threat model does not warrant the email-confirmation flow), consequences, follow-up (move to send-email-on-register pattern if/when the app leaves the personal-finance scope).
2. Add a one-line note in `docs/api-contract.md` under `POST /api/auth/register` — "Returns 400 on duplicate email; this is a known enumeration vector. See ADR-0007."

**Acceptance**:
- ADR + api-contract note published.
- No code changes.
- No test required (doc only).

---

## R-5 — Sanitize `Category` in CSV export (`#22`)

**Files**:
- `backend/src/ExpenseTracker.Application/Exports/ExportService.cs`
- `backend/tests/ExpenseTracker.UnitTests/Exports/ExportServiceCsvInjectionTests.cs` (new — `Theory` cases)

**Sub-steps**:
1. Write failing test: create a category with `Name = "=cmd|...`, create a transaction, call `BuildTransactionsCsvAsync`, assert the CSV cell starts with `'=`.
2. Apply `SanitizeForCsvInjection` to the `Category` field in `TransactionCsvRow` construction in [ExportService.cs:38-46](backend/src/ExpenseTracker.Application/Exports/ExportService.cs#L38-L46).
3. Add 4 `Theory` cases to the existing CSV-injection test file: `=`, `+`, `-`, `@` prefixes on category name.
4. Verify `dotnet test` and the existing `Transactions_csv_sanitizes_injection_prone_cells` test (note column) still pass.

**Acceptance**:
- `Category` column in `transactions.csv` is sanitized the same way as `Note`.
- New tests pass; existing tests still pass.
- No diff larger than 25 lines net.

**Optional follow-up** (not in this PR): update ADR-0004 to list the columns covered.

---

## R-6 — Verify and fix `HasTransactionsAsync` intent (`#29`)

**Files**:
- `backend/src/ExpenseTracker.Application/Categories/CategoryService.cs`
- `backend/src/ExpenseTracker.Infrastructure/Persistence/CategoryRepository.cs` (interface + impl)
- `backend/src/ExpenseTracker.Application/Abstractions/ICategoryRepository.cs`
- `backend/tests/ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs`

**Decision** (confirmed 2026-06-27, user choice = **A — per-user**): The guard is **per-user**, not global. A user can delete their own category only if **their own** transactions do not reference it. The alternative (global "any user has transactions" guard) was rejected because it would require cross-user queries and is out of scope for the current per-user data model.

The current `HasTransactionsAsync` *accidentally* implements per-user behavior because the global query filter limits the check to the caller's own transactions. The fix is to make the intent **explicit** in the method name, signature, and doc — so a future maintainer who removes or changes the global filter does not silently flip the semantics.

**Sub-steps**:
1. Rename `HasTransactionsAsync` to `HasTransactionsForUserAsync` and update the interface signature to take both `categoryId` and `userId`.
2. Update the implementation in `CategoryRepository` to filter by both fields **explicitly** (so the contract does not depend on the global query filter — defense-in-depth, like the explicit `Where` in `TransactionRepository`).
3. Update the call site in `CategoryService.DeleteAsync` to pass `userId`.
4. Add a test that proves the per-user semantics: user A creates a category + transaction; user B (without any transaction in that category) **can** delete it.
5. Update the test class docstring to document the per-user semantics explicitly.

**Acceptance**:
- Method name + signature + docstring all say "for this user".
- Implementation filters by both `CategoryId` and `UserId` — does not rely on the global filter for correctness.
- New test `Can_be_deleted_by_another_user_who_has_no_transactions` passes.
- No diff larger than 50 lines net.
- `dotnet test` — full suite still green.

---

## R-7 — Logout-on-refresh-failure in `apiClient.ts` (`#39`)

**Files**:
- `frontend/src/lib/apiClient.ts`
- `frontend/src/features/auth/AuthContext.tsx` (one method)
- `frontend/tests/unit/apiClient.test.ts` (new cases)

**Sub-steps**:
1. Write failing test: stub a 401 then a refresh-failure; assert the user is logged out client-side (token cleared).
2. Add a singleton-style `setLogoutHandler(fn)` in `apiClient.ts` (similar to the existing `setTokenGetter`).
3. In the refresh-failure branch, call the handler before rejecting.
4. In `AuthContext.tsx`, register the handler in a `useEffect` to call `setAccessToken(null); setUser(null)`. Do not navigate — the route guard handles that.
5. Add 2-3 new test cases covering: refresh failure clears state, queued requests are rejected, no double-logout when multiple requests fail concurrently.
6. Verify `npm test`, `npm run typecheck`, `npm run lint`.

**Acceptance**:
- After a failed refresh, `useAuth().user` is `null` and `useAuth().accessToken` is `null`.
- The user is redirected to `/login` on the next route render.
- All existing tests still pass.
- No diff larger than 60 lines net.

---

## Verification

After all 7 PRs are merged:

```bash
# Backend
cd backend
dotnet format --verify-no-changes
dotnet build -c Release
dotnet test

# Frontend
cd ../frontend
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

Plus the standard manual smoke (`scripts/smoke-test.py`) to confirm no behavior regression in the user-visible flows.

## Risks

- **R-2** is the riskiest (touches a security-critical path). Mitigation: ship behind a feature branch + extra manual smoke of the cross-user isolation scenarios before merge.
- **R-6** has a one-question dependency (intent of `HasTransactionsAsync`). Mitigation: ask the user before starting the implementation.
- **R-3** has zero risk in Development mode (where all existing tests run) but a real risk in any Production-shape deploy — verify the integration test for Production-env startup is solid.

## Out of scope (deferred)

- Optional severity items from the review (file 24+ Optional findings). Track in a separate "tech debt" issue.
- Version-string verification (`typescript: "~6.0.2"`, `vite: "^8.0.12"`, `axios: "^1.18.1"`) — these may be correct as of the project's date, but worth a separate verification pass.
- Frontend `TransactionType` enum value parsing (uses `0`/`1` numeric values — works but is brittle if backend reorders). Out of scope.
- Frontend rule drift (#40) — structural debt, needs tooling.

## Open questions

*(none — R-6 decision recorded 2026-06-27: per-user semantics, see R-6 above)*
