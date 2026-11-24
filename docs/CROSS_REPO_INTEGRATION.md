# NIMIS Collect ↔ Main NIMIS — first isolated integration (fictional)

## Source of truth

Two separate Git repositories are being developed:
- **Collector:** `CipherBloom07/NIMIS-Data-Collection`, branch `feat/collector-district-integration`
- **Main web app:** `CipherBloom07/NIMIS`, branch `feat/collector-district-integration`

The main NIMIS repository is **currently a frontend prototype** with a localStorage registry and no approved central authentication or production database. This integration therefore targets only a dedicated local **fictional PostgreSQL database**. It cannot and must not be called Ministry production sync.

## Implemented demonstration flow

1. Collector launches NIMIS Collect in development mode, opens **Collector–District test** and explicitly sends the hardcoded `DEMO-SCHEME-001` with a fictional observation.
2. The local FastAPI server issues a short-lived **officer.demo** token only on loopback, checks the active server-side scheme assignment and accepts a per-event UUID idempotently.
3. PostgreSQL records the fictional event in `nimis_collect_demo.field_submission` as `SUBMITTED`.
4. Main NIMIS dev UI on port **8081** opens **District Collector Inbox (Test)**; the browser obtains a separate loopback-only **district.demo** token and fetches district-scoped rows.
5. District reviewer may **Verify test**, or enter a reason and **Return test**. Repeated decisions fail with HTTP 409.
6. The **Provincial Review (Test)** page uses **provincial.demo** to review a district-verified fictional submission.
7. The **Admin Publication (Test)** page uses **admin.demo** to publish a provincially reviewed record to a **fictional-only status**. No real national dashboard data or official Ministry database is modified.
8. District, provincial and admin decisions are appended to a separate fictional decision-history table. No merge/deploy occurs.

The collector's real IndexedDB drafts, outbox, photos and GPS stay on the device and are **never read or uploaded** by the integration test. The main app's local prototype registry is not touched. Development credentials and data live in ignored `database/` and environment variables.

## Local Windows setup

Prerequisites: PostgreSQL 16 Windows binaries downloaded and unpacked by the portable script, Python dependencies installed, Node.js. Docker is **not required**.

Terminal A, from collector repo (stop an older FastAPI server on port 8765 first):

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
git fetch origin
git switch --track origin/feat/collector-district-integration
& ".\scripts\START_POSTGRES_DEMO.ps1"
```

If your local Git working tree contains changes, `git switch` may refuse; **do not reset or discard them**. Backup/stash just the conflicting files, or use another reviewed working tree. The existing PostgreSQL `database/` folder is excluded from Git and persists across branch changes.

Terminal B, collector frontend:

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
npm install
npm run dev -- --port 5173 --strictPort
```

Terminal C, **separate main NIMIS clone** (not the collector folder):

```powershell
cd "C:\Users\2025\Desktop"
git clone --depth 1 --single-branch --branch feat/collector-district-integration https://github.com/CipherBloom07/NIMIS.git NIMIS-Main-Integration
cd ".\NIMIS-Main-Integration"
npm install
npm run dev -- --port 8081 --strictPort
```

Open:
- NIMIS Collect: `http://127.0.0.1:5173/` → **Collector–District test**
- Main NIMIS: `http://127.0.0.1:8081/` → **District Collector Inbox (Test)** → **Provincial Review (Test)** → **Admin Publication (Test)**

The API accepts CORS only from the loopback main NIMIS dev origin. Both apps must be opened on the same Windows computer for this first demonstration.

## Current security and feature boundaries

- Demo tokens are NOT real authentication; usernames `officer.demo` and `district.demo` work only on loopback, with `NIMIS_DEMO_MODE=1`.
- Database demo operations require a separate password for a restricted PostgreSQL account. No direct browser connection to PostgreSQL.
- The backend refuses a non-loopback database target or a database not named `nimis_collect_dev`.
- The demo accepts **only** `DEMO-SCHEME-001` and a 200-character fictional note; it never imports arbitrary survey JSON or uploads photos.
- Collector assigned schemes are determined server-side. Reused event UUIDs with different data are rejected.
- District and provincial inboxes are restricted to their fictional geographical scopes; the admin inbox sees only provincially reviewed fictional records. Each inbox returns at most 100 rows.
- Valid transitions are SUBMITTED → VERIFIED → REVIEWED → PUBLISHED (fictional only), with RETURNED available at district/provincial review. Every accepted decision has a separate immutable demo history row.
- No production user roles, device enrolment, encrypted mobile DB, legal approval, full sync protocol, server acknowledgement of real outbox entries, conflict resolution, photo transfer or offline auto-retry is implemented.
- A passing CI test validates fictional end-to-end flow in isolated PostgreSQL only. It does not demonstrate cross-device field readiness or throughput.

## Path to real synchronization

1. Department ICT must approve the authoritative **main NIMIS PostgreSQL/PostGIS scheme registry**, role permissions and database migrations.
2. Replace demo JWT with official account and enrolled-device authentication; register four UI roles (Admin, Provincial Officer, District Officer, Data Collector).
3. Implement durable `/api/v1/sync/push` and `/api/v1/sync/pull`, safe per-operation acknowledgements, version conflicts, revocations and delta cursors.
4. Transfer photographs to private object storage with checksums and resume support, and link their metadata to submissions.
5. Add District verification, Provincial review and Admin publication on shared server-owned records (never overwrite official masters from collector input).
6. Run device offline/online load tests, end-to-end authorization tests, audit and backup/restore drills.

**No changes have been made to any official Ministry database or deployed service.**
