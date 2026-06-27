#!/usr/bin/env bash
# Wait until backend /health returns 200, up to 60s.
for i in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5117/health 2>/dev/null || echo "000")
  if [ "$CODE" = "200" ]; then
    echo "READY after ${i} attempts (~$((i*2))s)"
    curl -s http://localhost:5117/health
    echo
    exit 0
  fi
  sleep 2
done
echo "TIMEOUT — last code=$CODE"
echo "--- API LOG TAIL ---"
tail -30 /tmp/api-lighthouse.log
exit 1
