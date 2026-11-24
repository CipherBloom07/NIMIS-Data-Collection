param([string]$ArchivePath = '', [switch]$SetupOnly)
$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project
Write-Host '=== NIMIS PROJECT-LOCAL POSTGRESQL 16 ===' -ForegroundColor Cyan
Write-Host 'NO DOCKER. NO WINDOWS SERVICE. FICTIONAL DATA ONLY.' -ForegroundColor Yellow

$Root = Join-Path $Project 'database'
$Install = Join-Path $Root 'postgresql'
$Data = Join-Path $Root 'data'
$Logs = Join-Path $Root 'logs'
$Secrets = Join-Path $Root '.env.local'
$Bin = Join-Path $Install 'bin'
$Init = Join-Path $Bin 'initdb.exe'
$Ctl = Join-Path $Bin 'pg_ctl.exe'
$Psql = Join-Path $Bin 'psql.exe'
$Port = 55432

foreach ($Folder in @($Root, $Logs)) {
    if (-not (Test-Path -LiteralPath $Folder)) {
        New-Item -ItemType Directory -Path $Folder -Force | Out-Null
    }
}
if (-not (Test-Path -LiteralPath $Init)) {
    if (-not $ArchivePath) {
        $Candidates = @()
        foreach ($Folder in @((Join-Path $env:USERPROFILE 'Downloads'), (Join-Path $Root 'downloads'))) {
            if (Test-Path -LiteralPath $Folder) {
                $Candidates += @(Get-ChildItem -LiteralPath $Folder -Filter 'postgresql-16*-windows-x64-binaries.zip' -File -ErrorAction SilentlyContinue)
            }
        }
        $Archive = $Candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        if ($Archive) { $ArchivePath = $Archive.FullName }
    }
    if (-not $ArchivePath -or -not (Test-Path -LiteralPath $ArchivePath)) {
        Write-Host 'Download the official PostgreSQL 16 Windows x64 binaries ZIP:' -ForegroundColor Yellow
        Write-Host 'https://www.enterprisedb.com/download-postgresql-binaries' -ForegroundColor Cyan
        Write-Host 'Save it in Downloads, then rerun this script.' -ForegroundColor Yellow
        throw 'POSTGRESQL_16_ZIP_REQUIRED'
    }
    if (([IO.Path]::GetExtension($ArchivePath)).ToLowerInvariant() -ne '.zip') { throw 'ZIP_ARCHIVE_REQUIRED' }
    Write-Host "ZIP_SHA256: $((Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash)" -ForegroundColor Gray
    $Stage = Join-Path $Root '_unpack_temp'
    if (Test-Path -LiteralPath $Stage) { throw 'TEMP_EXTRACTION_EXISTS: Inspect database\_unpack_temp before retrying.' }
    New-Item -ItemType Directory -Path $Stage | Out-Null
    try {
        Expand-Archive -LiteralPath $ArchivePath -DestinationPath $Stage -ErrorAction Stop
        $Found = Get-ChildItem -LiteralPath $Stage -Filter initdb.exe -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Directory.Name -eq 'bin' } | Select-Object -First 1
        if (-not $Found) { throw 'INVALID_POSTGRES_ARCHIVE' }
        $Source = Split-Path -Parent $Found.Directory.FullName
        if (Test-Path -LiteralPath $Install) { throw 'INSTALL_DIRECTORY_EXISTS: inspect database\postgresql before retrying' }
        Move-Item -LiteralPath $Source -Destination $Install -ErrorAction Stop
    } finally {
        if (Test-Path -LiteralPath $Stage) { Remove-Item -LiteralPath $Stage -Recurse -Force }
    }
}
foreach ($Executable in @($Init, $Ctl, $Psql)) {
    if (-not (Test-Path -LiteralPath $Executable)) { throw "POSTGRES_BINARY_MISSING: $Executable" }
}
$Version = (& $Psql --version | Out-String).Trim()
if ($LASTEXITCODE -ne 0 -or $Version -notmatch 'PostgreSQL\)\s+16\.') { throw "POSTGRESQL_16_REQUIRED: $Version" }
Write-Host "PORTABLE_POSTGRES: $Version" -ForegroundColor Green

