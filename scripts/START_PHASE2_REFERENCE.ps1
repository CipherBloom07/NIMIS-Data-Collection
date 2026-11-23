$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project

Write-Host '=== NIMIS PHASE 2 LOCAL REFERENCE SERVER ===' -ForegroundColor Cyan

$VirtualPython = Join-Path $Project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $VirtualPython)) {
    # The Windows Python launcher (py) is optional. Some installations only provide python.exe.
    $Candidates = @()
    foreach ($Name in @('py', 'python', 'python3')) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($Command -and $Command.Source) {
            if ($Name -eq 'py') {
                $Candidates += ,@($Command.Source, '-3')
            } else {
                $Candidates += ,@($Command.Source)
            }
        }
    }
    # Common installations not always available on PATH.
    foreach ($Base in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python'),
        'C:\Program Files\Python',
        'C:\Python312',
        'C:\Python313',
        'C:\Python314'
    )) {
        if (Test-Path -LiteralPath $Base) {
            Get-ChildItem -LiteralPath $Base -Filter 'python.exe' -File -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -notmatch '\\(Scripts|Lib|site-packages)\\' } |
                ForEach-Object { $Candidates += ,@($_.FullName) }
        }
    }

    $Found = $false
    foreach ($Candidate in $Candidates) {
        $Exe = $Candidate[0]
        $PrefixArgs = @()
        if ($Candidate.Count -gt 1) { $PrefixArgs = @($Candidate[1..($Candidate.Count - 1)]) }
        try {
            $Version = & $Exe @PrefixArgs -c 'import sys; print(".".join(map(str, sys.version_info[:3])) if sys.version_info >= (3,12) else "TOO_OLD")' 2>$null
            if ($LASTEXITCODE -ne 0 -or "$Version".Trim() -eq 'TOO_OLD') { continue }
            if ("$Version".Trim() -notmatch '^3\.(1[2-9]|[2-9][0-9])\.\d+$') { continue }

            Write-Host "PYTHON_FOUND: $Exe ($Version)" -ForegroundColor Green
            & $Exe @PrefixArgs -m venv (Join-Path $Project '.venv')
            if ($LASTEXITCODE -ne 0) { throw 'VENV_CREATION_FAILED' }
            $Found = $true
            break
        } catch {
            Write-Host "PYTHON_CANDIDATE_SKIPPED: $Exe - $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }

    if (-not $Found -or -not (Test-Path -LiteralPath $VirtualPython)) {
        throw 'PYTHON_312_PLUS_NOT_FOUND: Install Python 3.12+ from python.org (select Add Python to PATH), then rerun this script. Alternatively install using: winget install --id Python.Python.3.12 -e'
    }
}

& $VirtualPython --version
if ($LASTEXITCODE -ne 0) { throw 'VENV_PYTHON_UNAVAILABLE' }

Write-Host 'INSTALLING_REFERENCE_DEPENDENCIES...' -ForegroundColor Cyan
& $VirtualPython -m pip install -r 'server\requirements.txt' --disable-pip-version-check
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_DEPENDENCIES_FAILED' }

Write-Host 'TESTING_REFERENCE_BACKEND...' -ForegroundColor Cyan
& $VirtualPython -m pytest server\tests -q
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_TESTS_FAILED' }

# Development signing secret exists only in this PowerShell process and rotates on restart.
$Bytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
$env:NIMIS_DEV_JWT_SECRET = [Convert]::ToBase64String($Bytes)
$env:NIMIS_DEMO_MODE = '1'

Write-Host 'BACKEND_DEV_MODE: FICTIONAL_DATA_ONLY' -ForegroundColor Yellow
Write-Host 'BACKEND_BIND: 127.0.0.1:8765' -ForegroundColor Green
Write-Host 'Leave this terminal running; start npm run dev in a second terminal.' -ForegroundColor Cyan
& $VirtualPython -m uvicorn server.reference_app:app --host 127.0.0.1 --port 8765
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_SERVER_FAILED' }
