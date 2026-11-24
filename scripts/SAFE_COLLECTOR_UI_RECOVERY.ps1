# NIMIS Collect: non-destructive UI verification and isolated preview
# ONLY for CipherBloom07/NIMIS-Data-Collection. Does not switch branches,
# reset files, clear cache, delete surveys/photos, or touch NIMIS Main.
[CmdletBinding()]
param(
  [string]$CollectorPath = (Get-Location).Path,
  [int]$PreviewPort = 5191,
  [switch]$InspectOnly
)
$ErrorActionPreference = 'Stop'
Write-Host "=== NIMIS COLLECT SAFE UI RECOVERY ===" -ForegroundColor Cyan
$Root = (Resolve-Path -LiteralPath $CollectorPath).Path
if (-not (Test-Path (Join-Path $Root '.git'))) { throw 'Not a Git worktree. Supply CollectorPath.' }
if ((Test-Path (Join-Path $Root 'src\App.jsx')) -or
    -not (Test-Path (Join-Path $Root 'src\App.tsx')) -or
    -not (Test-Path (Join-Path $Root 'src\official-theme.css')) -or
    -not (Test-Path (Join-Path $Root 'package.json'))) {
  throw 'Wrong app or branch. Expected NIMIS Collect React/PWA; no changes were made.'
}
Push-Location $Root
try {
  $Remote = (& git remote get-url origin 2>$null)
  if ($LASTEXITCODE -ne 0 -or $Remote -notmatch '(^|[/:])CipherBloom07/NIMIS-Data-Collection(\.git)?$') {
    throw 'Unexpected Git repository remote. No changes were made.'
  }
  $Branch = (& git branch --show-current).Trim()
  $Head = (& git rev-parse --short HEAD).Trim()
  $Changes = @(& git status --porcelain)
  $AppBlob = (& git hash-object -- 'src/App.tsx').Trim()
  $ThemeBlob = (& git hash-object -- 'src/official-theme.css').Trim()
  $ExpectedApp = '1cdd052affe4553b3109c84487a1f3bb87b2332f'
  $ExpectedTheme = '6efc827f0bcf55985838307f96c8b7c6c524fa79'
  Write-Host "REPOSITORY: $Remote"
  Write-Host "BRANCH: $Branch | COMMIT: $Head"
  Write-Host "LOCAL_CHANGED_FILES: $($Changes.Count)"
  if ($Changes.Count) {
    $Changes | Select-Object -First 25 | ForEach-Object { Write-Host "  $_" }
  }
  $UiMatch = $AppBlob -eq $ExpectedApp -and $ThemeBlob -eq $ExpectedTheme
  if ($UiMatch) {
    Write-Host 'UI_MATCH: PASS (same App and theme as previous Collector integration)' -ForegroundColor Green
  } else {
    Write-Host 'UI_MATCH: DIFFERENT — source files may have changed' -ForegroundColor Yellow
    Write-Host "APP_BLOB: $AppBlob EXPECTED: $ExpectedApp"
    Write-Host "THEME_BLOB: $ThemeBlob EXPECTED: $ExpectedTheme"
  }
  $Listeners = @(Get-NetTCPConnection -LocalPort $PreviewPort -State Listen -ErrorAction SilentlyContinue)
  Write-Host "PREVIEW_PORT_IN_USE: $($Listeners.Count -gt 0)"
  Write-Host 'DATA_PRESERVED: Git files, IndexedDB, photos, PWA caches unchanged.'
  if ($InspectOnly) { return }
  if (-not $UiMatch) {
    Write-Warning 'UI differs from expected. Stopping safely. Share diagnostics before any reset.'
    return
  }
  if ($Listeners.Count) {
    Write-Warning 'Preview port busy. Choose -PreviewPort 5192. No process was killed.'
    return
  }
  if (-not (Test-Path (Join-Path $Root 'node_modules\vite'))) {
    Write-Warning 'Vite dependencies missing. No npm installation attempted.'
    return
  }
  Write-Host "COLLECTOR_PREVIEW: http://127.0.0.1:$PreviewPort/" -ForegroundColor Green
  Write-Host 'Distinct port avoids the service-worker scope of an older localhost app.'
  Write-Host 'Ctrl+C ends this preview. Main NIMIS is unaffected.'
  & npm run dev -- --host 127.0.0.1 --port $PreviewPort --strictPort
} finally {
  Pop-Location
}
