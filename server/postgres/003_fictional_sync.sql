-- Fictional-only integration demonstration. Run only in nimis_collect_dev.
-- This does not alter the main NIMIS master tables.
CREATE TABLE IF NOT EXISTS nimis_collect_demo.field_submission (
  event_id uuid PRIMARY KEY,
  scheme_id text NOT NULL REFERENCES nimis_collect_demo.scheme(scheme_id),
  collector_user_id uuid NOT NULL REFERENCES nimis_collect_demo.officer(officer_id),
  district_code text NOT NULL,
  province_code text NOT NULL,
  form_id text NOT NULL DEFAULT 'scheme_baseline',
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','VERIFIED','RETURNED')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text,
  CHECK (octet_length(payload::text) <= 16384)
);
CREATE INDEX IF NOT EXISTS field_submission_district_status_idx
 ON nimis_collect_demo.field_submission(district_code, status, submitted_at DESC);
REVOKE ALL ON nimis_collect_demo.field_submission FROM PUBLIC;
-- API runtime uses the following dedicated, narrowly scoped demo account
-- with INSERT and SELECT, but no DELETE, DDL or direct UPDATE rights.
