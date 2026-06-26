#!/bin/bash
# Poll an HTTP endpoint until the API is responding.
#
# Useful for waiting for the .NET API to finish startup before running a
# smoke script. Exits 0 on success, 1 on timeout.
#
# Usage:
#   ./wait-api.sh                                    # default: http://localhost:5117/api/auth/me
#   BASE=http://localhost:5117 PROBE=/health ./wait-api.sh
#   BASE=http://172.20.60.2:5117 ./wait-api.sh
set -euo pipefail

BASE="${BASE:-http://localhost:5117}"
PROBE="${PROBE:-/api/auth/me}"
TIMEOUT_SECS="${TIMEOUT_SECS:-60}"

end=$((SECONDS + TIMEOUT_SECS))
try=0
while [ "$SECONDS" -lt "$end" ]; do
  try=$((try + 1))
  # Use --fail-with-body to make curl exit non-zero on HTTP errors; then we
  # know 000 means "couldn't connect" (not "got an error response"). The
  # trailing || echo 000 handles connection refused / DNS failure.
  code=$(curl -s -o /dev/null -m 1 -w '%{http_code}' "${BASE}${PROBE}" 2>/dev/null) || code=000
  if [ -z "$code" ]; then code=000; fi
  echo "try=$try ${BASE}${PROBE} code=$code"
  # 200, 401 (unauth, but app responding), 503 (health says unhealthy) all
  # mean the app is up. 000 / connection-refused means still starting.
  case "$code" in
    2*|401|403|404|503) exit 0 ;;
  esac
  sleep 2
done
echo "timeout after ${TIMEOUT_SECS}s waiting for ${BASE}${PROBE}" >&2
exit 1
