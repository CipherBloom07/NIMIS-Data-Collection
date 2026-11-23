# NIMIS Collect — implementation status (23 November 2026)

Source: *NIMIS Data Collection App — Development Prompt*, delivered on 23 November 2026. This is a review snapshot, not Ministry release approval.

## Working assumptions and decisions

| Item | Current approach | Confirmation still needed |
| --- | --- | --- |
| Main registry | A single server-side master scheme record and permanent scheme ID | Confirm authoritative NIMIS API, ID format and hosting |
| Mobile client | React/TypeScript installable PWA for low-cost Android phones and tablets | Government security approval for PWA versus Capacitor/native wrapper and Keystore-backed encryption |
| Offline | IndexedDB is the source of local survey drafts and photo blobs | Encryption, quota protection, device management and offline grace rules |
| Roles | Scheme officer, DIDO, PIDO, national technical and NIMIS administrator | Server-issued geographic assignments, identity provider and review permissions |
| Existing questionnaire | Baseline fields mapped from supplied mWater survey | Department sign-off of exact labels, repeating groups and validations |
| Remaining forms | Forms 2–11 proposed in `docs/DATA_DICTIONARY.md` | Department field-level approval before implementation |

## Delivered in the repository

- Eight baseline questionnaire sections and 70 field definitions.
- Offline local IndexedDB drafts, attachment blobs, draft list and a revisioned local outbox.
- Auto-saves queued in order after changed fields; no network needed.
- Conditional visibility for storage, rehabilitation, water-saving, waterlogging and weather-station questions.
- Local validation of number ranges, commissioning year, selections, approximate Zimbabwe GPS bounds and related area warnings.
- GPS capture (subject to platform permission and secure origin) and photograph selection.
- Supplied Zimbabwe national coat of arms referenced through an embedded, offline-capable asset, visible in mobile and desktop layouts; responsive rules for phone, tablet and large monitors.
- Proposed OpenAPI spec, data dictionary, PostgreSQL/PostGIS reference schema and architecture decision record.
- Automated regression tests and TypeScript build workflow.

## Not completed — must be built before production

1. **Individual authentication, device enrolment and revocation**, offline PIN/biometric, secure credentials and 30-day grace policy.
2. **Encryption at rest** backed by Android Keystore or a Department-approved equivalent. Standard browser IndexedDB currently is *not* treated as encrypted operational storage.
3. **Server-driven form definitions, reference data and assignments**, controlled province/district/ward picklists.
4. **Reliable full bidirectional synchronization** with immutable operations, retries, cursor-based pull, file checksums, resumable uploads, conflicts and acknowledgment.
5. **Real approval workflow** for scheme managers, DIDO and PIDO, followed by national technical approval and publish on main NIMIS.
6. **Forms 2–11**, pending field-level Department approval; season-specific records must be append-only.
7. **Boundary walking**, GPS accuracy averaging, user-friendly duplicate checks, production-grade validation and safety checks.
8. **Private backup/restore, full-media export, diagnostics, localization, accessibility/performance proof, low-end Android device testing and all 15 acceptance scenarios.**

## Security and data handling

No live Supabase/NIMIS backend is connected in this branch. Do not enter real farmer, officer contact, or sensitive Ministry data during development. Device browser storage can be evicted, the JSON draft export does not include photograph binaries, and client-side validation is not authoritative.

## Validation

GitHub Actions run **45140758640** completed successfully on commit `ea7417bc2406b80f8f7c3decbe2a6e6678b8a669` for the responsive/branding/validation feature branch. This proves the configured source tests and TypeScript build passed. It does **not** prove Android hardware support, the 15 acceptance scenarios or production security.

## Reviewer commands

```powershell
cd "C:\Users\2025\Desktop\DCA NIMIS"
git fetch origin
git switch feat/collect-v1-brand-responsive
git pull --ff-only origin feat/collect-v1-brand-responsive
npm install
npm test
npm run build
npm run dev
```

Open the Vite address displayed in the terminal. For a previously installed PWA, close all tabs, reload and allow the updated service worker to activate. Testing GPS and camera on physical Android phones requires HTTPS or a secure context.
