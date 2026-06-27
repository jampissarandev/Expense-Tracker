.PHONY: db-up db-down db-reset db-wsl-ip db-portproxy db-portproxy-remove dev-secrets e2e e2e-build

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
