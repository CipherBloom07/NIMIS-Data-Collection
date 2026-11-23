$ErrorActionPreference = 'Stop'
$Project = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $Project

if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
    throw 'FLUTTER_NOT_INSTALLED'
}

Write-Host '=== NIMIS V2 CLEAN FLUTTER SETUP ===' -ForegroundColor Cyan

if (-not (Test-Path 'android/app/src/main/AndroidManifest.xml')) {
    & flutter create --platforms android --project-name nimis_field_collector .
    if ($LASTEXITCODE -ne 0) { throw 'FLUTTER_CREATE_FAILED' }
}

$Manifest = 'android/app/src/main/AndroidManifest.xml'
[xml]$Document = Get-Content -LiteralPath $Manifest -Raw
$Root = $Document.DocumentElement
$AndroidNS = 'http://schemas.android.com/apk/res/android'
foreach ($Name in @(
    'android.permission.ACCESS_FINE_LOCATION',
    'android.permission.ACCESS_COARSE_LOCATION',
    'android.permission.CAMERA'
)) {
    $Existing = @($Root.SelectNodes('uses-permission') | Where-Object {
        $_.GetAttribute('name', $AndroidNS) -eq $Name
    })
    if ($Existing.Count -eq 0) {
        $Permission = $Document.CreateElement('uses-permission')
        $Permission.SetAttribute('name', $AndroidNS, $Name)
        [void]$Root.InsertBefore($Permission, $Root.SelectSingleNode('application'))
    }
}
$Document.Save((Resolve-Path $Manifest).Path)

$GeneratedTest = 'test/widget_test.dart'
if (Test-Path $GeneratedTest) {
    Remove-Item $GeneratedTest -Force
}

& flutter pub get
if ($LASTEXITCODE -ne 0) { throw 'PUB_GET_FAILED' }
& flutter analyze
if ($LASTEXITCODE -ne 0) { throw 'ANALYSIS_FAILED' }
& flutter test
if ($LASTEXITCODE -ne 0) { throw 'TESTS_FAILED' }

Write-Host 'NIMIS_CLEAN_START_VALIDATION: PASS' -ForegroundColor Green
Write-Host 'Run flutter run on your Android device or emulator.'
