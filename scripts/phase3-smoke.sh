#!/bin/bash
# Phase 3 — CSV export manual smoke test
#
# Exercises the two export endpoints end-to-end against a live API:
#   1. Register a fresh user
#   2. Create 3 transactions across 3 months
#   3. GET /api/exports/transactions.csv  — check headers, BOM, Thai text
#   4. GET /api/exports/summary.csv       — check 6 months, balance column
#   5. Filtered transactions export        — check query params apply
#   6. 401 for unauthenticated request
#   7. Cross-user leak check (basic, inline)
#   8. Logout
#
# Pre-requisites:
#   - API reachable at $BASE (default http://localhost:5117)
#   - Postgres running (Phase 0 P0.3 + apply migrations)
#   - python3 on PATH (for JSON parsing)
#
# Usage:
#   ./phase3-smoke.sh                       # uses default BASE
#   BASE=http://172.20.60.2:5117 ./phase3-smoke.sh
set -euo pipefail

BASE="${BASE:-http://localhost:5117}"
SUFFIX="$(date +%s)-$$"
EMAIL="phase3-smoke-${SUFFIX}@test.com"
COOKIE_JAR="$(mktemp -t phase3.XXXXXX)"
HEADERS_T="$(mktemp -t tx-hdr.XXXXXX)"
HEADERS_S="$(mktemp -t sm-hdr.XXXXXX)"
CSV_T="$(mktemp -t tx.XXXXXX).csv"
CSV_S="$(mktemp -t sm.XXXXXX).csv"
CSV_F="$(mktemp -t txf.XXXXXX).csv"
trap "rm -f '$COOKIE_JAR' '$HEADERS_T' '$HEADERS_S' '$CSV_T' '$CSV_S' '$CSV_F'" EXIT

echo "=== 1) Register a fresh user ==="
REG=$(curl -sS -c "$COOKIE_JAR" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234!\",\"displayName\":\"Phase 3 Smoke\"}")
echo "$REG" | head -c 200; echo
ACCESS=$(echo "$REG" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['accessToken']['token'])")
echo "ACCESS length: ${#ACCESS}"

echo "=== 2) Get categories (need a system category id) ==="
CATS=$(curl -sS -b "$COOKIE_JAR" -H "Authorization: Bearer $ACCESS" "$BASE/api/categories")
CAT_ID=$(echo "$CATS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['id'])")
CAT_TYPE=$(echo "$CATS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[0]['type'])")
echo "CAT_ID=$CAT_ID CAT_TYPE=$CAT_TYPE"

echo "=== 3) Create 3 transactions across 3 months ==="
for D in 2026-04-15 2026-05-10 2026-06-01; do
  TX_RESP=$(curl -sS -b "$COOKIE_JAR" -H "Authorization: Bearer $ACCESS" \
    -H "Content-Type: application/json" \
    -X POST "$BASE/api/transactions" \
    -d "{\"occurredOn\":\"$D\",\"type\":$CAT_TYPE,\"categoryId\":\"$CAT_ID\",\"amount\":\"1234.56\",\"note\":\"ทดสอบ Phase3 $D\"}")
  echo "  created $D: $(echo "$TX_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id', d))" 2>/dev/null | head -c 60)"
done

echo "=== 4) GET /api/exports/transactions.csv ==="
curl -sS -b "$COOKIE_JAR" -H "Authorization: Bearer $ACCESS" \
  -D "$HEADERS_T" -o "$CSV_T" "$BASE/api/exports/transactions.csv"
echo "--- response headers ---"; head -10 "$HEADERS_T"
echo "--- first 32 bytes (hex) — expect EF BB BF (UTF-8 BOM) then Thai ---"
head -c 32 "$CSV_T" | xxd
echo "--- body ---"; cat "$CSV_T"
echo "--- size: $(wc -c < "$CSV_T") bytes ---"

echo "=== 5) GET /api/exports/summary.csv ==="
curl -sS -b "$COOKIE_JAR" -H "Authorization: Bearer $ACCESS" \
  -D "$HEADERS_S" -o "$CSV_S" "$BASE/api/exports/summary.csv"
echo "--- response headers ---"; head -10 "$HEADERS_S"
echo "--- first 32 bytes (hex) — expect EF BB BF then Thai ---"
head -c 32 "$CSV_S" | xxd
echo "--- body ---"; cat "$CSV_S"
echo "--- size: $(wc -c < "$CSV_S") bytes ---"

echo "=== 6) Filtered export: type=income&from=2026-05-01&to=2026-05-31 (header-only expected) ==="
curl -sS -b "$COOKIE_JAR" -H "Authorization: Bearer $ACCESS" \
  -o "$CSV_F" "$BASE/api/exports/transactions.csv?type=income&from=2026-05-01&to=2026-05-31"
cat "$CSV_F"

echo "=== 7) 401 check (no auth) ==="
curl -sS -o /dev/null -w "unauth code=%{http_code}\n" "$BASE/api/exports/transactions.csv"

echo "=== 8) Cross-user basic check (user2 sees only header) ==="
EMAIL2="phase3-other-${SUFFIX}@test.com"
COOKIE2="$(mktemp -t phase3o.XXXXXX)"
trap "rm -f '$COOKIE_JAR' '$HEADERS_T' '$HEADERS_S' '$CSV_T' '$CSV_S' '$CSV_F' '$COOKIE2'" EXIT
curl -sS -c "$COOKIE2" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL2\",\"password\":\"Test1234!\",\"displayName\":\"Phase 3 Other\"}" > /dev/null
LEAK=$(curl -sS -b "$COOKIE2" "$BASE/api/exports/transactions.csv")
echo "user2 sees: '$LEAK' (should be just header)"

echo "=== 9) Logout (Bearer required, see PLAN.md Phase 3 known issues) ==="
curl -sS -b "$COOKIE_JAR" -H "Authorization: Bearer $ACCESS" \
  -X POST "$BASE/api/auth/logout" -o /dev/null -w "logout code=%{http_code}\n"

echo "=== SMOKE COMPLETE ==="
