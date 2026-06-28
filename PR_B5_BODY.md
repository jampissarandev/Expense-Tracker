# PR: B5 — CORS `PreflightMaxAge` (R16)

## Summary

Adds `.SetPreflightMaxAge(TimeSpan.FromMinutes(10))` to the `AllowFrontend` CORS
policy so browsers cache the preflight result for 10 minutes. Every state-changing
request from the SPA (POST/PUT/DELETE) no longer triggers an extra OPTIONS round
trip — the browser reuses the cached allow-list (origins, methods, headers,
credentials) for 600 seconds.

**Severity:** P1 (Phase B — hardening, next sprint)
**Refs:** [`docs/plans/security-hardening.md` §B5](docs/plans/security-hardening.md) · audit R16
**Branch:** `sec/b5-cors-preflight` ← `main`

## Why this matters

Without `PreflightMaxAge`, the browser issues a preflight `OPTIONS` before
**every** non-simple request — even when the allow-list has not changed. For
our SPA that means an extra round trip before every `POST /api/transactions`,
`PUT /api/categories`, `DELETE /api/categories/{id}`, etc. 600 seconds is
the pragmatic balance:

- **Long enough** to remove the per-mutation preflight during a typical user
  session (most users do all their mutations within 10 minutes).
- **Short enough** that a future CORS policy change (new origin, new header)
  propagates within a single session — no operator intervention needed.

The CORS spec caps `Access-Control-Max-Age` at 2 hours for Chromium-based
browsers; 10 minutes stays well below that limit and is also short enough
to be safe if a misconfiguration ships (the bad allow-list is forgotten
within 10 min regardless).

## What changes

| File | LOC | Change |
|---|---|---|
| `backend/src/ExpenseTracker.Api/Program.cs` | +9/-1 | `.SetPreflightMaxAge(TimeSpan.FromMinutes(10))` on the `AllowFrontend` policy + inline comment |
| `backend/tests/ExpenseTracker.IntegrationTests/Api/CorsEndpointsTests.cs` | +6/-0 | Pin `Access-Control-Max-Age: 600` on the existing preflight test |
| `docs/api-contract.md` | +2/-1 | CORS row updated to mention 10-min cache; Phase B implemented list updated |
| `docs/plans/security-hardening.md` | +6/-2 | §B5 marked implemented 2026-06-28; test-step rationale documented |

**Total:** +24/-4 across 4 files. No new dependencies. No schema changes.
No behavior changes outside the preflight cache TTL.

## Deviation from the plan

The plan called for **"No test — pure config"**. I added a 4-line assertion
to the existing `Preflight_request_with_valid_origin_returns_cors_headers`
test that pins `Access-Control-Max-Age: 600`. Rationale:

1. `CorsEndpointsTests` already exercises the exact preflight path; the
   assertion is a 4-line addition with zero new test fixtures.
2. The project's `.github/copilot-instructions.md` explicitly prefers
   "tests before code" and "run tests after every change" — adding
   regression insurance for a config knob is consistent with that
   guideline.
3. `WebApplicationFactory` (TestServer) **does** emit the header (verified
   below), so the test is not vacuous.

The plan is updated in place (`docs/plans/security-hardening.md` §B5) to
record the deviation and its rationale.

## Verification

```text
dotnet build          → 0 warnings, 0 errors
dotnet test           → 256/256 passed (139 UnitTests + 117 IntegrationTests)
                          • 4/4 CorsEndpointsTests pass (the 4th assertion
                            is the new Access-Control-Max-Age: 600 check)
dotnet format --verify-no-changes → exit 0
```

### Manual `curl` smoke test (recommended before merge)

Started the B5 build against `ASPNETCORE_ENVIRONMENT=Development` and ran
the preflight against three scenarios:

````
$ curl -i -X OPTIONS \
    -H "Origin: http://localhost:5173" \
    -H "Access-Control-Request-Method: POST" \
    -H "Access-Control-Request-Headers: content-type" \
    http://localhost:5117/api/auth/login

HTTP/1.1 204 No Content
Access-Control-Allow-Credentials: true
Access-Control-Allow-Headers: content-type
Access-Control-Allow-Methods: POST
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Max-Age: 600            ← B5 fix
Vary: Origin

$ curl -i -X OPTIONS \
    -H "Origin: http://localhost:4173" \
    -H "Access-Control-Request-Method: POST" \
    http://localhost:5117/api/transactions

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:4173
Access-Control-Max-Age: 600            ← B5 fix
Vary: Origin

$ curl -i -X OPTIONS \
    -H "Origin: http://malicious-site.com" \
    -H "Access-Control-Request-Method: POST" \
    http://localhost:5117/api/transactions

HTTP/1.1 204 No Content
(no Access-Control-* headers — invalid origin is correctly rejected,
 so the preflight result is not cached for unknown origins)
````

All three scenarios behave correctly. The test API was stopped after the
smoke run; no listener remains on port 5117.

## Standalone design

This branch is **independent of B1, B2, B3, B4** and of all Phase A
branches. It touches only:

- CORS policy configuration (1 line of effective change in `Program.cs`)
- 1 test assertion in an existing test (no new fixtures, no new test class)
- 2 doc files

No conflicts with the other Phase B branches.

## Checklist

- [x] Test added (4-line assertion pinning the new header)
- [x] All tests pass (`dotnet test` 256/256)
- [x] `dotnet format --verify-no-changes` exit 0
- [x] `dotnet build` clean (0 warnings, 0 errors)
- [x] `api-contract.md` updated (CORS row + Phase B implemented list)
- [x] Plan updated (`docs/plans/security-hardening.md` §B5)
- [x] Manual `curl` smoke test against a real Kestrel process (3 scenarios)

## Out of scope

- Per-origin or per-endpoint preflight cache tuning — 10 minutes is a
  global cap that matches the current single-policy CORS configuration.
- `Access-Control-Expose-Headers` — only relevant if a future endpoint
  returns custom response headers that JS needs to read (none today).
- CORS configuration for any production origin (deployment concern,
  not application config).
