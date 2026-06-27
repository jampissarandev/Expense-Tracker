#!/usr/bin/env bash
# Re-up Postgres container and apply migrations.
set -e

cd /mnt/d/JamProject/ExpenseTracker

echo "=== Bringing up Postgres ==="
docker compose -f docker/postgres.yml up -d 2>&1 | sed 's/^/  /'

# Wait for healthy
for i in $(seq 1 20); do
  H=$(docker inspect expense-tracker-db --format '{{.State.Health.Status}}' 2>/dev/null || echo "missing")
  if [ "$H" = "healthy" ]; then
    echo "  Postgres healthy after ${i} attempts"
    break
  fi
  sleep 2
done

if [ "$H" != "healthy" ]; then
  echo "  Postgres NOT healthy (status=$H)"
  docker ps -a --filter name=expense-tracker-db
  exit 1
fi

echo "=== Applying migrations ==="
cd backend
export PATH="$HOME/dotnet:$HOME/.dotnet/tools:$PATH"
export ConnectionStrings__DefaultConnection="Host=localhost;Port=5432;Database=expensetracker;Username=expense;Password=expense"
which dotnet-ef
dotnet-ef database update \
  --project src/ExpenseTracker.Infrastructure \
  --startup-project src/ExpenseTracker.Api 2>&1 | sed 's/^/  /'
