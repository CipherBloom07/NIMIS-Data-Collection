# Collector review feedback and typed forms — paired local test

Pair this branch `feat/collector-sync-ack-review-v1` with NIMIS Core branch `feat/published-form-reporting-v1`. Both remain **fictional local development**, not official field use. Preserve existing installations and browser IndexedDB by using separate checkout folders and Vite origins.

## New capabilities
- Typed object and repeating-record draft inputs, multi-selection/reference lists and catalogue-grounded test enumerations. Form structures remain provisional and Department-approved nested field definitions are still required.
- Server-enforced checks for those structures and area consistency, rather than silently sending untyped text to the database.
- Existing immutable offline event UUIDs and exact saved revisions are retained on retry. Assigned-scheme photo evidence is uploaded with checksum before the form receipt.
- **Refresh officer decisions** in Requirements Forms calls Core's private `/api/v1/stage/forms/sync/status/{event_id}` route; collectors see District returns, reasons, province/national decisions and conflicting scheme revisions. Rejected/conflicted records cannot be silently resubmitted as accepted.
- Main NIMIS Core's development-only **Published field observations** panel reads only separately approved form versions whose submissions pass the entire officer chain. Published-only CSV is available to geographic-scope officers for synthetic BI acceptance.

## Two-application test procedure

1. Run the existing isolated Main NIMIS Core backend at `127.0.0.1:8775`, using `nimis_core_dev` (see main repo's `docs/CORE_STAGE1_REQUIREMENTS_AND_RUNBOOK.md`). Start the main frontend on port `8110`; start collector preview on `5191`.
2. In main **Core Database Workflow (Test)**, create a fictional scheme and assign the synthetic collector.
3. In Collector **Requirements Forms (Draft)**, select the assigned scheme and a form (e.g., `water_availability`), enter made-up readings, **Save offline draft**, **Queue saved revision**, and synchronize when connected.
4. In Main Core, inspect receipt through officer inbox. As a district officer, return the form with a fictional reason; in Collector use **Refresh officer decisions** and confirm the return and reason appear without deleting drafts.
5. Save a corrected new revision in Collector. For the positive approval chain, a database administrator must explicitly install/approve the form catalogue and national technical delegation (never grant these just to bypass a failure). Continue DIDO verify → PIDO review → delegated national technical approval → Admin publish.
6. When the reporting mapping is approved separately, use Main Core's **Published field observations** view or scoped CSV to inspect only the published, typed values and their source/units. A Collector or other district must not see restricted report data.

## Limitations

The development stage is loopback-only and lacks Ministry production hosting, actual issued officer accounts, approved nested questionnaire schema, encrypted Android local storage, production GIS geometry and approved national aggregation. It is not safe to collect official farmer or financial records. CSV and test panel reports are explicitly marked `PUBLISHED_DEMO_ONLY`.
