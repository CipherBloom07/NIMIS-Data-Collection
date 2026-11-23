$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project

Write-Host '=== NIMIS PHASE 2 LOCAL REFERENCE SERVER ===' -ForegroundColor Cyan

$VirtualPython = Join-Path $Project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $VirtualPython)) {
    # "py" (Windows launcher) is OPTIONAL. Prefer "python", which is present
    # on many installations, including C:\Python313\python.exe.
    $Candidates = @()
    foreach ($Name in @('python', 'python3', 'py')) {
        $Command = Get-Command $Name -ErrorAction SilentlyContinue
        if ($Command -and $Command.Source) {
            if ($Name -eq 'py') {
                $Candidates += ,@($Command.Source, '-3')
            } else {
                $Candidates += ,@($Command.Source)
            }
        }
    }
    foreach ($Location in @(
        (Join-Path $env:LOCALAPPDATA 'Programs\Python'),
        'C:\Python312', 'C:\Python313', 'C:\Python314',
        'C:\Program Files\Python'
    )) {
        if (Test-Path -LiteralPath $Location) {
            Get-ChildItem -LiteralPath $Location -Filter python.exe -File -Recurse -ErrorAction SilentlyContinue |
                Where-Object { $_.FullName -notmatch '\\(Scripts|Lib|site-packages)\\' } |
                ForEach-Object { $Candidates += ,@($_.FullName) }
        }
    }

    $Found = $false
    foreach ($Candidate in $Candidates) {
        $Exe = [string]$Candidate[0]
        $PrefixArgs = @()
        if ($Candidate.Count -gt 1) { $PrefixArgs = @($Candidate[1..($Candidate.Count - 1)]) }
        # The previous "-c '...print(\"...\")'" broke on Windows quoting.
        # --version avoids inline Python and is reliable in Windows PowerShell.
        try {
            $VersionOutput = (& $Exe @PrefixArgs --version 2>&1 | Out-String).Trim()
            if ($LASTEXITCODE -ne 0 -or $VersionOutput -notmatch '^Python\s+(\d+)\.(\d+)\.(\d+)') {
                continue
            }
            $Major = [int]$Matches[1]
            $Minor = [int]$Matches[2]
            if ($Major -ne 3 -or $Minor -lt 12) { continue }
            Write-Host "PYTHON_FOUND: $Exe ($VersionOutput)" -ForegroundColor Green
            & $Exe @PrefixArgs -m venv (Join-Path $Project '.venv')
            if ($LASTEXITCODE -ne 0) { throw 'VENV_CREATION_FAILED' }
            $Found = $true
            break
        } catch {
            Write-Host "PYTHON_CANDIDATE_ERROR: $Exe : $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
    if (-not $Found -or -not (Test-Path -LiteralPath $VirtualPython)) {
        throw 'PYTHON_NOT_AVAILABLE: Python 3.12+ must be installed and runnable. Check "python --version" and "Get-Command python".'
    }
}

$VenvVersion = (& $VirtualPython --version 2>&1 | Out-String).Trim()
if ($LASTEXITCODE -ne 0) { throw 'VENV_PYTHON_UNAVAILABLE' }
Write-Host "VENV_PYTHON: $VenvVersion" -ForegroundColor Green

Write-Host 'INSTALLING_REFERENCE_DEPENDENCIES...' -ForegroundColor Cyan
Write-Host 'PACKAGE_INDEX: https://pypi.org/simple (official PyPI)' -ForegroundColor Cyan

# Slow or intermittent links may cause pip to report "No matching distribution"
# even when a compatible version exists. Force official PyPI, preserve pip cache
# and retry with longer read/connect timeouts; never disable TLS verification.
$Installed = $false
for ($Attempt = 1; $Attempt -le 2; $Attempt++) {
    Write-Host "DEPENDENCY_INSTALL_ATTEMPT: $Attempt/2" -ForegroundColor Yellow
    & $VirtualPython -m pip install --index-url 'https://pypi.org/simple' --retries 6 --timeout 90 --prefer-binary --disable-pip-version-check -r 'server\requirements.txt'
    if ($LASTEXITCODE -eq 0) {
        $Installed = $true
        break
    }
    if ($Attempt -eq 1) {
        Write-Host 'PYPI_DOWNLOAD_INTERRUPTED: Retrying using the official registry.' -ForegroundColor Yellow
    }
}
if (-not $Installed) {
    Write-Host 'Network or PyPI access is preventing dependency installation.' -ForegroundColor Red
    Write-Host 'No need to reinstall Python. Check internet/VPN/proxy then retry.' -ForegroundColor Yellow
    Write-Host 'Diagnostic: Invoke-WebRequest -UseBasicParsing -Uri https://pypi.org/simple/pyjwt/ -TimeoutSec 60' -ForegroundColor Gray
    throw 'REFERENCE_DEPENDENCIES_FAILED: Official PyPI package download failed'
}

Write-Host 'TESTING_REFERENCE_BACKEND...' -ForegroundColor Cyan
& $VirtualPython -m pytest server\tests -q
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_TESTS_FAILED' }

# A fresh secret is generated for each local run and never committed.
$Bytes = [byte[]]::new(48)
[System.Security.Cryptography.RandomNumberGenerator]::Fill($Bytes)
$env:NIMIS_DEV_JWT_SECRET = [Convert]::ToBase64String($Bytes)
$env:NIMIS_DEMO_MODE = '1'

Write-Host 'BACKEND_DEV_MODE: FICTIONAL_DATA_ONLY' -ForegroundColor Yellow
Write-Host 'BACKEND_BIND: 127.0.0.1:8765' -ForegroundColor Green
Write-Host 'Leave this terminal open and start npm run dev in a second terminal.' -ForegroundColor Cyan
& $VirtualPython -m uvicorn server.reference_app:app --host 127.0.0.1 --port 8765
if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_SERVER_FAILED' }
