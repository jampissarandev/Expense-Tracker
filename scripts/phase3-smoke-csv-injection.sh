#!/bin/bash
# Phase 3 export — CSV-injection mitigation live verify
#
# The CsvHelper exporter prefixes cells starting with =, +, -, @, \t, \r
# with a single apostrophe so Excel/Numbers treat them as literal text
# (not formulas). This script creates a transaction whose note is
# `=cmd|/c calc` and verifies the exported cell is `'=cmd|/c calc`.
#
# Pre-requisites:
#   - API reachable at $BASE (default http://localhost:5117)
#   - Postgres running (Phase 0 P0.3 + apply migrations)
#   - python3 on PATH (for JSON parsing)
#
# Usage:
#   ./phase3-smoke-csv-injection.sh             # uses default BASE
#   BASE=http://172.20.60.2:5117 ./phase3-smoke-csv-injection.sh
set -euo pipefail

BASE="${BASE:-http://localhost:5117}"
SUFFIX="$(date +%s)-$$"
EMAIL="p3inv-${SUFFIX}@test.com"
CJ="$(mktemp -t inv.XXXXXX)"
REG="$(mktemp -t reg.XXXXXX)"
TX="$(mktemp -t tx.XXXXXX)"
trap "rm -f '$CJ' '$REG' '$TX'" EXIT

# Bills (system category, type=1=expense)
CID="a1b2c3d4-0001-0000-0000-000000000004"

echo "--- register ---"
curl -sS -c "$CJ" -X POST "$BASE/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"Test1234!\",\"displayName\":\"Inv\"}" > "$REG"
ATK=$(python3 -c "import json; print(json.load(open('$REG'))['accessToken']['token'])")

echo "--- create transaction with note: =cmd|/c calc ---"
curl -sS -b "$CJ" -H "Authorization: Bearer $ATK" -H "Content-Type: application/json" \
  -X POST "$BASE/api/transactions" \
  -d "{\"occurredOn\":\"2026-06-20\",\"type\":1,\"categoryId\":\"$CID\",\"amount\":\"99.99\",\"note\":\"=cmd|/c calc\"}" > "$TX"
python3 -c "import json; print('id='+json.load(open('$TX'))['id'])"

echo
echo "--- export (note cell should be prefixed with apostrophe) ---"
curl -sS -b "$CJ" -H "Authorization: Bearer $ATK" "$BASE/api/exports/transactions.csv"

echo
echo "--- byte-level verify: first byte of note cell is 0x27 (apostrophe) ---"
# The note cell is the last quoted field on the data row. The export quotes
# every cell, so the note cell starts with `"'=cmd...`. Grep for the prefix.
curl -sS -b "$CJ" -H "Authorization: Bearer $ATK" "$BASE/api/exports/transactions.csv" \
  | grep -F "=cmd" | head -c 80 | xxd
