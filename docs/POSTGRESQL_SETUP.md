> **Windows project-local mode is now the default (no Docker required).** Follow [PORTABLE_POSTGRESQL_WINDOWS.md](PORTABLE_POSTGRESQL_WINDOWS.md) and run `scripts/START_POSTGRES_DEMO.ps1`. The Docker instructions below remain an **optional** alternative via `scripts/START_POSTGRES_DOCKER.ps1`.

# PostgreSQL + PostGIS architecture for NIMIS Collect

## What is actually implemented

The web PWA still uses IndexedDB as **offline draft storage**. A central PostgreSQL database is required for cross-device, district, provincial and national authoritative records.

This branch now supports an **isolated, fictional PostgreSQL 16 development adapter** in the FastAPI reference backend. It reads the officer role and assigned schemes through server-side queries, filtered by user ID and active assignments. Assignment revocation is exercised by a real PostgreSQL CI test.

The demo schema is `nimis_collect_demo`. Do not mistake this for a production master. A separate **review-only** PostGIS/NIMIS data model is in:
- `server/schema/001_nimis_collect_REFERENCE_ONLY.sql`
- `sql/001_nimis_collect_REFERENCE_REVIEW.sql`

These two drafts need reconciliation with the official NIMIS database. **Neither is an approved production migration.**

## Run local fictional PostgreSQL on Windows

Requirements: Python 3.13 (already installed in the user's environment), Node.js for the frontend, Docker Desktop with Docker Compose, and enough free storage to download the PostgreSQL image.

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
git pull --ff-only origin feat/offline-pwa-foundation
& ".\scripts\START_POSTGRES_DEMO.ps1"
```

The script does the following safely:

1. Creates a local, ignored `server/postgres/.env.local` with a random developer password if none exists (does not overwrite an existing one).
2. Starts an isolated `postgres:16-alpine` container on **127.0.0.1:55432**, using a named persistent Docker volume.
3. Applies `server/postgres/001_dev_reference.sql` idempotently to the **nimis_collect_dev** database, inserting one fictional scheme and one fictional officer assignment.
4. Installs the optional `psycopg` PostgreSQL client into the existing project's Python virtual environment.
5. Runs the existing local reference API at **127.0.0.1:8765** in read-only demo mode.

It neither overwrites existing local browser drafts nor touches an external server. To preserve the database, do **not** run `docker compose down -v` or delete the named volume.

Start the React UI in a separate terminal:

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
npm run dev
```

Open `http://127.0.0.1:5173`, then choose **Assigned schemes** → **Connect fictional local demo**. Under Reference database you should see **PostgreSQL (fictional)**. The main NIMIS read/write sync is **not connected**.

If Docker Desktop is unavailable, keep using `scripts/START_PHASE2_REFERENCE.ps1` for the in-memory demo. To use an existing isolated PostgreSQL instance instead, provision an **empty** database named `nimis_collect_dev`, run the SQL migration in that database, install `server/requirements-postgres.txt`, set `NIMIS_DEMO_MODE=1`, `NIMIS_POSTGRES_DEMO_MODE=1`, and `NIMIS_COLLECT_DATABASE_URL` in the process environment, then launch the reference server. Never share the connection string in a chat or commit it to Git.

## Proposed production topology

```text
Field mobile / PWA
    |   Encrypted local DB + compressed photo outbox (native security work outstanding)
    |   HTTPS / user+device authenticated / idempotent operations
    v
NIMIS Collect FastAPI API cluster
    |  Role/assignment checks and form validation
    |  Transactional sync, approvals, audit and conflict resolution
    v
Main NIMIS PostgreSQL + PostGIS
    |  authoritative scheme IDs / GIS / structured records / indexed history
    |
    +--> Private object storage (photo/document binaries, SHA-256, access checks)
    |
    +--> Backups, monitoring, retention and disaster recovery
```

**Do not store large photographs directly in PostgreSQL for normal production use.** Store metadata, checksums, references and permissions in PostgreSQL, with encrypted photo bytes in private object storage.

Database size is not a fixed record count; real capacity depends on disks, indexes, partitioning, caching, query load, retention and backup architecture. The goal of 1,000 assigned schemes on a 2 GB RAM Android device remains a performance acceptance test; CI's PostgreSQL tests are not proof of that.

## Security and migration gates before production

- Select existing Ministry NIMIS PostgreSQL service and authoritative scheme ID contract.
- Formal database design review; avoid two independent master registries.
- Provision least-privilege API roles, RLS/row filtering and immutable audit history.
- Add migrations with rollback plans, backups and verified restore.
- Implement controlled auth/device enrolment and 30-day offline policy.
- Implement per-record push/pull, idempotency keys, conflicts, tombstones and attachment chunks.
- Configure encrypted local device storage and audited access to personal records.
- Complete all 15 field acceptance scenarios and device load benchmarks.

No production DB was created, modified or accessed in this task.
