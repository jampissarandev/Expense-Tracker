# API Contract — Phase 1 (Backend)

> Living reference. Mirrors the implementation as of 2026-06-24 (P1.4–P1.7 complete).
> Anything documented here is verified by an integration test in `backend/tests/ExpenseTracker.IntegrationTests/`.
> When a DTO or status code changes here, the test must change with it.

---

## Base URL

- **Dev**: `http://localhost:5117` (from `backend/src/ExpenseTracker.Api/Properties/launchSettings.json`)
- **Override**: set `ASPNETCORE_URLS=http://localhost:5050` (or any port) before `dotnet run`
- All routes are prefixed with `/api` and **versioned implicitly by the host**; the contract below is the Phase-1 surface.

## Conventions

| Topic | Decision |
|---|---|
| Auth | `Authorization: Bearer <accessToken>` header on protected routes. Refresh token is sent only in the `et_rt` HttpOnly cookie. |
| Content-Type | All request and response bodies are `application/json; charset=utf-8` (UTF-8). |
| Currency | Single currency: THB. Amounts use `decimal(18,2)` server-side; exposed as **strings** in JSON to preserve precision across JS clients. |
| Money format | `"85.50"` (invariant culture, 2 dp max). The parser rejects thousands separators, currency symbols, and more than 2 decimal places — see `TransactionAmountParser` in `backend/src/ExpenseTracker.Application/Transactions/Validators/TransactionValidators.cs`. |
| Dates | `occurredOn` is a `DateOnly` — wire format `"YYYY-MM-DD"` (`2026-06-24`). Query parameters `from` / `to` accept the same shape. |
| Timestamps | `createdAt` / `updatedAt` / `refreshTokenExpiresAt` / `accessToken.expiresAt` are ISO-8601 with offset (e.g. `"2026-06-24T18:00:00+00:00"`). |
| IDs | UUID v4 (cryptographically random `Guid.NewGuid()`) — except for seeded system categories, which use deterministic Guids. |
| Errors | Always `application/problem+json` (RFC 7807) with `type`, `title`, `status`, `detail`, `instance`, `traceId`. See `GlobalExceptionMiddleware`. |
| Pagination | `?page=1&pageSize=20` — `pageSize` is capped at 100 (`TransactionFilter.MaxPageSize`). |
| Sorting | Transactions list defaults to `occurredOn DESC, createdAt DESC`. No client-side sort. |
| Cookies | Refresh cookie is `et_rt`, `HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, 7-day expiry, `Secure` only over HTTPS. |
| Rate limiting | 5 requests/minute on `/api/auth/*` endpoints (per IP). Other endpoints: no limit. |
| Body size limit | Maximum request body size is 64 KB. Oversized bodies are rejected with `413 Payload Too Large`. |
| CORS | Configured for `http://localhost:5173` (Vite dev origin) with credentials. |

---

## Endpoints

All routes under `/api`. Auth column: `public` = no token; `cookie` = refresh cookie only; `bearer` = access token in `Authorization` header.

| # | Method | Path | Auth | Purpose |
|---|---|---|---|---|
| 1 | POST | `/auth/register` | public | Create user; issue access token + refresh cookie |
| 2 | POST | `/auth/login` | public | Verify password; issue access token + refresh cookie |
| 3 | POST | `/auth/refresh` | cookie | Rotate refresh token; return new access + new cookie |
| 4 | POST | `/auth/logout` | bearer | Revoke refresh token; clear cookie |
| 5 | GET | `/auth/me` | bearer | Return the current user profile |
| 6 | GET | `/categories` | bearer | List system + user's own categories |
| 7 | GET | `/categories/{id}` | bearer | Get a single category (owner or system) |
| 8 | POST | `/categories` | bearer | Create a user-owned category |
| 9 | PUT | `/categories/{id}` | bearer | Update a user-owned category (403 on system) |
| 10 | DELETE | `/categories/{id}` | bearer | Delete a user-owned category (400 if transactions reference it) |
| 11 | GET | `/transactions` | bearer | List transactions, paged + filterable |
| 12 | GET | `/transactions/{id}` | bearer | Get a single transaction |
| 13 | POST | `/transactions` | bearer | Create a transaction |
| 14 | PUT | `/transactions/{id}` | bearer | Update a transaction |
| 15 | DELETE | `/transactions/{id}` | bearer | Delete a transaction (204) |
| 16 | GET | `/dashboard/summary` | bearer | Aggregations: current month, last 6 months, top-10 by category |
| 17 | GET | `/exports/transactions.csv` | bearer | Filtered transactions CSV (P3.1) |
| 18 | GET | `/exports/summary.csv` | bearer | Monthly summary CSV (P3.1) |
| 19 | GET | `/health` | public | Health check — DB ping + timestamp |

> Note: `/health` is mounted outside the `/api` prefix (at root).

---

## Schemas (request / response)

### 1. POST /api/auth/register

**Request**

```json
{
  "email": "alice@example.com",
  "password": "Password123!",
  "displayName": "Alice"
}
```

**Response — 200 OK** — sets `et_rt` cookie

```json
{
  "accessToken": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2026-06-24T18:15:00+00:00"
  },
  "refreshToken": "dG9rZW5fcmFuZG9tXzAxMjM0NTY3ODlBQkNERUYwMTIzNDU2Nzg5",
  "refreshTokenExpiresAt": "2026-07-01T18:00:00+00:00",
  "user": {
    "id": "9c0e...-...-...-...-...",
    "email": "alice@example.com",
    "displayName": "Alice"
  }
}
```

**Validation rules**

| Field | Rule |
|---|---|
| `email` | Required, valid email format, max 254 chars, unique |
| `password` | Required, min 8 chars (recommended ≥ 12 with mixed case + digit) |
| `displayName` | Required, 1–100 chars |

**Errors**

| Status | When |
|---|---|
| 400 | Validation failed (problem+json) **or** email already exists |
| 500 | Unexpected (logged) |

> **Security note — user enumeration:** the duplicate-email response is returned as `400 A user with email '<email>' already exists.`, which reveals whether an email is already registered. This is an **accepted trade-off for v1** — see [ADR-0007](../adr/0007-register-endpoint-enumeration.md). The 5 req/min/IP rate limit on `/api/auth/*` is the primary bulk-enumeration mitigation.

### 2. POST /api/auth/login

**Request**

```json
{ "email": "alice@example.com", "password": "Password123!" }
```

**Response** — same shape as register. 200 OK, sets `et_rt` cookie.

**Errors**

| Status | When |
|---|---|
| 400 | Validation failed |
| 401 | Wrong email or password (RFC 7807 problem+json; **identical** detail for both to avoid user-enumeration) |
| 429 | Rate limit exceeded (5 req/min on `/api/auth/*`) |

### 3. POST /api/auth/refresh

No request body. Reads `et_rt` cookie.

**Response — 200 OK**

```json
{
  "accessToken": { "token": "...", "expiresAt": "2026-06-24T18:30:00+00:00" },
  "refreshToken": "new_opaque_token",
  "refreshTokenExpiresAt": "2026-07-01T18:30:00+00:00",
  "user": { "id": "...", "email": "alice@example.com", "displayName": "Alice" }
}
```

Sets a new `et_rt` cookie (rotation). The old refresh token is **revoked** server-side. If a revoked token is presented again, the **whole rotation chain is revoked** (reuse detection) and the user must re-login.

**Errors**

| Status | When |
|---|---|
| 401 | Cookie missing, expired, revoked, or reused |

### 4. POST /api/auth/logout

Requires `Authorization: Bearer <accessToken>`. Revokes the refresh token in `et_rt` (if any), then clears the cookie.

**Response — 204 No Content**

### 5. GET /api/auth/me

**Response — 200 OK**

```json
{
  "id": "9c0e...-...-...-...-...",
  "email": "alice@example.com",
  "displayName": "Alice"
}
```

**Errors**

| Status | When |
|---|---|
| 401 | Missing or invalid bearer token |

### 6. GET /api/categories

**Response — 200 OK**

```json
[
  {
    "id": "00000000-0000-0000-0000-000000000001",
    "userId": null,
    "name": "Food",
    "type": "expense",
    "icon": "utensils",
    "color": "#FF6B6B",
    "isSystem": true,
    "createdAt": "2026-06-24T05:22:21+00:00"
  },
  {
    "id": "8f1a...-...-...-...-...",
    "userId": "9c0e...-...-...-...-...",
    "name": "Coffee",
    "type": "expense",
    "icon": "coffee",
    "color": "#8B4513",
    "isSystem": false,
    "createdAt": "2026-06-24T08:00:00+00:00"
  }
]
```

- System categories (`isSystem: true`, `userId: null`) come first, sorted by `type` then `name`.
- User categories follow, sorted by `createdAt DESC`.
- Visibility is enforced by the **global query filter** in `ExpenseTrackerDbContext.OnModelCreating` (see `p1-2-global-filter-added.md`).

### 7. GET /api/categories/{id}

**Response — 200 OK** — same shape as one element of the list array.

**Errors**

| Status | When |
|---|---|
| 404 | Category does not exist or belongs to another user |

### 8. POST /api/categories

**Request**

```json
{ "name": "Coffee", "type": "expense", "icon": "coffee", "color": "#8B4513" }
```

`type` is `"income"` or `"expense"`. `icon` and `color` are optional.

**Response — 201 Created** with `Location: /api/categories/{id}`. Body is the created `CategoryDto`.

**Validation rules** (FluentValidation)

| Field | Rule |
|---|---|
| `name` | Required, 1–50 chars |
| `type` | Must be `income` or `expense` |
| `icon` | ≤ 50 chars if present |
| `color` | Must match `^#[0-9A-Fa-f]{6}$` (e.g. `#FF6B6B`) if present |

**Errors**

| Status | When |
|---|---|
| 400 | Validation failed or duplicate `(userId, name, type)` |

### 9. PUT /api/categories/{id}

**Request**

```json
{ "name": "Coffee (revised)", "icon": "coffee", "color": "#A0522D" }
```

`type` is **immutable** once created.

**Response — 200 OK** — updated `CategoryDto`.

**Errors**

| Status | When |
|---|---|
| 400 | Validation failed |
| 403 | Target category is a system category (`isSystem = true`) |
| 404 | Category does not exist or belongs to another user |

### 10. DELETE /api/categories/{id}

**Response — 204 No Content**

**Errors**

| Status | When |
|---|---|
| 400 | Category is referenced by one or more transactions |
| 403 | Target category is a system category |
| 404 | Category does not exist or belongs to another user |

### 11. GET /api/transactions

**Query parameters** (all optional)

| Param | Type | Default | Notes |
|---|---|---|---|
| `type` | `income` \| `expense` | (none) | Filter by transaction type |
| `categoryId` | UUID | (none) | Filter by category |
| `from` | `YYYY-MM-DD` | (none) | Inclusive lower bound on `occurredOn` |
| `to` | `YYYY-MM-DD` | (none) | Inclusive upper bound on `occurredOn` |
| `page` | int | 1 | 1-indexed |
| `pageSize` | int | 20 | Max 100 |

**Response — 200 OK**

```json
{
  "items": [
    {
      "id": "tx-uuid",
      "categoryId": "cat-uuid",
      "categoryName": "Coffee",
      "type": "expense",
      "amount": "85.50",
      "occurredOn": "2026-06-24",
      "note": "Morning latte",
      "createdAt": "2026-06-24T08:00:00+00:00",
      "updatedAt": "2026-06-24T08:00:00+00:00"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalCount": 1,
  "totalPages": 1
}
```

Sort: `occurredOn DESC, createdAt DESC`. Empty result: `items: []`, `totalCount: 0`, `totalPages: 0`.

### 12. GET /api/transactions/{id}

**Response — 200 OK** — same shape as one element of the items array.

**Errors**

| Status | When |
|---|---|
| 404 | Transaction does not exist or belongs to another user |

### 13. POST /api/transactions

**Request**

```json
{
  "categoryId": "cat-uuid",
  "type": "expense",
  "amount": "85.50",
  "occurredOn": "2026-06-24",
  "note": "Morning latte"
}
```

`note` is optional. `amount` is a string for precision.

**Response — 201 Created** with `Location: /api/transactions/{id}`. Body is the created `TransactionDto` (with `categoryName` populated).

**Validation rules**

| Field | Rule |
|---|---|
| `categoryId` | Required, must be a real category visible to the user (system OR own) |
| `type` | Must match the category's `type` (mismatch → 400) |
| `amount` | Parseable as `decimal`, > 0, ≤ 999,999,999.99, ≤ 2 decimal places, **invariant culture** (no `"1,234.56"`, no `"$10"`) |
| `occurredOn` | Required, must not be in the future (UTC date comparison) |
| `note` | ≤ 500 chars if present |

**Errors**

| Status | When |
|---|---|
| 400 | Validation failed, type mismatch, or future date |
| 404 | Category does not exist (or belongs to another user) |

### 14. PUT /api/transactions/{id}

Same request body as create. Same validation rules.

**Response — 200 OK** — updated `TransactionDto`.

**Errors** — same as create, plus:

| Status | When |
|---|---|
| 404 | Transaction does not exist or belongs to another user |

### 15. DELETE /api/transactions/{id}

**Response — 204 No Content**

**Errors**

| Status | When |
|---|---|
| 404 | Transaction does not exist or belongs to another user |

### 16. GET /api/dashboard/summary

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `type` | `income` \| `expense` | (none → defaults to `expense` in the `byCategory` slice) | Filters the top-10 category breakdown only. Current-month and 6-month slices always include both income and expense. |

**Response — 200 OK**

```json
{
  "currentMonth": {
    "income": "50000.00",
    "expense": "12500.50",
    "balance": "37499.50",
    "year": 2026,
    "month": 6
  },
  "last6Months": [
    { "year": 2026, "month": 1, "income": "45000.00", "expense": "11000.00" },
    { "year": 2026, "month": 2, "income": "45000.00", "expense": "12500.00" },
    { "year": 2026, "month": 3, "income": "45000.00", "expense": "13000.00" },
    { "year": 2026, "month": 4, "income": "50000.00", "expense": "11000.00" },
    { "year": 2026, "month": 5, "income": "50000.00", "expense": "12000.00" },
    { "year": 2026, "month": 6, "income": "50000.00", "expense": "12500.50" }
  ],
  "byCategory": [
    { "categoryId": "...", "name": "Food", "total": "4500.00", "count": 24 },
    { "categoryId": "...", "name": "Transport", "total": "2200.00", "count": 12 }
  ]
}
```

- `last6Months` is **always 6 entries** — the 6 most recent calendar months including the current one. Months with no transactions are filled with zeros.
- `byCategory` is **top 10** by `total` DESC for the `type` filter (defaults to `expense`).
- All amounts are strings (invariant culture, 2 dp).

---

### 17. GET /api/exports/transactions.csv

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `type` | `income` \| `expense` | (none) | Filter by transaction type |
| `categoryId` | UUID | (none) | Filter by category |
| `from` | `YYYY-MM-DD` | (none) | Inclusive start date |
| `to` | `YYYY-MM-DD` | (none) | Inclusive end date |

**Response — 200 OK**

- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="transactions-YYYYMMDD.csv"`
- UTF-8 BOM prefix (`EF BB BF`) for Excel/Google Sheets compatibility
- CSV-injection guard: fields starting with `=`, `+`, `-`, `@`, `\t`, `\r` are prefixed with `'`
- All fields are double-quoted (safe for Thai characters)

**CSV columns (Thai headers):**

```csv
วันที่,ประเภท,หมวดหมู่,จำนวนเงิน,หมายเหตุ
2026-06-15,"ค่าใช้จ่าย","Food","150.50","Lunch"
2026-06-01,"รายรับ","Salary","50000.00","Monthly salary"
```

- `ประเภท` values: `รายรับ` (income) or `ค่าใช้จ่าย` (expense)
- `จำนวนเงน` is the raw decimal amount (invariant culture, 2 dp)

---

### 18. GET /api/exports/summary.csv

**Query parameters**

| Param | Type | Default | Notes |
|---|---|---|---|
| `from` | `YYYY-MM-DD` | (none) | Inclusive start date |
| `to` | `YYYY-MM-DD` | (none) | Inclusive end date |

**Response — 200 OK**

- Content-Type: `text/csv; charset=utf-8`
- Content-Disposition: `attachment; filename="summary-YYYYMMDD.csv"`
- UTF-8 BOM prefix (`EF BB BF`)

**CSV columns (Thai headers):**

```csv
เดือน,รายรับ,รายจ่าย,คงเหลือ
2026-01,"50000.00","30000.00","20000.00"
2026-02,"50000.00","28000.00","22000.00"
```

- `เดือน` format: `YYYY-MM`
- `คงเหลือ` = `รายรับ - รายจ่าย`

---

### 19. GET /health

No auth required. Mounted at root (`/health`), not under `/api`.

**Response — 200 OK**

```json
{
  "status": "Healthy",
  "database": "Healthy",
  "timestamp": "2026-06-26T12:00:00Z"
}
```

- `status`: Overall health status (`Healthy`, `Degraded`, `Unhealthy`)
- `database`: Database connectivity status (from `AddDbContextCheck`)
- `timestamp`: Current UTC time

**Errors**: Returns 503 if database is unreachable.

---

## Error envelope (RFC 7807)

Every non-2xx response (except 204) is `application/problem+json`:

```json
{
  "type": "https://httpstatuses.com/404",
  "title": "Not Found",
  "status": 404,
  "detail": "Category 8f1a-... does not exist.",
  "instance": "/api/categories/8f1a-...",
  "traceId": "0HNMHS495PA7J:00000003"
}
```

The exception-to-status mapping (see `GlobalExceptionMiddleware`):

| Exception | Status |
|---|---|
| `NotFoundException` | 404 |
| `ForbiddenException` | 403 |
| `DomainValidationException` | 400 |
| `RefreshTokenValidationException` | 401 |
| `UnauthorizedAccessException` | 401 |
| `FluentValidation.ValidationException` (auto) | 400 with `errors` field |
| anything else | 500 |

---

## Auth flow reference

```text
client                API                   DB
  |---register-------->|                     |
  |<--200 + set-cookie-+ access+refresh      |
  |---login----------->|                     |
  |<--200 + set-cookie-+ access+refresh      |
  |---(bearer) GET /me>|                     |
  |<--200 UserDto------+ auth claims→UserId  |
  |---(bearer) POST /transactions>          |
  |<--201 Created-------+ persist+return     |
  |---access token expires (15 min)         |
  |---cookie POST /api/auth/refresh>        |
  |<--200 + new cookie-+ rotate+revoke old  |
  |---(bearer) POST /logout>                |
  |<--204 + clear cookie-+ revoke refresh   |
```

---

## Test coverage map

Last verified 2026-06-25: **163 tests, all passing** (90 unit + 73 integration, 0 failed, 0 skipped).

| Endpoint / concern | Test file | Methods |
|---|---|---|
| `/auth/*` | `backend/tests/ExpenseTracker.IntegrationTests/Api/AuthEndpointsTests.cs` | 11 |
| `/categories/*` | `backend/tests/ExpenseTracker.IntegrationTests/Api/CategoriesEndpointsTests.cs` | 10 |
| `/dashboard/*` | `backend/tests/ExpenseTracker.IntegrationTests/Api/DashboardEndpointsTests.cs` | 8 |
| `/transactions/*` | `backend/tests/ExpenseTracker.IntegrationTests/Api/TransactionsEndpointsTests.cs` | 30 |
| `/exports/*` | `backend/tests/ExpenseTracker.IntegrationTests/Api/ExportsEndpointsTests.cs` | 11 |
| Migrations / seed / global filter | `backend/tests/ExpenseTracker.IntegrationTests/Persistence/MigrationsTests.cs` | 3 |
| Auth service | `backend/tests/ExpenseTracker.UnitTests/Auth/AuthServiceTests.cs` | 12 |
| Categories service | `backend/tests/ExpenseTracker.UnitTests/Categories/CategoryServiceTests.cs` | 17 |
| Transactions service | `backend/tests/ExpenseTracker.UnitTests/Transactions/TransactionServiceTests.cs` | 16 |
| Amount parser | `backend/tests/ExpenseTracker.UnitTests/Transactions/TransactionAmountParserTests.cs` | 4 |
| Domain — Category | `backend/tests/ExpenseTracker.UnitTests/Domain/CategoryTests.cs` | 1 |
| Domain — Transaction | `backend/tests/ExpenseTracker.UnitTests/Domain/TransactionTests.cs` | 2 |
| Export service | `backend/tests/ExpenseTracker.UnitTests/Exports/ExportServiceTests.cs` | 14 |

When a route or shape changes here, update the corresponding test in the same change.

---

## Implemented in P4.1

- `GET /health` — health check endpoint with DB ping ✅
- Rate limiting on `/api/auth/*` (5 req/min/IP) ✅
- CORS for the Vite dev origin (`http://localhost:5173`) ✅

## Deferred (P5+ / future)

- Pagination metadata `hasNext` / `hasPrevious` (currently derivable from `page` + `totalPages`)
- ETags / `If-Match` for optimistic concurrency on updates
