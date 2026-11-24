# NIMIS Collect — Portable PostgreSQL for Windows (no Docker)

NIMIS Collect uses local IndexedDB for offline draft capture. Its read-only fictional development reference API can use **PostgreSQL 16**, with all files stored within the repository under the ignored `database/` directory.

## One-time requirement: official PostgreSQL ZIP

The official PostgreSQL Windows information page confirms that EnterpriseDB distributes a **ZIP archive of Windows binaries**, separate from the machine-wide installer:
- https://www.postgresql.org/download/windows/
- https://www.enterprisedb.com/download-postgresql-binaries

Download the **PostgreSQL 16 Windows x86-64 binary ZIP** (not the .exe installer), and save it in your Windows `Downloads` folder. Keep its official archive name, such as `postgresql-16.x-*-windows-x64-binaries.zip`. We do **not** guess an unverified download URL or publish a checksum the vendor has not supplied.

## Run inside your project folder

From PowerShell:

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
git pull --ff-only origin feat/offline-pwa-foundation
& ".\scripts\START_POSTGRES_DEMO.ps1"
```

You may optionally specify another location:

```powershell
& ".\scripts\START_POSTGRES_DEMO.ps1" -ArchivePath "C:\Path\To\postgresql-16.x-windows-x64-binaries.zip"
```

The script will:
1. Detect the PostgreSQL 16 binaries in `database/postgresql/`, or extract the ZIP into that folder.
2. Generate random local passwords in `database/.env.local` (never committed).
3. Initialize `database/data/` using SCRAM authentication, **only if it has not already been initialized**.
4. Start PostgreSQL with `pg_ctl` listening on **127.0.0.1:55432**. No Windows service is registered; Docker Desktop is not needed.
5. Create isolated database `nimis_collect_dev`, seed the single **fictional** scheme, and create a **read-only API role**.
6. Install Python's optional PostgreSQL driver in the existing NIMIS `.venv`.
7. Start the existing FastAPI development reference server on **127.0.0.1:8765**.

If the existing FastAPI server is running, use Ctrl+C to stop it **before** launching this new mode, since both listen on port 8765.

A second PowerShell terminal runs `npm run dev`. Open `http://127.0.0.1:5173`; choose **Assigned schemes → Connect fictional local demo**. The reference database should show **PostgreSQL (fictional)**.

## Directory layout

```text
DCA NIMIS/
  src/                        frontend
  server/                     FastAPI
  scripts/START_POSTGRES_DEMO.ps1
  scripts/START_POSTGRES_LOCAL.ps1
  database/                   ignored by Git — do not delete
    postgresql/               PostgreSQL binaries
      bin/psql.exe
      bin/initdb.exe
    data/                     PostgreSQL data cluster
    logs/postgres.log
    .env.local                generated passwords — DO NOT SHARE
```

The persistent database is isolated from the repository code and **is not removed by Git pull**, `npm install`, or the startup script. The ZIP may be large; ensure sufficient storage before extraction. PostgreSQL native Windows binaries may require Microsoft Visual C++ runtime packages; if missing, use the vendor's official runtime guidance.

## Stop the database safely

First stop the FastAPI script with Ctrl+C. In a new terminal, run:

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
& ".\scripts\STOP_POSTGRES_LOCAL.ps1"
```

Do not terminate the PostgreSQL process in Task Manager, and **do not delete `database/data`** to solve a connection error.

## Limits and production boundary

This setup is for offline-first development and **fictional reference data only**. It is not connected to or a replacement for the Ministry's production scheme master. The official form approval, server-authoritative enrolment, encrypted storage, secure sync, DIDO/PIDO approval, audited backups and high-availability PostgreSQL/PostGIS deployment are still pending security and architecture review.

The existing Docker demo is available separately as `scripts/START_POSTGRES_DOCKER.ps1`, but is optional.
