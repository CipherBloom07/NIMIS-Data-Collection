$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
$Bin = Join-Path $Project 'database\postgresql\bin'
$Data = Join-Path $Project 'database\data'
$Ctl = Join-Path $Bin 'pg_ctl.exe'
if (-not (Test-Path -LiteralPath $Ctl)) { throw 'LOCAL_POSTGRES_BINARIES_NOT_INSTALLED' }
if (-not (Test-Path -LiteralPath (Join-Path $Data 'PG_VERSION'))) {
    throw 'LOCAL_DATABASE_NOT_INITIALIZED'
}
Write-Host '=== NIMIS LOCAL POSTGRESQL SAFE STOP ===' -ForegroundColor Cyan
$PreviousErrorPolicy = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    & $Ctl -D $Data status 2>$null | Out-Null
    $Running = $LASTEXITCODE -eq 0
} finally { $ErrorActionPreference = $PreviousErrorPolicy }
if (-not $Running) {
    Write-Host 'POSTGRES_ALREADY_STOPPED: PASS' -ForegroundColor Green
    return
}
& $Ctl -D $Data -m fast -w -t 60 stop
if ($LASTEXITCODE -ne 0) { throw 'POSTGRES_STOP_FAILED: Check database\logs\postgres.log' }
Write-Host 'POSTGRES_STOPPED: PASS — Database data preserved.' -ForegroundColor Green
