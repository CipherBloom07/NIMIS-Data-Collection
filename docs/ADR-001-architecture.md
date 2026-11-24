# ADR-001 — NIMIS Collect architecture and assumptions

Date: 2026-11-23
Status: **Proposed for Department/ICT review — not production approved**

## Assumptions and open questions

| Item | Working assumption | Decision needed before production |
| --- | --- | --- |
| Platform | Android-first installable React/TypeScript PWA | Approval of browser-based offline security vs native Android wrapper |
| Repository | NIMIS-Data-Collection remains separate from the NIMIS web app | Confirm ownership and CI/branch approvals |
| Central authority | One server-assigned permanent scheme ID per scheme | Confirm master NIMIS registry's exact ID format and source |
| Backend | No verified live NIMIS write API is available yet | Confirm existing backend, API gateway, hosting, schemas and identity provider |
| Roles | Officer, scheme/IMC, DIDO, PIDO, technical, administrator | Confirm district/province account directory and delegation policies |
| Approvals | Capture → DIDO verify → PIDO review → technical approve → admin publish | Confirm which steps/roles can run offline |
| Geography | Current baseline form lists 8 provinces; authoritative reference catalogue is server-driven | Confirm inclusion rules for Harare/Bulawayo in scheme picklists |
| Photos | Photos stored locally in IndexedDB for prototype only | Government-approved encryption and retention policy |
| Sensitive data | No real farmer contact or operational datasets in public repo or development browser | Approve data classification, consent and legal retention |
| Availability | Offline after first successful install and download of reference assets | Define supported browsers, device enrolment and kiosk policies |

## Decision

Use **React + TypeScript + PWA + IndexedDB** for the present responsive field prototype because it can be developed and reviewed in VS Code with Node.js without Flutter and can run on Android browsers as an installable app. The approved production architecture remains **API-first**: a versioned HTTPS REST interface in front of PostgreSQL/PostGIS and an authenticated, role-scoped server. Offline capture is built around a transactional local store and an immutable operation outbox; authoritative edits never occur directly in browser storage.

**Security caveat:** A standard PWA cannot guarantee the brief's Android Keystore-backed encrypted database, biometric secure unlock or remotely enforced wipe while permanently offline across every browser. These are **blocking production acceptance criteria**. Options: a vetted native Android wrapper with hardware-backed keys or a fully native client. Do not claim PWA-only local IndexedDB is sufficiently encrypted for sensitive records.

## Ownership and integration

NIMIS web application remains the single authoritative registry and publisher. NIMIS Collect produces dated, attributed submissions and append-only decisions. An authenticated NIMIS sync service handles authorization, permanent scheme IDs, duplicate detection, conflicts, version history, review transitions and audit events. The web dashboard/GIS/analytics are **out of scope** for this repository.

## Current implementation versus required

| Capability | Current status | Acceptance gate |
| --- | --- | --- |
| Responsive baseline questionnaire | Prototype implemented, manual device checks pending | Responsive and accessibility test evidence |
| Offline local draft save | Implemented in IndexedDB | Crash-recovery and airplane-mode tests |
| GPS points, photos | Initial device APIs and IndexedDB photos | Verified on Android; accuracy, compression, metadata |
| Autosave each field change | Not yet implemented | Crash mid-form without loss |
| Server-driven form definitions | Not yet implemented | Versioned /forms download and old draft compatibility |
| Offline encrypted device lock | Not implemented | Cryptographic and revocation tests |
| Authentication/scope | Not implemented | JWT and server role/scope enforcement |
| Idempotent push/pull/attachments | Outbox foundation only | API contract tests + network interruption tests |
| Verification chain | Not implemented | Full returned/versioned audit workflow |
| Eleven recurring forms | Baseline only | Approved dictionary and workflows |
| PostgreSQL/PostGIS reference sync | Schema proposal only | Integration, RLS/auth, backup tests |

## Rules that cannot be relaxed

- Only the server assigns a permanent scheme ID; client assigns a temporary UUID for new scheme requests.
- Never publish questionnaire responses directly to national indicators. All proposed changes pass verification, review, technical approval and publication.
- Equipped, developed, functional and actually irrigated area are **four separate measurements**.
- Periodic and crop records are append-only and keyed to scheme, form, period and season.
- Unit, measurement date, source and provenance are explicit.
- Records carry form ID, version, capture timestamp, server receipt timestamp, user ID, device ID and master-base version.
- Audit every change in append-only events. Errors and conflicting writes must be actionable, not silently dropped.
