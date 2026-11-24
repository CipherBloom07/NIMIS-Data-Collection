# Restore/verify NIMIS Collect UI without touching NIMIS Main

The NIMIS Collect frontend (`src/App.tsx` and `src/official-theme.css`) is byte-for-byte unchanged from `feat/collector-district-integration` through `feat/district-verification-v1`. Newer changes are backend/contract-only.

The repository also has a distinct `feat/v2-clean-flutter-start` branch, which is a different app. A previously installed PWA can continue displaying cached assets at the original port. A fresh preview on 127.0.0.1:5191 isolates the app's service worker and browser storage, **but this also means existing surveys may not appear in that preview**: do not conclude they were deleted. They stay in the original origin's IndexedDB unless separately cleared.

## Safe diagnostic

From PowerShell, replace the path below with the existing **Collector** directory (never the Main NIMIS directory):

```powershell
$Collector = "C:\Users\MY-PC\NIMIS-Data-Collection"
$Url = "https://raw.githubusercontent.com/CipherBloom07/NIMIS-Data-Collection/fix/collector-ui-safe-recovery/scripts/SAFE_COLLECTOR_UI_RECOVERY.ps1"
$Script = Join-Path $env:TEMP "SAFE_COLLECTOR_UI_RECOVERY.ps1"
Invoke-WebRequest -Uri $Url -OutFile $Script
& $Script -CollectorPath $Collector -InspectOnly
```

If UI_MATCH is PASS and no files were unexpectedly modified:

```powershell
& $Script -CollectorPath $Collector -PreviewPort 5191
```

Open `http://127.0.0.1:5191/` while the terminal stays open. This is a separate **test origin**; original IndexedDB survey data is not copied to it.

If UI_MATCH differs, stop. Save the output and check the worktree; do not `git reset --hard`, `git clean -fd`, switch branches with uncommitted edits, unregister service workers, or clear site data. Those actions could destroy uncommitted code, drafts or offline photos.

If port 5191 is occupied, choose 5192. The tool never kills a process.

## Recovery classification

- **Expected UI hash PASS, preview looks correct:** the source layout is intact; investigate old port, PWA cache, wrong browser origin or a different running server.
- **Expected UI hash DIFFERENT:** inspect the Git diff; preserve a patch or branch before selectively restoring only reviewed UI files.
- **Wrong app/branch:** use a separate clone or worktree of the correct PWA branch; never force-switch or delete the Flutter worktree.
- **Drafts apparently missing on new port:** each origin's IndexedDB is distinct; check the original origin and do not clear browser data.

No NIMIS Main code, database or deployment is involved in this recovery branch.
