# scripts/

Helper scripts for local development, networking, and live smoke testing.

## Networking (Windows + WSL2)

### `db-portproxy.ps1`
Windows-side `netsh interface portproxy` setup so `localhost:5432` from a
Windows process reaches Postgres running inside WSL2. The WSL eth0 IP is
auto-detected. **Requires elevated PowerShell.**

| Command | Effect |
|---|---|
| `make db-portproxy` / `pwsh -File scripts/db-portproxy.ps1 add` | Add the portproxy rule |
| `make db-portproxy-remove` / `pwsh -File scripts/db-portproxy.ps1 remove` | Remove the rule |
| `make db-wsl-ip` / `pwsh -File scripts/db-portproxy.ps1 status` | Show the detected WSL IP and current rule |

Used by Phase 0 (P0.3 verification) and Phase 1–2 manual smoke. Not needed
when API + Postgres both run inside WSL (the current setup as of 2026-06-26).

## Phase 3 live smoke (CSV export)

These shell scripts hit a **live API** and verify behavior beyond the
unit/integration test suite. They are the artifacts behind the "manual smoke"
section of [docs/PLAN.md](../docs/PLAN.md) Checkpoint: Phase 3.

### Utilities

| Script | What it does | When to run |
|---|---|---|
| [`wait-api.sh`](wait-api.sh) | Polls an HTTP endpoint until the API is responding (default: `http://localhost:5117/api/auth/me`) | Before a smoke run if the API was just started |

### Smoke scripts

| Script | What it verifies | When to run |
|---|---|---|
| [`phase3-smoke.sh`](phase3-smoke.sh) | Full Phase 3 export flow: register → create txns → both export endpoints → filtered export → 401 → cross-user → logout | After any change to `ExportsController` / `ExportService` |
| [`phase3-smoke-cross-user.sh`](phase3-smoke-cross-user.sh) | Data isolation between users (regression guard for `Cross_user_export_does_not_leak_data`) | After any change that touches `userId` filtering on exports |
| [`phase3-smoke-csv-injection.sh`](phase3-smoke-csv-injection.sh) | `=cmd\|/c calc` note becomes `'=cmd\|/c calc` in the CSV (apostrophe prefix) | After any change to `SanitizeForCsvInjection` or `ExportService.WriteCsv` |

### Pre-requisites for any smoke script

1. Postgres is up: `make db-up`
2. Migrations are applied: `dotnet ef database update --project backend/src/ExpenseTracker.Infrastructure --startup-project backend/src/ExpenseTracker.Api`
3. API is running and reachable (default: `http://localhost:5117`). Override with `BASE=...` env var
4. `python3` on PATH (for JSON parsing)

### Examples

```bash
# Default (localhost)
./scripts/wait-api.sh          # wait for API
./scripts/phase3-smoke.sh      # then run the smoke

# From Windows pointing at the WSL API
wsl -e bash -lc "/mnt/d/JamProject/ExpenseTracker/scripts/wait-api.sh"
wsl -e bash -lc "/mnt/d/JamProject/ExpenseTracker/scripts/phase3-smoke.sh"

# Against a different host/port
BASE=http://172.20.60.2:5117 ./scripts/phase3-smoke.sh
```

> The smoke scripts use `mktemp` and a `trap EXIT` to clean up cookie jars and
> downloaded CSVs — safe to run repeatedly. Each run uses a timestamped email
> so it does not collide with prior runs.

## What was deleted (June 2026 cleanup)

One-off debug scripts from the initial Phase 3 verification were removed.
Their findings are preserved in [docs/PLAN.md](../docs/PLAN.md) Checkpoint:
Phase 3 and in `/memories/repo/phase-3-checkpoint.md`.

- `p3-dbg-lo.sh`, `p3-dbg-lo2.sh` — root-caused the `/api/auth/logout` 401
  (smoke-script issue: `[Authorize]` requires Bearer)
- `p3-dbg-tx.sh` — root-caused the `POST /api/transactions` 400 (amount is
  `string` in `CreateTransactionRequest` to preserve `decimal(18,2)` precision)
- `p3-dump.sh` — one-time probe of the `/api/categories` response shape
  (flat list, not paged)
- `p3-decode.sh` — one-time `python3` decode of the live CSV (BOM + Thai)
- `p3-utf8.sh` — one-time UTF-8 BOM byte verify
