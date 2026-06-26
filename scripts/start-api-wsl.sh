#!/usr/bin/env bash
# Start the ExpenseTracker API in WSL2 background.
# Usage:  wsl -d Ubuntu -- bash /mnt/d/JamProject/ExpenseTracker/scripts/start-api-wsl.sh
set -x
pkill -f 'ExpenseTracker.Api' 2>/dev/null || true
sleep 1
cd /mnt/d/JamProject/ExpenseTracker/backend
export DOTNET_ROOT=/home/jusaku/dotnet
export PATH=/home/jusaku/dotnet:$PATH
export ASPNETCORE_URLS=http://0.0.0.0:5117
export ASPNETCORE_ENVIRONMENT=Development
nohup /home/jusaku/dotnet/dotnet run \
  --project src/ExpenseTracker.Api \
  --no-build -c Release \
  > /tmp/api.log 2>&1 < /dev/null &
API_PID=$!
disown
echo "Started PID=$API_PID"
exit 0
