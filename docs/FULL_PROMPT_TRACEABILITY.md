# NIMIS Collect — authoritative project brief and implementation trace

**Source of requirements:** `NIMIS_Data_Collection_App_Development_Prompt(1).pdf`, provided 23 November 2026, 22 pages.

This PDF is the **project requirement specification** for implementation decisions. Changes to requirements must be tracked and reviewed with the Department. The short mWater questionnaire remains the field-level source for the baseline, subject to the adjustments described in the full brief.

## Non-negotiable principles
1. One scheme, one server-issued authoritative master record; related observations never create shadow masters.
2. Full offline capture and re-opening drafts after app/device restart; no silent loss of unsynced operations.
3. Individual identity and server-enforced roles/geographic scopes.
4. Submission revisions, GPS, photos, timestamps, source, units and audit events retained.
5. Capture → DIDO verify → PIDO review → national technical approval → administrator publication.
6. Server is authoritative for validation, conflict resolution, duplicate detection and publication.
7. Official Ministry data cannot enter unencrypted browser-local storage during development.

## Requirements map

| PDF page(s) | Topic | Repository baseline | Remaining work |
|---|---|---|---|
| 1–3 | Objective, governance, user roles | `docs/ADR-001.md`, `docs/DATA_DICTIONARY.md` | Identity provider and institutional role approval |
| 3–6 | Offline lifecycle, outbox, idempotency, conflicts | `src/storage.ts` revisioned local operations | Encrypted store, server cursor/ACK, dead letter handling, device revocation |
| 6–14 | Forms 1–11 and full baseline | `src/survey.ts`, `schemas/form-catalogue.v1.json`, `src/form-registry.ts` | Complete versioned baseline, 10 dictionaries approval, repeating groups and boundary GPS |
| 14–16 | Review, provenance, validations | `src/validation.ts`, `api/openapi.yaml` | Review queue, state machine, full conditional rules and server enforcement |
| 16–17 | Government security and ownership | ADR and restricted reference SQL | Native Keystore-compatible encryption, identity, RBAC, privacy audit and backups |
| 17–19 | API, entities and measures | `api/openapi.yaml`, `sql/001_nimis_collect_REFERENCE_REVIEW.sql` | Deploy reference implementation only after main-NIMIS schema alignment |
| 19–20 | Device UX, accessibility and deliverables | `src/responsive.css`, `src/official-theme.css` | 2GB device benchmarks, app guidance, translation and support tools |
| 21–22 | Build order and 15 acceptance tests | `docs/ACCEPTANCE_MATRIX.md`, GitHub CI | All 15 device/server acceptance tests remain to be demonstrated |

## Stage checkpoints

**Phase 1 — Foundations:** draft design documents available. Pending formal validation of the full baseline data model and approval of recurring forms 2–11.

**Phase 2 — Access and reference:** versioned local form/reference cache has been added for a future secured sync. Server auth, device enrolment and role/scope enforcement are not yet connected.

**Phase 3 — Capture:** offline PWA survey and photos are prototypes. User-facing local autosave and validation exist, but Android Keystore encryption, GPS boundary walking and complete dynamic form engine remain outstanding.

**Phase 4 — Sync:** immutable local operations exist. There is **no live sync server, server acknowledgment processing, secure upload or publication**.

**Phases 5–7:** work scheduled after preceding gates, not complete.

## Key platform decision pending
The project presently uses a React/TypeScript PWA because it avoids Flutter's local toolchain issue. However, the full brief requires Android Keystore-backed encryption and secure offline device unlock, and also expects dependable background synchronization. These guarantees require a native secure layer (e.g. reviewed Android wrapper) or migration to a suitable native stack. **Do not claim the pure PWA satisfies those requirements.**

## Required testing evidence
Tests must include timestamps, device specifications, operation counts, network drop/retry logs, and verification outcomes. GitHub CI proves code builds and selected unit checks; it does not prove the PDF's 15 acceptance tests.
