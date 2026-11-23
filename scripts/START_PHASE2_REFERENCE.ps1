$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project

$Python = Get-Command py -ErrorAction SilentlyContinue
if (-not $Python) { throw 'PYTHON_LAUNCHER_NOT_FOUND: Install Python 3.12+.' }
if (-not (Test-Path '.venv\Scripts\python.exe')) {
    & py -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'VENV_CREATION_FAILED' }
}

$VirtualPython = Join-Path $Project '.venv\Scripts\python.exe'
Write-Host '=== NIMIS PHASE 2 LOCAL REFERENCE SERVER ===' -ForegroundColor Cyan
& $VirtualPython -m pip install -r 'server\requirements.txt' --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_DEPENDENCIES_FAILED' }

& $VirtualPython -m pytest server\tests -q
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_TESTS_FAILED' }

# Development secret is randomized at every launch; it is never written to Git.
$Bytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
$env:NIMIS_DEV_JWT_SECRET = [Convert]::ToBase64String($Bytes)
$env:NIMIS_DEMO_MODE = '1'

Write-Host 'BACKEND_DEV_MODE: FICTIONAL_DATA_ONLY' -ForegroundColor Yellow
Write-Host 'BACKEND_BIND: 127.0.0.1:8765' -ForegroundColor Green
Write-Host 'Leave this terminal running; start npm run dev in another terminal.' -ForegroundColor Cyan

& $VirtualPython -m uvicorn server.reference_app:app --host 127.0.0.1 --port 8765
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_SERVER_FAILED' }
