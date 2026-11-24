# Run the paired NIMIS + NIMIS Collect field-form pilot safely

**Development environment only. Use fabricated schemes and measurements.**
Both review branches are isolated from the default branches and official Ministry databases.

## Prerequisites

- Windows PowerShell, Git, Node/npm, Python 3.12 supported by the stage, existing local PostgreSQL 16 on `127.0.0.1:55432` with the previously configured local dev credentials.
- Existing NIMIS Core local setup: `docs/CORE_STAGE1_REQUIREMENTS_AND_RUNBOOK.md` in main NIMIS repo.
- Use **two fresh separate folders**, not your current NIMIS master folder or existing Collector installation. Do not delete or clear old PWA browser storage.
- The local NIMIS Core test backend must have `NIMIS_STAGE_ENABLE=1` and `NIMIS_STAGE_DEV_AUTH=1` and the existing seeded **fictional** collector/district/province/admin users. Dev header identities are not valid for a real deployment.

## Fresh preview clones

Terminal A (isolated main Core branch; do **not** use your deployed main NIMIS directory):
```powershell
cd $env:USERPROFILE
git clone --branch feat/collector-field-form-staging-contract --single-branch https://github.com/CipherBloom07/NIMIS.git NIMIS-Core-Form-Pilot
cd .\NIMIS-Core-Form-Pilot
.\scripts\START_NIMIS_CORE_LOCAL.ps1 -SeedFictional
```

In a separate Main Core frontend terminal:
```powershell
cd "$env:USERPROFILE\NIMIS-Core-Form-Pilot"
npm ci
npm run dev -- --host 127.0.0.1 --port 8110 --strictPort
```

Terminal B (isolated Collector branch):
```powershell
cd $env:USERPROFILE
git clone --branch feat/requirements-aligned-collection-v1 --single-branch https://github.com/CipherBloom07/NIMIS-Data-Collection.git NIMIS-Collect-Forms-Pilot
cd .\NIMIS-Collect-Forms-Pilot
npm ci
npm run dev -- --host 127.0.0.1 --port 5191 --strictPort
```

Open Main NIMIS test page `http://127.0.0.1:8110/` → **Core Database Workflow (Test)** and Collector `http://127.0.0.1:5191/` → **Requirements Forms (Draft)**. If the NIMIS Core launcher reports that local PostgreSQL is unavailable, follow its documented prerequisites; do not initialize another cluster over existing records.

## Acceptance walkthrough

1. In the Core **test** workflow, create a fabricated irrigation scheme and assign it to the synthetic collector. Confirm Core's health at `http://127.0.0.1:8775/api/v1/stage/health`.
2. Reload Collector; choose **Requirements Forms (Draft)**; select the newly assigned scheme UUID. Select any proposed form, e.g., Water Availability and Abstraction.
3. Enter *fictional* measurements and metadata. Save an offline draft, then **Queue saved revision (fictional test)**. The exact snapshot and event UUID persist in IndexedDB.
4. Disconnect the internet (do not stop the local API) or temporarily stop the Core API to simulate a network outage. Try **Sync test queue to NIMIS Core**. The queue must remain pending if the API is unavailable.
5. Restore connectivity or the API. Sync or reconnect; a successful per-item acknowledgement must mark the local event `synced`. Retry the same event; the receiving API must not create another record.
6. In Main Core (Test), choose district/province/admin persona and **Connect / Refresh**. The **Collected field forms (unapproved staging)** table shows the scheme, form, period, status and missing-evidence flag. Other districts cannot see it.
7. Confirm the general national dashboard and the published-only area report **do not change**. These forms are awaiting schema/evidence approval, not verified.
8. For any photo reference, confirm receipt status is **EVIDENCE_PENDING**. The photo binary stays on the Collector and is *not* yet synchronized.

## When is this suitable for actual work?

Not yet. This pilot proves an early end-to-end transport of proposed **form JSON and GPS metadata** into a development staging table only. Before actual Ministry field use, the approved full questionnaire/options, individual secure identities, district assignments, native encrypted offline store, private photo transfer, reviewed GIS geometry, actual stage-specific verification and publication, reporting connections, data protection and tested backup/restore are needed. Never enter actual farmer contact details, sensitive operations, billing or official data into this pilot.

The two unmerged review PRs are:
- NIMIS Collect: https://github.com/CipherBloom07/NIMIS-Data-Collection/pull/11
- NIMIS Core: https://github.com/CipherBloom07/NIMIS/pull/9