function New-RandomSecret {
    $Buffer = New-Object byte[] 32
    $Rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $Rng.GetBytes($Buffer)
        return ([BitConverter]::ToString($Buffer)).Replace('-', '').ToLowerInvariant()
    } finally {
        $Rng.Dispose()
        [Array]::Clear($Buffer, 0, $Buffer.Length)
    }
}
if (-not (Test-Path -LiteralPath $Secrets)) {
    $AdminPassword = New-RandomSecret
    $ApiPassword = New-RandomSecret
    Set-Content -LiteralPath $Secrets -Encoding ASCII -Value @(
        "NIMIS_PG_ADMIN_PASSWORD=$AdminPassword",
        "NIMIS_PG_PASSWORD=$ApiPassword"
    )
    Write-Host 'LOCAL_PASSWORDS: GENERATED (NOT COMMITTED)' -ForegroundColor Green
}
$Values = @{}
foreach ($Line in Get-Content -LiteralPath $Secrets) {
    if ($Line -match '^([A-Z_]+)=(.+)$') {
        $Values[$Matches[1]] = $Matches[2]
    }
}
if (-not $Values.ContainsKey('NIMIS_PG_ADMIN_PASSWORD') -or
    -not $Values.ContainsKey('NIMIS_PG_PASSWORD') -or
    $Values['NIMIS_PG_ADMIN_PASSWORD'] -notmatch '^[a-f0-9]{64}$' -or
    $Values['NIMIS_PG_PASSWORD'] -notmatch '^[a-f0-9]{64}$') {
    throw 'LOCAL_SECRETS_INVALID: Do not overwrite credentials for an existing database.'
}
# A distinct fictional sync role needs a random credential, but never rotate existing secrets.
if (-not $Values.ContainsKey('NIMIS_PG_SYNC_PASSWORD')) {
    $SyncPassword = New-RandomSecret
    Add-Content -LiteralPath $Secrets -Encoding ASCII -Value "NIMIS_PG_SYNC_PASSWORD=$SyncPassword"
    $Values['NIMIS_PG_SYNC_PASSWORD'] = $SyncPassword
    Write-Host 'LOCAL_SYNC_PASSWORD: CREATED' -ForegroundColor Green
}
if ($Values['NIMIS_PG_SYNC_PASSWORD'] -notmatch '^[a-f0-9]{64}$') {
    throw 'LOCAL_SYNC_PASSWORD_INVALID: existing secrets preserved'
}
if (-not (Test-Path -LiteralPath (Join-Path $Data 'PG_VERSION'))) {
    if (Test-Path -LiteralPath $Data) {
        if (@(Get-ChildItem -LiteralPath $Data -Force).Count -gt 0) {
            throw 'DATA_DIRECTORY_NOT_EMPTY: nothing deleted'
        }
    } else { New-Item -ItemType Directory -Path $Data | Out-Null }
    $PasswordFile = Join-Path $Root '.init-password.tmp'
    try {
        Set-Content -LiteralPath $PasswordFile -Value $Values['NIMIS_PG_ADMIN_PASSWORD'] -Encoding ASCII
        & $Init -D $Data -U postgres -E UTF8 --auth-local=scram-sha-256 --auth-host=scram-sha-256 "--pwfile=$PasswordFile"
        if ($LASTEXITCODE -ne 0) { throw 'INITDB_FAILED' }
    } finally {
        if (Test-Path -LiteralPath $PasswordFile) { Remove-Item -LiteralPath $PasswordFile -Force }
    }
    Write-Host 'DATABASE_INITIALIZED: PASS' -ForegroundColor Green
}
# pg_ctl status returns exit code 3 on a fresh unstarted cluster.
# Avoid treating this expected condition as a PowerShell terminating error.
$PreviousErrorPolicy = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    & $Ctl -D $Data status 2>$null | Out-Null
    $IsRunning = ($LASTEXITCODE -eq 0)
} finally { $ErrorActionPreference = $PreviousErrorPolicy }
if (-not $IsRunning) {
    if (Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue) {
        throw 'PORT_55432_ALREADY_IN_USE'
    }
    & $Ctl -D $Data -l (Join-Path $Logs 'postgres.log') -o '-h 127.0.0.1 -p 55432' -w -t 60 start
    if ($LASTEXITCODE -ne 0) { throw 'LOCAL_POSTGRES_START_FAILED: Check database\logs\postgres.log' }
}
Write-Host 'LOCAL_POSTGRES_RUNNING: 127.0.0.1:55432' -ForegroundColor Green

