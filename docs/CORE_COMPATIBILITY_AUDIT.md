# NIMIS Core ↔ NIMIS Collect integration compatibility audit

**24 November 2026. Review only — not a production deployment.**

## Repositories and active review branches

- Main NIMIS core: `CipherBloom07/NIMIS`, branch `feat/nimis-core-transactional-backend`, isolated `nimis_core_dev` PostgreSQL database.
- Collector: `CipherBloom07/NIMIS-Data-Collection`, branch `feat/district-verification-v1`, secure staging `nimis_sync` tables plus fictional `nimis_collect_dev` test DB.
- Both prove useful *different* development properties. They are **NOT a single integrated master database**. Never merge the tables or copy records by hand.

## Confirmed blockers before cross-repository activation

| Concern | NIMIS core stage | Collector secure stage | Required convergence |
| --- | --- | --- | --- |
| Canonical scheme ID | UUID `scheme_id`; separately stored human-readable `scheme_code` | `scheme_id` TEXT | Adopt the **core UUID** as the canonical foreign key. Preserve human-readable codes as labels. Do not cast unchecked text or generate shadow scheme IDs. |
| Submission payload | Typed `operational_status` v1, `measurements[]`, `period_code`, base scheme revision | Generic `data` object, `form_id`, `form_version`, no period/base revision | Create an explicit server-side validated adapter or one unified contract. Require units, source, observed time, reporting period and base revision. |
| Identity | Loopback dev-only `X-Nimis-Dev-Actor` synthetic header | Signed RS256 OIDC JWT + approved device/scope view, not configured | Replace test identity with approved institutional OIDC and audited geography assignments in **one** backend. No token-to-dev-header bridge in production. |
| Persistence | Isolated `nimis_stage` and `nimis_core_dev` | Proposed `nimis_sync`; test `nimis_collect_dev` | Select one reviewed PostgreSQL/PostGIS authoritative registry with linked submissions, decision state and audit history. No cross-database shadow masters. |
| Workflow | District verify, provincial review, technical approval, admin publication | Collector push and district verify/return only | Keep one server-owned transaction state machine; define delegated national technical permission under four external roles. |
| Offline and media | No real Android sync | Offline PWA drafts and photos not connected to secure API | Encrypt native local store, durable outbox and acknowledged push/pull, checksum/resumable photos, error/conflict UI, device revocation. |
| BI and GIS | Local published-only area example | No BI | Point dashboards exclusively at verified, period-specific, geographically scoped reporting views. |

## Integration acceptance contract (must be approved and tested)

1. Central NIMIS issues one permanent UUID per scheme. Collector downloads only assigned schemes with UUID + scheme code + master revision + geography.
2. Collector stores immutable local operations with per-device monotonic sequence, event UUID and base revision. Retries preserve the original ID and payload.
3. Authenticated sync validates enrollment, role/scheme assignment, approved form version, period, units, measurement sources, captured/observed time and base revision before inserting a submission.
4. A single transaction atomically inserts submission, review state and audit evidence without changing the scheme master.
5. District VERIFY/RETURN, province REVIEW/RETURN, delegated technical approve and admin PUBLISH are distinct audited permissions. Reviewer cannot approve own submission; concurrent stale decisions produce conflict.
6. Corrections create linked revisions; seasons and periods never overwrite history. A changed master revision enters a resolvable conflict queue.
7. Only published, source-valid records reach analytics. Raw draft/returned/unapproved values never inflate national totals.
8. Data collector app retains unsynced records and photos after errors, crashes, lost network and revocation; successful server acknowledgements are durable and replay-safe.

## Immediate engineering sequence

1. **Architecture reconciliation:** Department ICT chooses the authoritative scheme master, OIDC provider, credential store, four-role policy and staging DB. Agree on UUID canonical scheme ID and approved `operational_status` form dictionary.
2. Design shared `/api/v1/sync/push`, `/sync/pull` and decision contracts from the core data model with an explicit versioned schema; run schema/API contract tests in both repositories.
3. Migrate the Collector stage to the **shared reviewed** schema and adapter, never allow it to create scheme masters or submit directly to local browser registry.
4. Add signed device enrolment, field authorization and reversible dry-run migration in a nonproduction database.
5. Run two-client offline retry, conflict, role leakage, concurrent review and reporting cross-check tests before promotion.

This document is a blocking compatibility assessment, **not approval** to deploy, merge, migrate or expose real Ministry data.
