# NIMIS Collect — Acceptance and implementation matrix

Source: User's 2026-11-23 NIMIS Collect development brief, Section 10.

**Current release stage: Phase 1 foundation + existing responsive field-capture prototype. Not production complete.**

| # | Acceptance scenario | Current implementation | Status |
| --- | --- | --- | --- |
| 1 | Enrol, airplane mode, full baseline, 10 photos, walked boundary, force kill | Drafts/photos only; no enrolment, boundary, reliable autosave/kill recovery | NOT TESTED / INCOMPLETE |
| 2 | Cut photo upload, retry 5 times, no duplicates | No upload server or resumable transfer | NOT IMPLEMENTED |
| 3 | Two officers submit same monthly report | Server unique key/correction versions only specified | NOT IMPLEMENTED |
| 4 | Offline edit conflicts with server master version | API conflict response specified, UI missing | NOT IMPLEMENTED |
| 5 | DIDO offline return, reason and linked resubmission | Database decision/audit design only | NOT IMPLEMENTED |
| 6 | Revocation and optional wipe on next contact | Device schema only | NOT IMPLEMENTED |
| 7 | Offline grace expires; preserve drafts | Policy described in ADR only | NOT IMPLEMENTED |
| 8 | Form update while old draft exists | Form version described only | NOT IMPLEMENTED |
| 9 | Client rejects invalid areas, tampered API payload rejected | Server validation design only | NOT IMPLEMENTED |
| 10 | New scheme request, offline/online duplicate check | Request schema only | NOT IMPLEMENTED |
| 11 | Wrong device clock flagged; server time ordering | Envelope/server-time design only | NOT IMPLEMENTED |
| 12 | Low storage and battery warnings, no loss | IndexedDB baseline only | NOT IMPLEMENTED |
| 13 | Local database unreadable without key; revoked token denied | PWA IndexedDB unencrypted; requires native security decision | NOT IMPLEMENTED |
| 14 | Export/restore all data, checksums match | Draft JSON export only; photo bytes missing | NOT IMPLEMENTED |
| 15 | 1,000 scheme records on 2 GB Android phone meet target | No performance/device testing | NOT TESTED |

## Foundation CI checks

The automated tests in `tests/foundation.test.mjs` verify that the native emblem file is present, responsive breakpoints and touch sizes exist, the baseline schema declares 70 unique-section fields, the draft OpenAPI has expected routes, and the service worker avoids API caching. These **are not** equivalent to the 15 acceptance scenarios.

## Release policy

- Review and approve forms 2–11 dictionary and backend authority first.
- Do not merge into production `main` until build, security tests and user acceptance tests pass.
- No real Ministry sensitive data on a browser prototype with unencrypted IndexedDB.
- For any browser field test, verify actual offline reload, geolocation permissions and file capture on Android HTTPS origin.
- Document reproducible evidence and failures for each scenario; never mark unexecuted tests as passed.
