# Backward-compatible launcher: portable PostgreSQL is now the default.
# Docker mode remains available as START_POSTGRES_DOCKER.ps1.
param([string]$ArchivePath = '', [switch]$SetupOnly)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'START_POSTGRES_LOCAL.ps1') -ArchivePath $ArchivePath -SetupOnly:$SetupOnly
