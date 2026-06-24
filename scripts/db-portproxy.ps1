# scripts/db-portproxy.ps1
# Adds or removes a Windows portproxy rule that forwards localhost:5432
# to the WSL2 instance's eth0 IP. Required when:
#   - Host OS is Windows 11
#   - Postgres is running inside WSL2 (via docker or systemd)
#   - The .NET API is running on Windows (not inside WSL)
#
# Without this rule, the API can't reach Postgres via `localhost:5432`
# because WSL2's IP is a NAT'd address that Windows can't route to from
# user-mode processes.
#
# Requires: PowerShell **elevated** (Run as Administrator). Non-elevated
# sessions will error with "The requested operation requires elevation".
#
# Usage:
#   pwsh -File scripts/db-portproxy.ps1 add
#   pwsh -File scripts/db-portproxy.ps1 remove
#   pwsh -File scripts/db-portproxy.ps1 status

param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('add', 'remove', 'status')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'

# Detect WSL IP
$wslIpRaw = wsl -d Ubuntu -- bash -c "hostname -I" 2>$null
if (-not $wslIpRaw) {
    Write-Host "WSL not detected. This script is for Windows + WSL2 hosts only." -ForegroundColor Yellow
    exit 0
}
$wslIp = ($wslIpRaw -split '\s+')[0].Trim()
Write-Host "Detected WSL IP: $wslIp"

$listenPort = 5432
$listenAddress = '0.0.0.0'

switch ($Action) {
    'add' {
        Write-Host "Adding portproxy: localhost:$listenPort -> ${wslIp}:$listenPort"
        netsh interface portproxy add v4tov4 `
            listenport=$listenPort listenaddress=$listenAddress `
            connectport=$listenPort connectaddress=$wslIp
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed. Re-run PowerShell as Administrator." -ForegroundColor Red
            exit 1
        }
        Write-Host "Done. Test with: Test-NetConnection -ComputerName localhost -Port 5432" -ForegroundColor Green
    }
    'remove' {
        Write-Host "Removing portproxy: localhost:$listenPort -> ${wslIp}:$listenPort"
        netsh interface portproxy delete v4tov4 `
            listenport=$listenPort listenaddress=$listenAddress
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed (rule may not exist). Re-run PowerShell as Administrator." -ForegroundColor Red
            exit 1
        }
        Write-Host "Done." -ForegroundColor Green
    }
    'status' {
        Write-Host "Current portproxy rules:"
        netsh interface portproxy show v4tov4
    }
}
