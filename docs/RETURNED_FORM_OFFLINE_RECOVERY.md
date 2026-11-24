# Offline field form correction and reconnect recovery

**Local review only.** Use a fictional scheme and test values, never official farmer records.

1. Open **Requirements Forms (Draft)**. Save a draft offline.
2. Queue the saved revision intentionally. Once it is queued the exact event and record revision are retained even after network failure.
3. When online, the PWA reattempts **already queued** operations on reconnect, app focus or returning to the foreground. It does not automatically create submissions from unsent drafts. Institutional mode requires an active sign-in.
4. Network, HTTP and unacknowledged responses leave queue state **pending** and retain a readable error. They are not falsely marked accepted or rejected.
5. After the server acknowledges a revision, **Refresh officer decisions** to see its genuine status, returned reason and scheme conflicts.
6. If the district officer returns a form, select **Correct returned form**, change the original saved draft and **Save offline draft**. The app creates a **new revision** while retaining the original receipt and reviewer return.
7. Queue and sync the correction. The Core API disallows corrections while a record is still under review or published; create an entirely new observation in that case.
8. Reporting data on the main app remains stage-only and limited to published, mapping-approved typed records. Nothing in this test creates production Ministry statistics.

### Why this is safe

The existing baseline survey IndexedDB, media blobs and prior immutable event payloads are preserved. Authenticated schemes and district permissions come from NIMIS Core, not the collector. Without the official identity provider, final approved catalogue, secure Android offline storage and authorized production environment, the app is **not approved for field deployment**.

Paired main branch: `feat/collector-correction-reconciliation-v1`, based on published form reporting branch. Collector branch: `feat/collector-correction-ux-v1`.
