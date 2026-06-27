## A5. Request body size limit (R6)

Implements Phase 6, section A5 of the security hardening plan: a 64 KB cap on request bodies to remove the DoS amplifier that Kestrel's 30 MB default exposes.

**Refs**: `docs/plans/security-hardening.md` §A5 (R6)

### Why

A single 30 MB JSON body to `/api/transactions` (where `Note` is 500 chars and `Amount` is 14 chars) is an obvious DoS amplifier. Kestrel's default 30 MB is 600,000× larger than the largest legitimate request. 64 KB is generous headroom for a transaction with a long note (~200 bytes of overhead + payload).

### What changed

- `Program.cs` (+18): Kestrel global `MaxRequestBodySize = 64_000` + `FormOptions.MultipartBodyLengthLimit = 64_000` (defense-in-depth — no multipart endpoints exist today).
- `GlobalExceptionMiddleware.cs` (+2): map `BadHttpRequestException` → `413 Payload Too Large` with `application/problem+json` so Kestrel rejections don't leak as 500.
- `AuthController.cs` (+2): `[RequestSizeLimit(64_000)]` on `Register` and `Login`.
- `TransactionsController.cs` (+2): `[RequestSizeLimit(64_000)]` on `Create` and `Update`.
- `CategoriesController.cs` (+2): `[RequestSizeLimit(64_000)]` on `Create` and `Update`.
- `RequestSizeLimitEndpointsTests.cs` (new, +159): 3 integration tests covering oversized body on transactions + categories and a normal-body happy path.
- `docs/SPEC.md` (+1): "Request body size limit: 64 KB max" in Security Boundaries.
- `docs/api-contract.md` (+1): "Body size limit" row in Cross-cutting table.
- `docs/plans/security-hardening.md` (+20, -9): §A5 updated to match the actual implementation (reuses `GlobalExceptionMiddleware` rather than a dedicated middleware file; includes the FormOptions limit).

### How it works

Three layers of defense:

1. **Kestrel global ceiling** — `MaxRequestBodySize = 64_000` rejects oversized requests at the transport layer with `BadHttpRequestException`.
2. **Per-action attribute** — `[RequestSizeLimit(64_000)]` on every POST/PUT action provides defense-in-depth if Kestrel's limit is ever bypassed by misconfiguration (e.g. `IHttpMaxRequestBodySizeFeature` overrides).
3. **Structured error response** — `GlobalExceptionMiddleware` translates `BadHttpRequestException` into a 413 with an RFC 7807 `ProblemDetails` body, consistent with every other error in the API.

### Test caveat

`WebApplicationFactory` (TestServer) does **not** enforce Kestrel's `MaxRequestBodySize` — oversized requests reach the model binder, which rejects them with 400. The integration tests therefore assert `413 OR 400` for oversized bodies. In a production Kestrel deployment, 413 fires first and is the user-visible behavior.

### Verification

- `dotnet build`: 0 warnings, 0 errors.
- `dotnet test`: **235/235 passed** (124 UnitTests + 111 IntegrationTests; 3 new tests under `Category=RequestSizeLimit`).
- 64 KB Kestrel limit + Form options + per-action attributes in place.
- `dotnet format --verify-no-changes`: clean.

### Manual smoke test (recommended before merge)

The 413 from Kestrel's body-size limit is **not** testable in `WebApplicationFactory`. Verify with curl against a real Kestrel process:

````bash
ASPNETCORE_ENVIRONMENT=Development \
  Jwt__SecretKey=DevSuperSecretKey_ThisIsAtLeast32CharsLong! \
  dotnet run --project backend/src/ExpenseTracker.Api
# In another terminal (replace TOKEN with a real access token from /api/auth/register):
curl -i -X POST http://localhost:5117/api/transactions \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@<(python -c 'print("{\"amount\":\"1.00\",\"type\":1,\"categoryId\":\"00000000-0000-0000-0000-000000000000\",\"occurredOn\":\"2026-06-27\",\"note\":\"" + "X"*100000 + "\"}')")"
# Expect: HTTP/1.1 413 Request Entity Too Large + application/problem+json body
````

### Standalone design

This branch is **independent of A1, A2, A3, A4**. It touches only:
- Kestrel/Form options config in `Program.cs`
- 6 `[RequestSizeLimit]` attributes on POST/PUT actions
- One switch arm in `GlobalExceptionMiddleware` (no change to the existing 5xx/4xx/2xx flow)
- 3 new integration tests (no change to existing tests)
- 3 doc files

No conflicts with the other Phase A branches.

### Checklist

- [x] Failing tests written first (TDD)
- [x] All tests pass (`dotnet test` 235/235)
- [x] `dotnet format --verify-no-changes` clean
- [x] `dotnet build` clean
- [x] SPEC.md updated
- [x] api-contract.md updated
- [x] Plan updated (`docs/plans/security-hardening.md` §A5)
- [ ] Manual curl smoke test in Development (Kestrel)

### Out of scope

- Per-endpoint tighter limits (e.g. 16 KB on `Login`) — current 64 KB is a global cap; can be tightened per-action later.
- Multipart upload endpoint (not in scope; `MultipartBodyLengthLimit` is pre-emptive).
- Request streaming for large CSV exports (exports are GET-only, no request body).
