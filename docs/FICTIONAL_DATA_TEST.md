# NIMIS Collect — Fictional Data Testing (Phase 2)

**Test scope:** Sample validation + browser-local persistence + read-only reference API. This is NOT a live Ministry acceptance test.

## Before the test
- Start the backend in terminal 1: `& ".\scripts\START_PHASE2_REFERENCE.ps1"`
- Start the frontend in terminal 2: `npm run dev`
- Only fictional records and a development token are used; no government records or real farmer data.

## Automated backend data test (terminal 3)
```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
& ".\scripts\TEST_NIMIS_DATA.ps1"
```
Expected checks: Python unit tests pass, API health is OK, fictional token issued, role is `field_officer`, district is `DEMO-DISTRICT`, 1 assigned synthetic scheme, 11 proposed forms, uncredentialed scheme request returns 401, sync write returns 501 (disabled).

## Frontend/offline sandbox data test
1. Open `http://127.0.0.1:5173/` on the PC running Vite.
2. Select **Test fictional data** in the left navigation (development mode only).
3. Choose **Run sample data test**.
4. Confirm all 3 validation scenarios PASS, and that 3 synthetic records are stored.
5. Refresh the browser. Choose **Verify saved data** — the isolated test records should still exist.
6. Turn off Wi-Fi **after the application has loaded**, then choose **Verify saved data** again. This checks IndexedDB readback without network requests, but does not itself prove the full app service-worker/offline-launch acceptance test.
7. Choose **Clear test data** to remove only sandbox records.

Fixture results expected from the current validator:
- Valid fictional baseline: **0 errors, 0 warnings**.
- Negative areas + outside-Zimbabwe GPS: **3 errors, 1 warning**.
- Functional area above equipped area: **0 errors, 1 warning**.

### Data isolation
`src/demo-data-test.ts` uses **nimis_fictional_data_test_v1**, a dedicated IndexedDB database, completely separate from `nimis_field_pwa_v1` used for field drafts and outbox. Mock images are strings only, not real photo evidence. No test fixture is queued for synchronization or sent to a server.

## What this does not prove
- Authentic officer identity, secure device enrolment, offline biometric unlock
- Full validated baseline or 10 additional functional form builders
- Real photographs, boundary walks or encrypted at-rest storage
- Real NIMIS push/pull, server writes, deduplication or attachment retry
- DIDO/PIDO approval or national publication
- Production performance and all 15 user-acceptance test scenarios

The backend and frontend source builds are tested by GitHub Actions. The Windows PowerShell script and offline browser readback still need to be executed on the user's PC before claiming those scenarios passed.
