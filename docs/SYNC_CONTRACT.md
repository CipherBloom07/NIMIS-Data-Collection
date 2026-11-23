# NIMIS field synchronization contract — review draft

## Current behavior
- All survey drafts are saved in local SQLite.
- Every save creates or replaces a revisioned outbox item with a stable event ID.
- A future server acknowledgement will remove only its matching event, not newer revisions.
- **No backend or Supabase communication has been enabled.**
- Drafts are not approvals, official scheme updates, or verified statistics.

## Next implementation contract
1. Log in using approved officer accounts (Supabase Auth).
2. Download authorized scheme assignments and questionnaire version.
3. Send queued events via authenticated HTTPS sync with unique event_id, survey_id, base_server_revision, versioned answers and timestamps.
4. Server checks record ownership, roles, validation, expected revision and idempotency.
5. Return per-event accepted/conflict/rejected outcomes and current server revision.
6. Never clear an outbox event before a matching acknowledgement.
7. Changes go to review queue; official scheme records and published KPIs update only after authorization.
8. Download change feed by checkpoint, including assignments, requests for correction and approved updates.
9. Photos require durable offline files, private object storage and separate upload acknowledgements.

The existing 2,758 water-source GPS observations are **unverified survey data**, not 2,758 approved irrigation schemes.
Do not upload field GPS data, farmer details or passwords to this public repository.
