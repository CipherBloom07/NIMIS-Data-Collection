# NIMIS + NIMIS Collect — connected local pilot

**Purpose:** operate both existing development applications together *without changing the Main NIMIS repository or its UI*. This is a **fictional-data pilot**, not production sign-off.

## What this branch changes

- Collector's **PostgreSQL Offline Sync (Test)** screen now downloads its selectable schemes from the existing NIMIS Core `/api/v1/stage/schemes` endpoint, which enforces the current synthetic collector's assignments.
- The chosen scheme uses Core's UUID, scheme code, district/province and current master revision. The collector never creates a shadow scheme master.
- Save to the isolated offline pilot outbox, sync with idempotent UUIDs, and pull reviewer status from the same Core stage API.
- Existing baseline surveys, media, saved photos, draft questionnaire views, original offline outbox and visual theme are **unchanged and are not uploaded**.
- This also does NOT modify Main NIMIS code, settings, or database; Main Core is read-only during scheme lookup and is modified only by user-initiated fictional submissions using its existing API.

## Existing local Core backend

Use your **existing Main NIMIS Core clone**, on `feat/nimis-core-transactional-backend`, and the approved local developer setup documented in that repository's `docs/CORE_STAGE1_REQUIREMENTS_AND_RUNBOOK.md`. It uses a separate `nimis_core_dev` database and port `8775`. It must run under fictional Stage 1 mode, with an assigned synthetic data collector and fictional scheme.

**Do not run** the proposed production schema migrations from other branches against this pilot. Do not point this at institutional data.

## Start Collector on Windows (PowerShell)

In the NIMIS Data Collection repository, after reviewing/checking out this branch without overwriting unsaved work:

```powershell
git status --short
git fetch origin
git switch --track origin/feat/core-assigned-scheme-pilot
npm ci
.\scripts\START_CONNECTED_COLLECTOR_PILOT.ps1
```

If the local branch already exists, use `git switch feat/core-assigned-scheme-pilot`. Never use `git reset --hard` or `git clean -fd` to change branches. The script refuses a wrong repository, checks the existing Core API and starts only the Collector Vite frontend. It does not start or stop the Main NIMIS service.

Open Collector on `http://127.0.0.1:5173` → **PostgreSQL Offline Sync (Test)**. Scheme choices should match the active synthetic collector's assignments in Main Core. Main dashboard is separately available from the user's existing Main Core frontend.

## Verify cross-app behavior (fictional data)

1. In Main Core's **Core Database Workflow (Test)**, create/verify a fictional scheme and assign it to the synthetic collector.
2. Refresh Collector's **PostgreSQL Offline Sync (Test)** page; the scheme dropdown lists only Core-assigned records, not a manually invented ID.
3. Disconnect network, create a fictional monthly operational observation and save it to the separate test outbox. Reconnect.
4. Sync the test queue; the server should acknowledge each event by its stable event UUID. A repeated event returns duplicate, not a new record.
5. In Main Core, verify as District, review as Province, technical-approve under the delegated Admin test account, then publish (all synthetic).
6. In Collector, use **Pull officer decisions** to refresh status. Published-only area totals are available in Main Core's dev report.

## Remaining blocking requirements for actual field use

The full 11 forms, secure Android offline database/enrolment, real photo upload, automatic signed user sessions, reliable background sync, central UUID master and geospatial RLS, officer conflict resolution, formal delegation, audit retention, backup/restore, and official Ministry UAT are **not finished**. Do not send real data to this fictional pilot.

**Why no production sync yet:** NIMIS Core currently supports typed `operational_status` v1 only, while baseline surveys contain other photo/GPS fields; forcing these records into this endpoint would silently discard data. The safe next step is to reconcile and approve the full shared data dictionary and authenticating identity provider, then implement one common official `/sync` API.
