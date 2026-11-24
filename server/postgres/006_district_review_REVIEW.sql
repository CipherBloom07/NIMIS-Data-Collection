-- STAGING-ONLY district verification state and append-only history.
-- Depends on 005_secure_sync_foundation_REVIEW.sql and approved actor scope view.
-- Never alters the national scheme master.
BEGIN;
CREATE TABLE IF NOT EXISTS nimis_sync.review_state (
  event_id uuid PRIMARY KEY REFERENCES nimis_sync.operation(event_id),
  status text NOT NULL DEFAULT 'SUBMITTED'
    CHECK (status IN ('SUBMITTED','VERIFIED','RETURNED')),
  version bigint NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO nimis_sync.review_state(event_id,status)
SELECT event_id,'SUBMITTED' FROM nimis_sync.operation
ON CONFLICT (event_id) DO NOTHING;
CREATE INDEX IF NOT EXISTS review_state_status_updated
 ON nimis_sync.review_state(status,updated_at DESC);
CREATE TABLE IF NOT EXISTS nimis_sync.review_decision (
  decision_id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES nimis_sync.operation(event_id),
  actor_user_id uuid NOT NULL,
  actor_role text NOT NULL CHECK (actor_role='district_officer'),
  action text NOT NULL CHECK (action IN ('VERIFY','RETURN')),
  reason text,
  from_status text NOT NULL CHECK (from_status='SUBMITTED'),
  to_status text NOT NULL CHECK (to_status IN ('VERIFIED','RETURNED')),
  decided_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (action <> 'RETURN' OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE INDEX IF NOT EXISTS review_decision_event_time
  ON nimis_sync.review_decision(event_id,decided_at DESC);
REVOKE ALL ON nimis_sync.review_state FROM PUBLIC;
REVOKE ALL ON nimis_sync.review_decision FROM PUBLIC;
-- ICT grants for a dedicated runtime role, after review:
-- SELECT on review_state/review_decision; INSERT on review_decision;
-- INSERT and UPDATE(status,version,updated_at) on review_state;
-- never UPDATE or DELETE review_decision or operation.
COMMIT;