$OldPassword = $env:PGPASSWORD
$OldHost = $env:PGHOST
$OldPort = $env:PGPORT
try {
    $env:PGPASSWORD = $Values['NIMIS_PG_ADMIN_PASSWORD']
    $env:PGHOST = '127.0.0.1'
    $env:PGPORT = '55432'
    & $Psql -X -w -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -c "SELECT current_setting('port')"
    if ($LASTEXITCODE -ne 0) { throw 'LOCAL_POSTGRES_AUTHENTICATION_FAILED' }
    $Exists = (& $Psql -X -w -U postgres -d postgres -v ON_ERROR_STOP=1 -t -A -c "SELECT 1 FROM pg_database WHERE datname='nimis_collect_dev'" | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'DATABASE_LOOKUP_FAILED' }
    if ($Exists -ne '1') {
        & $Psql -X -w -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE nimis_collect_dev'
        if ($LASTEXITCODE -ne 0) { throw 'DATABASE_CREATE_FAILED' }
    }
    & $Psql -X -w -U postgres -d nimis_collect_dev -v ON_ERROR_STOP=1 -f (Join-Path $Project 'server\postgres\001_dev_reference.sql')
    if ($LASTEXITCODE -ne 0) { throw 'REFERENCE_MIGRATION_FAILED' }
    & $Psql -X -w -U postgres -d nimis_collect_dev -v ON_ERROR_STOP=1 -v "app_password=$($Values['NIMIS_PG_PASSWORD'])" -f (Join-Path $Project 'server\postgres\002_local_readonly_role.sql')
    if ($LASTEXITCODE -ne 0) { throw 'READ_ONLY_ROLE_FAILED' }
    & $Psql -X -w -U postgres -d nimis_collect_dev -v ON_ERROR_STOP=1 -f (Join-Path $Project 'server\postgres\003_fictional_sync.sql')
    if ($LASTEXITCODE -ne 0) { throw 'FICTIONAL_SYNC_SCHEMA_FAILED' }
    & $Psql -X -w -U postgres -d nimis_collect_dev -v ON_ERROR_STOP=1 -v "sync_password=$($Values['NIMIS_PG_SYNC_PASSWORD'])" -f (Join-Path $Project 'server\postgres\004_local_sync_role.sql')
    if ($LASTEXITCODE -ne 0) { throw 'FICTIONAL_SYNC_ROLE_FAILED' }
} finally {
    $env:PGPASSWORD = $OldPassword
    $env:PGHOST = $OldHost
    $env:PGPORT = $OldPort
}
Write-Host 'FICTIONAL_SCHEME_DATABASE: READY' -ForegroundColor Green
Write-Host 'API_ACCOUNT: READ_ONLY' -ForegroundColor Green

$Python = Join-Path $Project '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) {
    & python -m venv '.venv'
    if ($LASTEXITCODE -ne 0) { throw 'VENV_FAILED' }
}
& $Python -m pip install --index-url https://pypi.org/simple --timeout 90 --retries 6 --disable-pip-version-check -r 'server\requirements-postgres.txt'
if ($LASTEXITCODE -ne 0) { throw 'POSTGRES_DRIVER_INSTALL_FAILED' }

$env:NIMIS_COLLECT_DATABASE_URL = "postgresql://nimis_demo:$($Values['NIMIS_PG_PASSWORD'])@127.0.0.1:55432/nimis_collect_dev"
$env:NIMIS_COLLECT_SYNC_DATABASE_URL = "postgresql://nimis_sync_demo:$($Values['NIMIS_PG_SYNC_PASSWORD'])@127.0.0.1:55432/nimis_collect_dev"
$env:NIMIS_POSTGRES_DEMO_MODE = '1'
$env:NIMIS_DEMO_MODE = '1'
Write-Host 'POSTGRES_STORAGE: database\data' -ForegroundColor Green
if ($SetupOnly) {
    Write-Host 'SETUP_ONLY: PASS — API not started' -ForegroundColor Green
    return
}
if (Get-NetTCPConnection -LocalPort 8765 -State Listen -ErrorAction SilentlyContinue) {
    throw 'API_PORT_8765_IN_USE: Stop the earlier FastAPI terminal with Ctrl+C.'
}
& (Join-Path $Project 'scripts\START_PHASE2_REFERENCE.ps1')
