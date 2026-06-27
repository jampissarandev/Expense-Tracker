## A2. HTTPS enforcement & HSTS (R2)

Implements Phase 6, section A2 of the security hardening plan: production-only HTTPS redirection + HSTS header emission.

**Refs**: `docs/plans/security-hardening.md` §A2 (R2)

### Why

Without HTTPS enforcement, a misconfigured reverse proxy in front of this app would let refresh-token cookies travel in cleartext. The `Secure` flag on the refresh-token cookie is set based on `IsHttps` of the request — so on plain HTTP, cookies are set without `Secure` (defense-in-depth gap). HSTS instructs browsers to refuse to connect over plain HTTP for `max-age` seconds.

### What changed

- `Program.cs` (+18): register `UseHttpsRedirection()` for non-Development environments only, and add a small inline middleware that emits the HSTS header directly. `UseHsts()` is **not** used because it requires the incoming request itself to be HTTPS, which fails behind a reverse proxy. Direct header emission works regardless of transport.
- `appsettings.Production.json` (new, +40): Production config stub with Serilog config + empty `Jwt:SecretKey` (must be supplied via `Jwt__SecretKey` env var or `dotnet user-secrets`).
- `HttpsRedirectionTests.cs` (new, +144): 4 integration tests covering HSTS header presence in Production (on both `/health` and `/api/*` responses), HSTS absence in Development, and Development's no-redirect behavior.
- `SPEC.md` (+18): new "Deployment (A2)" section documenting reverse proxy requirements (TLS termination, `X-Forwarded-Proto` header) and the HSTS preload eligibility note.

### HSTS value

```
max-age=31536000; includeSubDomains; preload
```

The `preload` directive makes the host eligible for the [HSTS preload list](https://hstspreload.org/#submission-requirements) once the operator confirms the submission requirements. The submission is **not** automatic — the operator must explicitly submit the domain to hstspreload.org.

### Verification

- `dotnet build`: 0 warnings, 0 errors.
- `dotnet test`: **226/226 passed** (124 UnitTests + 102 IntegrationTests).
- 4 new integration tests added under `Category=HttpsRedirection`.

### Manual smoke test (recommended before merge)

The 301 redirect itself is **not** testable in `WebApplicationFactory` (in-memory transport does not distinguish HTTP from HTTPS). Verify with curl:

```bash
ASPNETCORE_ENVIRONMENT=Production \
  Jwt__SecretKey=ThisIsAValidSecretKey_32Chars!!! \
  dotnet run --project backend/src/ExpenseTracker.Api
# In another terminal:
curl -I http://localhost:5117/health
# Expect: 301/302 redirect + Strict-Transport-Security header
```

### Standalone design

This branch is **independent of A1** (`sec/a1-security-headers`). The HSTS header is emitted by an inline middleware in `Program.cs` rather than `SecurityHeadersMiddleware`, so A2 can be merged and tested in isolation. When both A1 and A2 are merged, the HSTS header will be set by A2's inline middleware (idempotent — ASP.NET header indexer overwrites the value).

### Checklist

- [x] Failing tests written first (TDD)
- [x] All tests pass (`dotnet test` 226/226)
- [x] `dotnet format --verify-no-changes` (no formatting changes)
- [x] `dotnet build` clean
- [x] SPEC.md updated
- [x] Plan updated (working tree — see `docs/plans/security-hardening.md`)
- [ ] Manual curl smoke test in Production
- [ ] Reverse proxy config (out of scope — operator action)

### Out of scope

- Reverse proxy configuration (operator responsibility)
- HSTS preload submission (operator responsibility)
- HTTPS redirect 301 integration test (in-memory transport limitation; verified via curl)
