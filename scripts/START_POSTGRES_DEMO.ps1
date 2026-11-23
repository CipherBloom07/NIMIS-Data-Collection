$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Root

Write-Host '=== NIMIS POSTGRESQL FICTIONAL DATA SETUP ===' -ForegroundColor Cyan
Write-Host 'LOCAL DEVELOPMENT ONLY: No real Ministry records or farmer data.' -ForegroundColor Yellow
$DockerCommand = Get-Command docker -ErrorAction SilentlyContinue
if (-not $DockerCommand) {
    throw 'DOCKER_NOT_INSTALLED: Install Docker Desktop to run the isolated local PostgreSQL test, or use an existing PostgreSQL 16 instance following docs/POSTGRESQL_SETUP.md.'
}
& docker compose version
if ($LASTEXITCODE -ne 0) { throw 'DOCKER_COMPOSE_UNAVAILABLE' }

$Compose = Join-Path $Root 'server\postgres\compose.yaml'
$EnvFile = Join-Path $Root 'server\postgres\.env.local'
if (-not (Test-Path -LiteralPath $EnvFile)) {
    $RandomBytes = New-Object byte[] 32
    $Generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $Generator.GetBytes($RandomBytes) }
    finally { $Generator.Dispose() }
    $Password = [System.BitConverter]::ToString($RandomBytes).Replace('-', '').ToLowerInvariant()
    [Array]::Clear($RandomBytes, 0, $RandomBytes.Length)
    # This local dev password is never committed; server/postgres/.env.local is ignored.
    Set-Content -LiteralPath $EnvFile -Value "NIMIS_PG_PASSWORD=$Password" -Encoding ASCII
    Write-Host 'GENERATED_LOCAL_POSTGRES_PASSWORD: PASS' -ForegroundColor Green
}

$Line = Get-Content -LiteralPath $EnvFile | Where-Object { $_ -match '^NIMIS_PG_PASSWORD=' } | Select-Object -First 1
if (-not $Line) { throw 'LOCAL_POSTGRES_ENV_MISSING_PASSWORD' }
$Password = $Line.Substring('NIMIS_PG_PASSWORD='.Length)
if ($Password -notmatch '^[a-f0-9]{64}$') { throw 'LOCAL_POSTGRES_PASSWORD_INVALID' }

& docker compose --env-file $EnvFile -f $Compose up -d
if ($LASTEXITCODE -ne 0) { throw 'POSTGRES_CONTAINER_START_FAILED' }

$Healthy = $false
for ($Try = 1; $Try -le 20; $Try++) {
    & docker compose --env-file $EnvFile -f $Compose exec -T postgres pg_isready -U nimis_demo -d nimis_collect_dev *> $null
    if ($LASTEXITCODE -eq 0) { $Healthy = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $Healthy) { throw 'POSTGRES_NOT_READY: Check Docker Desktop and container logs.' }
Write-Host 'POSTGRESQL_CONNECTION: PASS' -ForegroundColor Green

# Idempotent migration/fictional seed. No DROP, DELETE or TRUNCATE commands.
& docker compose --env-file $EnvFile -f $Compose exec -T postgres psql -v ON_ERROR_STOP=1 -U nimis_demo -d nimis_collect_dev -f /opt/nimis/001_dev_reference.sql
if ($LASTEXITCODE -ne 0) { throw 'POSTGRES_REFERENCE_MIGRATION_FAILED' }
Write-Host 'FICTIONAL_REFERENCE_SCHEMA: PASS' -ForegroundColor Green

$Python = Join-Path $Root '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $Python)) {
    & python -m venv '.venv'
    if ($LASTEXITCODE -ne 0) { throw 'PYTHON_VENV_FAILED' }
}
& $Python -m pip install --index-url https://pypi.org/simple --timeout 90 --retries 6 -r 'server\requirements-postgres.txt'
if ($LASTEXITCODE -ne 0) { throw 'PSYCOPG_DEPENDENCY_INSTALL_FAILED' }

$env:NIMIS_DEMO_MODE = '1'
$env:NIMIS_POSTGRES_DEMO_MODE = '1'
$env:NIMIS_COLLECT_DATABASE_URL = "postgresql://nimis_demo:$Password@127.0.0.1:55432/nimis_collect_dev"
Write-Host 'POSTGRESQL_REFERENCE_MODE: ENABLED (FICTIONAL)' -ForegroundColor Green
Write-Host 'LOCAL_DATABASE: PostgreSQL 16 on 127.0.0.1:55432' -ForegroundColor Green
Write-Host 'The backend will remain read-only and listen on 127.0.0.1:8765.' -ForegroundColor Yellow
& (Join-Path $Root 'scripts\START_PHASE2_REFERENCE.ps1')
