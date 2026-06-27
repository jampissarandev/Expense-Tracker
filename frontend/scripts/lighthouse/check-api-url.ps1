$hasUrl = (Get-Content "d:\JamProject\ExpenseTracker\frontend\dist\assets\index-BpI72OXz.js" -Raw) -match 'localhost:5117'
$hasLiteral = (Get-Content "d:\JamProject\ExpenseTracker\frontend\dist\assets\index-BpI72OXz.js" -Raw) -match 'VITE_API_URL'
$hasEndpoint = (Get-Content "d:\JamProject\ExpenseTracker\frontend\dist\assets\index-BpI72OXz.js" -Raw) -match '/api/auth/login'
Write-Host "Has localhost:5117    : $hasUrl"
Write-Host "Has VITE_API_URL lit  : $hasLiteral"
Write-Host "Has /api/auth/login   : $hasEndpoint"
Write-Host "---first occurrence of 'baseURL' / 'baseUrl' / api url---"
$content = Get-Content "d:\JamProject\ExpenseTracker\frontend\dist\assets\index-BpI72OXz.js" -Raw
$match = [regex]::Match($content, 'baseURL["\s:=]+[^,;\s}]+', 'IgnoreCase')
if ($match.Success) { Write-Host "baseURL found: $($match.Value)" } else { Write-Host "no baseURL match" }
$match2 = [regex]::Match($content, '/api/auth/[^"`]+', 'IgnoreCase')
if ($match2.Success) { Write-Host "endpoint: $($match2.Value)" }
