# NIMIS Collect: Storage capacity and data safety — current implementation

## Local device storage

- Irrigation survey drafts and evidence are kept locally in IndexedDB when offline. This is not encrypted at rest and is **not a production-safe farmer-data store**.
- Officers can open **Storage Management** from the sidebar to see the draft count, photograph count/bytes, historical local operation count, and browser-supplied storage usage/quota estimates.
- Browser quota is **not** equivalent to physical free space. Low-capacity warnings appear in the app when the browser estimates under 100 MiB or 10% free (warning); under 25 MiB or 5% free is critical.
- Officers may request browser **persistent storage**, if supported. This reduces some eviction risks but cannot guarantee availability or prevent explicit user deletion.
- No automated deletion of photos, draft data, or pending history is enabled. Do not clear browser data while unsynced.
- Full photo-inclusive backup/restore is **not yet implemented**. Existing JSON export omits photo binaries; do not rely on it as a complete backup.
- Continuous field autosaves update draft state without accumulating an immutable synchronization operation for every keystroke. Explicit Save & dashboard records a local historical operation. No server acknowledgements or safe historical pruning exist yet.
- New JPG/PNG/WebP photographs up to 12 MB input are resized with a 1600/1280/1024/800 pixel progressive JPEG encoder, targeting at most 500 KiB. Unsupported formats are rejected with a clear error. Existing stored photographs remain unchanged.

## Server database and nationwide scaling

- The **planned central datastore is PostgreSQL + PostGIS**, under the authority of the main NIMIS system.
- The **currently usable local PostgreSQL mode contains FICTIONAL development data only**, so the app can test server-side access and real database queries without risking Ministry records.
- Cursor-based scheme pagination allows assignments above 500 to be retrieved. The UI renders a small batch at a time. A PostgreSQL CI integration test inserts 1,000 **temporary fictional schemes**, reads them with scope checks and pagination, then deletes only its own temporary fixtures.
- PostgreSQL records will hold scheme metadata, surveys, audit and temporal observations; private object storage should hold compressed photo binaries, with checksum references in PostgreSQL.
- Real production capacity, query speed, replication, disk sizing, backup/restore, migration safety, permission enforcement and **2 GB RAM Android performance** still require dedicated benchmarking and a proper deployment environment.

## Manual test checklist

- [ ] Open Storage Management, refresh estimates, confirm numbers match current local drafts/photos.
- [ ] Try 3 phone photo captures with image under 12 MB; ensure each saved photo is under 500 KiB and its preview is still readable.
- [ ] Save a draft offline, refresh/restart, verify all answers and evidence remain.
- [ ] Switch between modules while editing and reopen; verify latest values persisted.
- [ ] Trigger simulated low quota in browser testing to check the dashboard warning. Never exhaust a real device's storage as a test.
- [ ] Verify normal use on a 2 GB RAM Android phone with 1,000 scheme masters (not yet executed).
- [ ] Test server pagination with `/api/v1/schemes?limit=200&cursor=<last_scheme_id>` against the isolated PostgreSQL fixture.
- [ ] Test restoring a full field-device backup including photos when that feature is implemented.
- [ ] Complete secure push/pull and receipt verification before any deletion policy is considered.
