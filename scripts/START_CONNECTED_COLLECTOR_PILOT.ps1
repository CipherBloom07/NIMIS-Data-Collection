# NIMIS Collect interconnected PILOT — collector-only launcher.
# Read-only health check for Main NIMIS Core; does not edit, start or stop Main NIMIS.
# Fictional local development ONLY. No real field records should be entered.
[CmdletBinding()]
param([string]$CollectorPath=(Get-Location).Path,[int]$CollectorPort=5173)
$ErrorActionPreference='Stop'
$Root=(Resolve-Path -LiteralPath $CollectorPath).Path
if (-not (Test-Path (Join-Path $Root 'src\CoreStageSyncLab.tsx')) -or
    -not (Test-Path (Join-Path $Root 'src\core-stage-sync.ts')) -or
    -not (Test-Path (Join-Path $Root 'package.json'))) {
  throw 'Not the NIMIS Collect cross-app pilot branch. No files changed.'
}
Push-Location $Root
try {
  $Remote=(& git remote get-url origin 2>$null)
  if ($LASTEXITCODE -ne 0 -or $Remote -notmatch '(^|[/:])CipherBloom07/NIMIS-Data-Collection(\.git)?$') {
    throw 'Unexpected Git remote. Refusing to touch another app.'
  }
  $Branch=(& git branch --show-current).Trim()
  Write-Host "COLLECTOR_BRANCH: $Branch" -ForegroundColor Cyan
  if (@(& git status --porcelain).Count) {
    Write-Warning 'Uncommitted local changes exist. No Git reset or switch is attempted.'
  }
  $CoreUrl='http://127.0.0.1:8775/api/v1/stage/health'
  try {
    $Health=Invoke-RestMethod -Uri $CoreUrl -TimeoutSec 5
    if ($Health.source -eq 'OFFICIAL' -or $Health.production_ready -eq $true -or
        $Health.mode -ne 'isolated-development') {
      throw 'Core API is not the expected isolated development instance.'
    }
    Write-Host 'MAIN_NIMIS_CORE: REACHABLE (isolated development only)' -ForegroundColor Green
  } catch {
    Write-Warning "MAIN_NIMIS_CORE: unavailable at $CoreUrl"
    Write-Warning 'Start the EXISTING Main NIMIS Core local backend separately. This launcher will not modify it.'
    return
  }
  if (Get-NetTCPConnection -State Listen -LocalPort $CollectorPort -ErrorAction SilentlyContinue) {
    throw "Collector port $CollectorPort already in use. Nothing was stopped. Choose another -CollectorPort."
  }
  if (-not (Test-Path (Join-Path $Root 'node_modules\vite'))) {
    Write-Host 'COLLECTOR_PACKAGES: installing pinned dependencies for first launch' -ForegroundColor Cyan
    & npm ci
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $Root 'node_modules\vite'))) {
      throw 'COLLECTOR_NPM_INSTALL_FAILED: verify Node.js/npm and package-lock.json'
    }
  }
  Write-Host 'DATA_SAFETY: Existing IndexedDB survey drafts, photos, local outbox untouched.'
  Write-Host 'PILOT_NOTE: Main Core requires the seeded fictional collector assignment before a scheme appears.'
  Write-Host "COLLECTOR_URL: http://127.0.0.1:$CollectorPort/" -ForegroundColor Green
  Write-Host 'Open PostgreSQL Offline Sync (Test) in Collector. Ctrl+C stops only this Collector preview.'
  & npm run dev -- --host 127.0.0.1 --port $CollectorPort --strictPort
} finally { Pop-Location }
