# ADR-0006: JWT Secret Length Validation at Startup

## Status

Accepted

## Context

The `Jwt:SecretKey` setting in `appsettings.json` ships with an empty string (`""`) by default. In Development mode a local dev secret is provided via `appsettings.Development.json`, but in a Production deployment the operator must supply a real key via an environment variable (`Jwt__SecretKey`), user-secrets, or a secrets manager.

If the operator forgets to set the key—or sets a short, easily guessable value—the application will silently start but produce JWT tokens signed with an empty or weak key. This is a critical security gap: an attacker can forge tokens for any user.

## Decision

Add a **fail-fast assertion** in `Program.cs` that runs during application startup in non-Development environments:

```csharp
if (!builder.Environment.IsDevelopment())
{
    if (string.IsNullOrWhiteSpace(jwtSettings.SecretKey) || jwtSettings.SecretKey.Length < 32)
        throw new InvalidOperationException(
            "Jwt:SecretKey must be at least 32 characters in non-Development environments. ...");
}
```

The assertion fires **before** the web host starts listening, so the container/orchestrator sees a crash immediately and can alert the operator.

Development environments are exempt because:
1. `appsettings.Development.json` contains a committed dev-only secret.
2. All integration tests run with `Environment=Development`.

## Consequences

- **Positive**: A misconfigured Production deploy crashes immediately instead of silently accepting forged tokens.
- **Positive**: The 32-char minimum aligns with the HMAC-SHA256 key-length recommendation (256 bits = 32 bytes).
- **Negative**: Operators who use short keys in staging-like environments (where `ASPNETCORE_ENVIRONMENT=Production`) must update their secrets.
- **Neutral**: The assertion is tested by three integration tests (empty key, short key, valid key).

## Alternatives Considered

1. **Log-and-continue**: Reject because a warning in logs is easy to miss during automated deploys.
2. **Validate at token-issuance time only**: Reject because the app is already serving requests (health checks, Swagger) with an unsecured key.
3. **Use `DataProtection` key-ring length rules**: Overly complex for a symmetric JWT key.

## Follow-Up

If the application scope expands beyond personal finance, add JWT key rotation and per-tenant secret management. For now, the single static key validated at startup is sufficient.
