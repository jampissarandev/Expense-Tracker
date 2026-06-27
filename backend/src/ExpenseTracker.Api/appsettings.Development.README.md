# Local development secrets (appsettings.Development.json)

> **Why a sibling README instead of JSON comments?** JSON has no comment syntax.
> This file is co-located with `appsettings.Development.json` so the dev-only
> configuration story is discoverable in one place.

## What this app reads from `appsettings.Development.json`

Non-secret defaults only:

- `Serilog` log levels and sinks (debug-friendly, file + console)
- `Jwt.Issuer`, `Jwt.Audience`, `Jwt.AccessTokenExpirationMinutes`
- `RefreshToken.ExpirationDays`, `RefreshToken.TokenLengthBytes`

## What this app does **NOT** store here (intentionally)

- **`Jwt:SecretKey`** — must come from `dotnet user-secrets` or `Jwt__SecretKey` env var.
- **`ConnectionStrings:DefaultConnection`** — must come from `dotnet user-secrets` or `ConnectionStrings__DefaultConnection` env var.

A committed dev secret would (a) leak via git history even after deletion and
(b) mislead future engineers who copy-paste `appsettings.Development.json`
into a Production config.

## One-time setup for a new contributor

From the repo root:

```bash
make dev-secrets
```

This runs:

```bash
dotnet user-secrets init --project backend/src/ExpenseTracker.Api
dotnet user-secrets set "Jwt:SecretKey" "DevSuperSecretKey_ThisIsAtLeast32CharsLong!" --project backend/src/ExpenseTracker.Api
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense" --project backend/src/ExpenseTracker.Api
```

The user-secrets store lives outside the repo at:

- Windows: `%APPDATA%\Microsoft\UserSecrets\<user-secrets-id>\secrets.json`
- macOS/Linux: `~/.microsoft/usersecrets/<user-secrets-id>/secrets.json`

## Verifying your setup

```bash
dotnet user-secrets list --project backend/src/ExpenseTracker.Api
# Should print Jwt:SecretKey and ConnectionStrings:DefaultConnection
```

## Where the fail-fast lives

`Program.cs` (around line 56) refuses to start in non-Development environments
when `Jwt:SecretKey` is missing or shorter than 32 characters. The exception
message tells the operator how to fix it for both dev and prod.
