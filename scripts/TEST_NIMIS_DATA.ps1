$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project

Write-Host '=== NIMIS FICTIONAL DATA TEST ===' -ForegroundColor Cyan
Write-Host 'READ-ONLY: no real schemes, no submissions, no live writes.' -ForegroundColor Yellow

$BaseUrl = 'http://127.0.0.1:8765/api/v1'
$BackendPython = Join-Path $Project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $BackendPython)) { throw 'NIMIS_VENV_NOT_FOUND' }

& $BackendPython -m pytest server\tests -q
if ($LASTEXITCODE -ne 0) { throw 'BACKEND_TESTS_FAILED' }
Write-Host 'BACKEND_UNIT_TESTS: PASS' -ForegroundColor Green

try { $Health = Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 12 }
catch { throw "BACKEND_NOT_RUNNING: Start scripts\START_PHASE2_REFERENCE.ps1 in a separate terminal. Details: $($_.Exception.Message)" }
if ($Health.status -ne 'ok' -or $Health.stage -ne 'development') { throw 'UNEXPECTED_BACKEND_ENVIRONMENT' }
Write-Host 'BACKEND_HEALTH: PASS' -ForegroundColor Green

$RequestBody = '{"username":"officer.demo"}'
try {
    $Login = Invoke-RestMethod -Uri "$BaseUrl/dev/token" -Method Post -ContentType 'application/json' -Body $RequestBody -TimeoutSec 15
} catch {
    throw "DEVELOPMENT_TEST_TOKEN_UNAVAILABLE: Verify NIMIS_DEMO_MODE=1 and backend localhost binding. $($_.Exception.Message)"
}
if (-not $Login.access_token) { throw 'TEST_TOKEN_MISSING' }
Write-Host 'DEMO_AUTHENTICATION: PASS' -ForegroundColor Green

$Headers = @{ Authorization = "Bearer $($Login.access_token)" }
try {
    $Me = Invoke-RestMethod -Uri "$BaseUrl/me" -Headers $Headers -TimeoutSec 12
    $Schemes = Invoke-RestMethod -Uri "$BaseUrl/schemes" -Headers $Headers -TimeoutSec 12
    $Forms = Invoke-RestMethod -Uri "$BaseUrl/forms" -Headers $Headers -TimeoutSec 12
    $Reference = Invoke-RestMethod -Uri "$BaseUrl/reference" -Headers $Headers -TimeoutSec 12
} catch { throw "REFERENCE_FETCH_FAILED: $($_.Exception.Message)" }

if ($Me.role -ne 'field_officer' -or @($Me.district_ids).Count -ne 1 -or $Me.district_ids[0] -ne 'DEMO-DISTRICT') {
    throw 'ROLE_SCOPE_MISMATCH'
}
Write-Host 'ROLE_AND_GEOGRAPHY_SCOPE: PASS' -ForegroundColor Green
if (@($Schemes.items).Count -ne 1 -or $Schemes.items[0].is_fictional -ne $true -or $Schemes.items[0].scheme_id -ne 'DEMO-SCHEME-001') {
    throw 'ASSIGNED_SCHEME_MISMATCH'
}
Write-Host 'ASSIGNED_FICTIONAL_SCHEME: PASS' -ForegroundColor Green
if (@($Forms.definitions).Count -ne 11) { throw 'FORM_CATALOGUE_MISMATCH' }
Write-Host 'FORM_CATALOGUE_11: PASS' -ForegroundColor Green
if ($Reference.source -ne 'FICTIONAL_DEVELOPMENT_DATA') { throw 'REFERENCE_NOT_FICTIONAL' }
Write-Host 'FICTIONAL_REFERENCE_DOWNLOAD: PASS' -ForegroundColor Green

# Unauthenticated access must remain rejected, and no submissions may be sent.
try {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/schemes" -TimeoutSec 12
    throw 'SECURITY_FAILURE_UNAUTHENTICATED_SCHEME_ACCESS'
} catch {
    $StatusCode = [int]$_.Exception.Response.StatusCode
    if ($StatusCode -ne 401) { throw "SECURITY_FAILURE_EXPECTED_401_GOT_$StatusCode" }
}
Write-Host 'UNAUTHENTICATED_ACCESS_BLOCKED: PASS' -ForegroundColor Green

try {
    $Response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$BaseUrl/sync/push" -Headers $Headers -ContentType 'application/json' -Body '{}' -TimeoutSec 12
    throw 'SECURITY_FAILURE_SYNC_WRITE_ALLOWED'
} catch {
    $StatusCode = [int]$_.Exception.Response.StatusCode
    if ($StatusCode -ne 501) { throw "SECURITY_FAILURE_EXPECTED_501_GOT_$StatusCode" }
}
Write-Host 'LIVE_WRITE_DISABLED: PASS' -ForegroundColor Green

Write-Host '=== NIMIS DATA TEST: PASS ===' -ForegroundColor Green
Write-Host "FICTIONAL_SCHEMES: $(@($Schemes.items).Count)" -ForegroundColor Gray
Write-Host "PROPOSED_FORMS: $(@($Forms.definitions).Count)" -ForegroundColor Gray
Write-Host 'For local browser sandbox test: npm run dev, then Test fictional data.' -ForegroundColor Cyan
