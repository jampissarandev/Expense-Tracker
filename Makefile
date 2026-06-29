.PHONY: db-up db-down db-reset db-wsl-ip db-portproxy db-portproxy-remove dev-secrets e2e e2e-build audit audit-backend audit-frontend

# --- Docker Postgres lifecycle -------------------------------------------------

db-up:
	docker compose -f docker/postgres.yml up -d

db-down:
	docker compose -f docker/postgres.yml down

db-reset:
	docker compose -f docker/postgres.yml down -v
	docker compose -f docker/postgres.yml up -d

# --- WSL2 port forwarding (Windows hosts only) ---------------------------------
# On Windows 11 + WSL2, `localhost:5432` from a Windows process does NOT
# reach Postgres in WSL by default (the WSL eth0 IP is NAT'd). The fix is
# `netsh interface portproxy` which requires admin. Use these targets on a
# Windows host when the API is on Windows but Postgres is in WSL.
#
# Detection: only adds/removes the rule on Windows. On macOS/Linux these
# are no-ops so the Makefile stays portable.
#
# Usage:
#   make db-portproxy         # add: localhost:5432 -> WSL eth0 IP:5432
#   make db-portproxy-remove  # remove the rule when done

db-wsl-ip:
	@powershell -NoProfile -Command "$$ip = ((wsl -d Ubuntu -- bash -c 'hostname -I' 2>$$null) -split '\s+')[0].Trim(); if ($$ip) { Write-Host $$ip } else { Write-Host 'WSL not detected' -ForegroundColor Yellow }"

db-portproxy:
	@powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-portproxy.ps1 add

db-portproxy-remove:
	@powershell -NoProfile -ExecutionPolicy Bypass -File scripts/db-portproxy.ps1 remove

# --- Local dev secrets (dotnet user-secrets) ---------------------------------
# Populates the per-developer user-secrets store with Jwt:SecretKey and the
# local Postgres connection string. Idempotent: `set` overwrites, `init` is
# safe to re-run (it only writes the UserSecretsId into the csproj if absent).
#
# Usage:
#   make dev-secrets   # one-time, per developer machine
#
# Stored at (outside the repo):
#   Windows : %APPDATA%\Microsoft\UserSecrets\<id>\secrets.json
#   macOS   : ~/.microsoft/usersecrets/<id>/secrets.json
#   Linux   : ~/.microsoft/usersecrets/<id>/secrets.json

dev-secrets:
	dotnet user-secrets init --project backend/src/ExpenseTracker.Api
	dotnet user-secrets set "Jwt:SecretKey" "DevSuperSecretKey_ThisIsAtLeast32CharsLong!" --project backend/src/ExpenseTracker.Api
	dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense" --project backend/src/ExpenseTracker.Api
	@echo "dev-secrets: populated. Verify with: dotnet user-secrets list --project backend/src/ExpenseTracker.Api"

# --- E2E tests (Playwright) --------------------------------------------------
# Prerequisites:
#   make db-up          (Postgres running)
#   Backend running on  http://localhost:5117
#
# Usage:
#   make e2e             — run Playwright specs against the live stack
#   make e2e-build       — install browsers + rebuild (after Playwright update)

e2e:
	cd frontend && npx playwright test

e2e-build:
	cd frontend && npx playwright install --with-deps chromium

# --- Dependency audit (R15 / E1) ---------------------------------------------
# Local equivalent of .github/workflows/security-audit.yml. Run before
# opening a PR that touches *.csproj or frontend/package.json.
#
#   make audit             — audit both backend (NuGet) and frontend (npm)
#   make audit-backend     — backend only
#   make audit-frontend    — frontend only
#
# Exit codes:
#   0 — no High/Critical vulnerabilities
#   1 — at least one High or Critical finding (printed above)
#
# Notes:
#   - `dotnet list package --vulnerable` is a *report* (always exits 0).
#     We grep the severity column and turn High/Critical into a failure
#     to match what the CI workflow does.
#   - `npm audit --audit-level=high` already exits non-zero on High/Critical,
#     so the `|| exit 1` is a belt-and-suspenders guard for older npm
#     versions that may not honor the flag.

audit: audit-backend audit-frontend

audit-backend:
	@echo "==> Auditing backend NuGet packages (transitive, fail on High/Critical)..."
	cd backend && dotnet list package --vulnerable --include-transitive > vulnerable.txt
	@if grep -E "(^|[^a-zA-Z]) (High|Critical)([[:space:]]|$)" backend/vulnerable.txt; then \
		echo ""; \
		echo "ERROR: backend has High/Critical NuGet vulnerabilities. See backend/vulnerable.txt."; \
		exit 1; \
	fi
	@echo "Backend: no High or Critical NuGet vulnerabilities."

audit-frontend:
	@echo "==> Auditing frontend npm packages (production only, fail on High/Critical)..."
	cd frontend && npm audit --omit=dev --audit-level=high || (echo ""; echo "ERROR: frontend has High/Critical npm vulnerabilities. Re-run with 'npm audit' in frontend/ for details."; exit 1)
	@echo "Frontend: no High or Critical npm vulnerabilities."
