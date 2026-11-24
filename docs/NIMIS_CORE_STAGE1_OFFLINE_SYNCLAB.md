# NIMIS Collect ↔ NIMIS Core Stage 1 — Offline sync test

**Status:** Functional development laboratory using **fictional** operational-status observations only. It is not an authenticated production synchronization of the mWater baseline.

## Repositories/branches

- Main NIMIS core backend: `CipherBloom07/NIMIS` branch `feat/nimis-core-transactional-backend`, draft PR #5.
- Collector mobile PWA: `CipherBloom07/NIMIS-Data-Collection` branch `feat/core-stage-offline-sync-lab`, draft PR #5.

Existing baseline drafts, photograph blobs, baseline outbox, and any prior collector demonstration remain untouched. The Stage lab uses its **own** IndexedDB database `nimis_core_stage_demo_v1`, with retained records and no automatic deletion.

## Test flow

1. Start the **already-installed portable PostgreSQL server** in `C:\Users\2025\Desktop\DCA NIMIS` using the existing Collector script. Do not delete or reinitialize its `database/data`.
2. Clone (or safely update) the Main NIMIS backend review branch into a separate folder:
   ```powershell
   cd C:\Users\2025\Desktop
   git clone --depth 1 --single-branch --branch feat/nimis-core-transactional-backend https://github.com/CipherBloom07/NIMIS.git NIMIS-Core-Stage1
   cd ".\NIMIS-Core-Stage1"
   & ".\scripts\START_NIMIS_CORE_LOCAL.ps1" -SeedFictional
   ```
   This starts a **different** `nimis_core_dev` database, then the isolated loopback FastAPI API at `127.0.0.1:8775`; no Docker required. The script reads the real local PostgreSQL admin password only for creating the isolated database and a restricted runtime login. No credentials are committed.
3. In terminal 2, launch the main NIMIS web app from that same folder:
   ```powershell
   cd C:\Users\2025\Desktop\NIMIS-Core-Stage1
   npm ci
   npm run dev -- --host 127.0.0.1 --port 8110 --strictPort
   ```
   Open `http://127.0.0.1:8110`, use **Core Database Workflow (Test)** to review fictional scheme `DEMO-NIMIS-0001`, assignments and decisions.
4. In terminal 3, clone Collector's new branch without overwriting the original PWA:
   ```powershell
   cd C:\Users\2025\Desktop
   git clone --depth 1 --single-branch --branch feat/core-stage-offline-sync-lab https://github.com/CipherBloom07/NIMIS-Data-Collection.git NIMIS-Collect-SyncLab
   cd ".\NIMIS-Collect-SyncLab"
   npm ci
   npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
   ```
   Open `http://127.0.0.1:5173`, choose **PostgreSQL Offline Sync (Test)**.
5. Save a **fictional** operational status event (default equipped 20 ha, functional 12.5 ha). The event is written to the separate IndexedDB queue without a network request.
6. Disable network in browser dev tools or disconnect temporarily and confirm the pending event survives a refresh. Reconnect and select **Sync test queue**. It should transition to `synced` only after an individually matched `accepted` or `duplicate` server acknowledgment. Transport errors keep it pending; validation/conflicts keep it in a needs-attention state.
7. In the main NIMIS Core Lab, choose the District Officer persona and **VERIFY** the staged submission. Next choose Provincial Officer and **REVIEW**. Admin persona can **TECHNICAL_APPROVE** (delegated stand-in only) and then **PUBLISH**.
8. Back in Collector Lab choose **Pull officer decisions**. The original submitter should see `PUBLISHED` after the full workflow. In Main NIMIS Lab, inspect the published-only area report. Publication remains synthetic and cannot update national scheme KPIs.

## Safety boundaries

- **Both test apps must run on the same Windows PC.** Browser-origin HTTP is allowed only for explicit loopback development ports; no phone-to-PC deployment over LAN is configured.
- Never enter real irrigation observations, personally identifying officer details, official credentials, farmer data or private photographs into these synthetic labs.
- Synthetic user IDs are deliberately forgeable; do not reuse this authentication outside loopback development. Proper SSO, device credentials, scope checks, remote revocation and encrypted storage remain to be implemented before any live sync.
- This lab does **not** upload baseline forms, real outbox records or photos; its operation type is `operational_status` v1 only. Department-approved server-driven forms 1–11, evidence attachments and secure production synchronization are outstanding.
- Duplicate event retries are idempotent and keep immutable stage history. An unapproved amendment must specify prior submission ID; conflicting events are not silently overwritten.
- PostgreSQL concurrency test success is **not** a measured system capacity guarantee. The full 100+ user load test, data backup/restore, rural mobile UAT and BI security signoff remain outstanding.

See `server/core/test_core.py` in the main repository for PostgreSQL-backed tests of role scopes, revision conflicts, duplicate prevention, batch acknowledgments and review decision status retrieval.
