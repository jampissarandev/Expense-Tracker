# Start Vite dev server in background and verify it is reachable.
$env:VITE_API_URL = "http://localhost:5117"
$logPath = Join-Path $env:TEMP "vite-lh.log"
$pidPath = Join-Path $env:TEMP "vite-lh.pid"

# Kill any previous instance
if (Test-Path $pidPath) {
  $old = Get-Content $pidPath
  try { Stop-Process -Id $old -Force -ErrorAction SilentlyContinue } catch {}
  Remove-Item $pidPath -Force -ErrorAction SilentlyContinue
}

Write-Host "Starting Vite on :5173 (log: $logPath) ..."
$proc = Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run", "dev", "--", "--host", "127.0.0.1", "--port", "5173" `
  -WorkingDirectory "d:\JamProject\ExpenseTracker\frontend" `
  -RedirectStandardOutput $logPath `
  -RedirectStandardError "$logPath.err" `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $pidPath -Value $proc.Id
Write-Host "VITE_PID=$($proc.Id)"

# Wait for the server to bind
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5173/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($resp.StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch { }
}

if ($ready) {
  Write-Host "READY after ${i}s"
  Get-Content $logPath -Tail 5
  exit 0
} else {
  Write-Host "TIMEOUT"
  Get-Content $logPath -Tail 30
  exit 1
}
