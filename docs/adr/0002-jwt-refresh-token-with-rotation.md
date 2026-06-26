# ADR-0002: JWT Access Token + Refresh Token with Rotation and HttpOnly Cookies

## Status

Accepted

## Date

2026-06-23

## Context

Expense Tracker requires multi-user authentication. The backend is stateless (ASP.NET Core Web API), and the frontend is a separate SPA (React + Vite). We need to decide:

1. How to authenticate API requests (session, JWT, API key, etc.)
2. How to manage token lifecycle (expiry, revocation, refresh)
3. How to store credentials on the client (localStorage, cookies, memory)

Key constraints:

- The project is single-backend + single-frontend (no mobile app, no third-party consumers)
- Security is important (multi-user financial data)
- Must support token revocation (logout, compromise detection)
- Avoid storing secrets in JavaScript-accessible storage (XSS risk)

## Decision

Use a **two-token JWT system**:

| Token | Lifetime | Storage (server) | Storage (client) | Claims |
|---|---|---|---|---|
| **Access token** | 15 minutes | Stateless (signed JWT) | JavaScript memory (React state) | `sub` (userId), `email`, `jti` |
| **Refresh token** | 7 days | SHA-256 hash in `refresh_tokens` table | `et_rt` HttpOnly + Secure + SameSite=Strict cookie | Opaque (40 random bytes, Base64) |

### Refresh token lifecycle

1. **Issuance**: On register/login, generate 40 crypto-random bytes, hash with SHA-256, store hash in DB. Send plaintext to client in `et_rt` cookie.
2. **Rotation**: On `/auth/refresh`, validate the presented token, **revoke** it (set `revoked_at`, record `replaced_by` pointing to new token), issue a new token pair. This is atomic (single `SaveChangesAsync`).
3. **Reuse detection**: If a revoked token is presented again, the entire rotation chain is revoked. The user must re-authenticate. This detects token theft.
4. **Revocation**: On logout, set `revoked_at` on the current token and clear the cookie.

### Cookie security

```
Name: et_rt
HttpOnly: true        (not accessible from JavaScript)
Secure: true          (HTTPS only, except in dev)
SameSite: Strict      (no cross-origin sending)
Path: /api/auth       (only sent to auth endpoints)
Expires: 7 days
```

### Access token

- Signed with HMAC-SHA256 using a server-side secret (`Jwt__SigningKey`)
- ClockSkew = 0 (no tolerance for expired tokens)
- Stored only in React state (memory) — lost on page refresh, which triggers a silent `/auth/refresh`

## Alternatives Considered

### Server-side sessions (ASP.NET Core Identity)

- **Pros**: Simple revocation, no token storage issues
- **Cons**: Requires sticky sessions or distributed cache (Redis), breaks stateless scaling, more infrastructure for a small project
- **Rejected**: Adds infrastructure complexity (Redis/session store) that is not justified for a single-server deployment

### JWT in localStorage

- **Pros**: Simple to implement, persists across tabs
- **Cons**: Vulnerable to XSS (any script can read `localStorage`); tokens cannot have `HttpOnly` protection
- **Rejected**: Storing financial auth tokens in XSS-accessible storage is an unacceptable risk

### Single long-lived JWT with refresh via re-login

- **Pros**: Simplest implementation
- **Cons**: Poor UX (forced re-login every 15 minutes), no way to revoke a compromised token without invalidating all tokens for a user
- **Rejected**: Not viable for a multi-user production app

### Opaque session tokens (no JWT)

- **Pros**: Server controls everything, simple revocation
- **Cons**: Requires a DB lookup on every request (performance), no stateless advantage
- **Rejected**: Defeats the purpose of a stateless API. The JWT access token avoids DB hits on every protected endpoint.

## Consequences

- **Security**: HttpOnly cookies prevent XSS token theft. Refresh token rotation + reuse detection limits the window of token compromise to a single use.
- **UX**: The access token expires silently; the frontend axios interceptor catches 401, calls `/auth/refresh` once, and retries. If refresh fails, the user is redirected to login.
- **Complexity**: The refresh token rotation logic (validate → revoke → issue → atomic save) is non-trivial but well-contained in `RefreshTokenService` and `AuthService`.
- **Revocation**: Logout revokes the refresh token, which effectively invalidates the session. The access token remains valid until its 15-minute expiry — an acceptable trade-off since the token is in memory and lost on tab close.
- **Database**: The `refresh_tokens` table accumulates revoked tokens. A background job to purge expired tokens (beyond 7-day expiry + grace period) may be needed at scale, but is not required for Phase 1.
