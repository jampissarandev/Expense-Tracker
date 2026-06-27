#!/usr/bin/env bash
# Start backend API in WSL for Lighthouse run.
# Uses setsid + disown so the process survives the launching shell exit.
set -e

cd /mnt/d/JamProject/ExpenseTracker/backend

# Kill any previous instance bound to 5117
EXISTING_PID=$(ss -ltnp 2>/dev/null | grep ':5117' | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)
if [ -n "$EXISTING_PID" ]; then
  echo "Killing previous API pid=$EXISTING_PID"
  kill -9 "$EXISTING_PID" 2>/dev/null || true
  sleep 1
fi

export PATH="$HOME/dotnet:$PATH"
export ASPNETCORE_URLS="http://0.0.0.0:5117"
export ASPNETCORE_ENVIRONMENT=Development
# Generate a throwaway JWT signing key per run (matches what ci.yml does
# for the e2e-ci job). Local dev should set Jwt__SecretKey via env or
# appsettings.Development.json — never hard-code it in this file.
if [ -z "${Jwt__SecretKey:-}" ]; then
  export Jwt__SecretKey="$(openssl rand -hex 32)"
fi
export ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense"
export E2E_TESTS=true
export PATH="$HOME/.dotnet/tools:$PATH"

echo "Starting API on :5117 (logs: /tmp/api-lighthouse.log) ..."
setsid dotnet run --project src/ExpenseTracker.Api --no-launch-profile </dev/null >/tmp/api-lighthouse.log 2>&1 &
APIPID=$!
echo "API_PID=$APIPID"
disown $APIPID 2>/dev/null || true

sleep 4
if kill -0 $APIPID 2>/dev/null; then
  echo "STILL ALIVE after 4s"
else
  echo "DIED — log tail:"
  tail -40 /tmp/api-lighthouse.log
  exit 1
fi
