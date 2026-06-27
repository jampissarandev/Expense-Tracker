# PR: A4 — Move dev JWT secret out of tracked `appsettings.Development.json` (R5)

## Summary

Removes the dev JWT signing key and the dev DB connection string from
the tracked `appsettings.Development.json` and routes both through
`dotnet user-secrets` instead. This closes a P0 finding (R5) from the
2026-06-27 security audit: a 32-char dev secret was committed to the
repo, and any future engineer who copy-pasted `appsettings.Development.json`
into a Production config would have leaked it.

**Severity:** P0 (Phase A — production gate)
**Refs:** [`docs/plans/security-hardening.md` A4](docs/plans/security-hardening.md) · audit R5
**Branch:** `sec/a4-dev-secrets` ← `sec/a2-https-hsts` (i.e. stacked on A1+A2+A3)

## Why this matters

A committed dev secret:

1. **Lives in git history even after deletion** — `git log -p` will show it
   forever, and any cloned fork has it.
2. **Misleads future engineers** — copying `appsettings.Development.json`
   into a `appsettings.Production.json` is a natural pattern; with a
   pre-filled `SecretKey` field, an operator might not realize the file
   is no longer the source of truth in non-Dev.
3. **Bypasses the R-3 fail-fast** — the fail-fast in `Program.cs` only
   fires in *non-Development* environments, so Development continued to
   use the committed secret indefinitely.

## What changes

| File | Change | Why |
|---|---|---|
| `backend/src/ExpenseTracker.Api/appsettings.Development.json` | Remove `Jwt:SecretKey` and `ConnectionStrings:DefaultConnection` | The actual fix — no secret value in a tracked file |
| `backend/src/ExpenseTracker.Api/appsettings.Development.README.md` *(new)* | Document what stays in this file and how to populate the rest | JSON has no comments; the sibling README is the discoverable explanation |
| `backend/src/ExpenseTracker.Api/Program.cs` | Improve fail-fast message: name the exact `dotnet user-secrets set` command | R-3 audit message was vague — operators had to guess the verb and project flag |
| `backend/src/ExpenseTracker.Api/ExpenseTracker.Api.csproj` | Add `UserSecretsId` (stable per-project GUID) | Required for `dotnet user-secrets` to find its store. Not a secret — just names a local file |
| `Makefile` | Add `dev-secrets` target (init + set `Jwt:SecretKey` + set `ConnectionStrings:DefaultConnection`) | One command for new contributors |
| `README.md` | Quick Start step 3: `make dev-secrets` before backend run | Discoverability |
| `docs/SPEC.md` | Add `make dev-secrets` to Commands section | Spec stays in sync with bootstrap procedure |

### Test-suite guard

To keep the integration tests runnable on a fresh CI runner that has
not run `make dev-secrets` (and now that the secret is no longer
in `appsettings.Development.json`), A4 also adds a tiny `TestSettings`
helper plus a defensive `UseSetting("Jwt:SecretKey", TestSettings.JwtSecretKey)`
on every `WebApplicationFactory` fixture:

- `backend/tests/ExpenseTracker.IntegrationTests/TestSettings.cs` *(new)*
- 8 endpoint test files — single-line addition each
- `backend/tests/ExpenseTracker.IntegrationTests/Api/HttpsRedirectionTests.cs` — refactor to use `TestSettings.JwtSecretKey` (the inline `const string` was duplicated; consolidating is a free win)
- `backend/tests/ExpenseTracker.IntegrationTests/Api/JwtSecretValidationTests.cs` — **3 new tests** assert the A4 fail-fast message contains `user-secrets`, `Jwt__SecretKey`, and the literal `dotnet user-secrets set` verb. This is the test the plan called "no test needed" for, but the message content is a real contract worth pinning.

## Why no secret value leaks

The string `DevSuperSecretKey_ThisIsAtLeast32CharsLong!` appears in:

- `Makefile` — the `dev-secrets` target's *default* value, which a
  developer can override with their own. This is a build-time default
  passed to `dotnet user-secrets set`. The Makefile is committed, but
  the *secret value never leaves the developer's machine* — it lives
  in `%APPDATA%\Microsoft\UserSecrets\<id>\secrets.json`.
- `appsettings.Development.README.md` — same default, documented for
  copy-paste. Same reasoning.

Neither file is the source of truth at runtime in any environment.
The Production fail-fast (R-3) still requires `Jwt:SecretKey` ≥ 32
chars from env var / user-secrets / secrets manager — and the test
`JwtSecretValidationTests.Production_fail_fast_message_mentions_user_secrets_set_command`
pins that the message names the correct command.

## Verification

Run from repo root:

```bash
# 1. Acceptance: no SecretKey in tracked config
git grep -in "secretkey" backend/src/ExpenseTracker.Api/appsettings.Development.json
# (no output)

# 2. dotnet test
cd backend && dotnet test
# Passed!  - Failed: 0, Passed: 232, Skipped: 0

# 3. dotnet format
dotnet format --verify-no-changes
# (exit 0)

# 4. dotnet user-secrets list (after make dev-secrets)
dotnet user-secrets list --project backend/src/ExpenseTracker.Api
# Jwt:SecretKey = DevSuperSecretKey_ThisIsAtLeast32CharsLong!
# ConnectionStrings:DefaultConnection = Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense
```

## Acceptance criteria (from plan)

- [x] `git grep -i "secret" -- appsettings.Development.json` returns no `SecretKey` line
- [x] New contributor can run `make dev-secrets && make dev` to get a working local stack
- [x] `dotnet test` passes (UnitTests 124 + IntegrationTests 108 = **232/232**)
- [x] `dotnet format --verify-no-changes` passes
- [x] Fail-fast in non-Dev still works (`JwtSecretValidationTests.Production_empty_secret_key_throws_on_build`)
- [x] Fail-fast message names the actionable `dotnet user-secrets set` command (3 new tests pin this)

## Diff size

16 files changed, 92 insertions(+), 12 deletions(-) — under the ≤100 LOC/PR
target specified in `docs/plans/security-hardening.md` §Conventions.

## Out of scope

- No DB schema changes.
- No new runtime dependencies.
- No behavior changes outside the listed files.
- The dev convenience string in `make dev-secrets` is **not** a real
  secret — operators are expected to replace it. Production must use a
  real secrets manager (R-3 already enforces this).

## Follow-ups (separate PRs)

- A5 — request body size limit
- A6 — security-event audit log
- B1..B5 — Phase B hardening
