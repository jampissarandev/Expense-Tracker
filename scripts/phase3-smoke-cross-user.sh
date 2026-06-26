#!/bin/bash
# Phase 3 export — cross-user data isolation smoke
#
# Verifies that the CSV export endpoints do NOT leak another user's
# transactions or summary data. Two users are registered; user1 creates a
# transaction, then user2's exports must show only the header / all-zero
# months. Failure means user2 sees user1's data ("LEAK" in the output).
#
# Pre-requisites:
#   - API reachable at $BASE (default http://localhost:5117)
#   - Postgres running (Phase 0 P0.3 + apply migrations)
#   - python3 on PATH (for JSON parsing)
#
# Usage:
#   ./phase3-smoke-cross-user.sh                 # uses default BASE
#   BASE=http://172.20.60.2:5117 ./phase3-smoke-cross-user.sh
set -euo pipefail

BASE="${BASE:-http://localhost:5117}"
SUFFIX="$(date +%s)-$$"
EMAIL1="p3leak1-${SUFFIX}@test.com"
EMAIL2="p3leak2-${SUFFIX}@test.com"
CJ1="$(mktemp -t leak1.XXXXXX)"
CJ2="$(mktemp -t leak2.XXXXXX)"
REG1="$(mktemp -t reg1.XXXXXX)"
REG2="$(mktemp -t reg2.XXXXXX)"
trap "rm -f '$CJ1' '$CJ2' '$REG1' '$REG2'" EXIT

# Bills (system category, type=1=expense)
CID="a1b2c3d4-0001-0000-0000-000000000004"

echo "--- register user1 + user2 ---"
for U in 1 2; do
  eval "EMAIL=\$EMAIL$U; CJ=\$CJ$U; REG=\$REG$U"
  curl -sS -c "$CJ" -X POST "$BASE/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234!\",\"displayName\":\"L$U\"}" > "$REG"
  eval "ATK$U=\$(python3 -c 'import json; print(json.load(open(\"$REG\"))[\"accessToken\"][\"token\"])')"
done

echo "--- user1 creates a transaction ---"
curl -sS -b "$CJ1" -H "Authorization: Bearer $ATK1" -H "Content-Type: application/json" \
  -X POST "$BASE/api/transactions" \
  -d "{\"occurredOn\":\"2026-06-15\",\"type\":1,\"categoryId\":\"$CID\",\"amount\":\"500.00\",\"note\":\"User1 secret\"}" > /dev/null

echo "--- user1's transactions export ---"
curl -sS -b "$CJ1" -H "Authorization: Bearer $ATK1" "$BASE/api/exports/transactions.csv"
echo
echo "--- user2's transactions export (should be header only) ---"
curl -sS -b "$CJ2" -H "Authorization: Bearer $ATK2" "$BASE/api/exports/transactions.csv"
echo
echo "--- user2's summary export (should be all-zero 6 months) ---"
curl -sS -b "$CJ2" -H "Authorization: Bearer $ATK2" "$BASE/api/exports/summary.csv"
echo
echo "--- byte-level leak check ---"
U1=$(curl -sS -b "$CJ1" -H "Authorization: Bearer $ATK1" "$BASE/api/exports/summary.csv")
U2=$(curl -sS -b "$CJ2" -H "Authorization: Bearer $ATK2" "$BASE/api/exports/summary.csv")
echo "user1 has user1's data: $(echo "$U1" | grep -q '500.00' && echo YES || echo NO)"
echo "user2 has user1's data: $(echo "$U2" | grep -q '500.00' && echo LEAK || echo NO-LEAK)"
