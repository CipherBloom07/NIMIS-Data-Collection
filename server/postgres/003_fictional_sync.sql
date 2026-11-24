-- Fictional-only integration demonstration. Run only in nimis_collect_dev.
-- This does not alter the main NIMIS master tables.
-- Upgrade the fictional role check for existing local PostgreSQL clusters.
ALTER TABLE nimis_collect_demo.officer DROP CONSTRAINT IF EXISTS officer_role_code_check;
ALTER TABLE nimis_collect_demo.officer ADD CONSTRAINT officer_role_code_check
 CHECK (role_code IN ('field_officer','scheme_manager','dido','pido','district_officer','provincial_officer','admin'));
INSERT INTO nimis_collect_demo.officer(officer_id,role_code)
VALUES ('10000000-0000-4000-8000-000000000002','district_officer')
ON CONFLICT (officer_id) DO UPDATE SET role_code='district_officer';
INSERT INTO nimis_collect_demo.assignment(officer_id,scheme_id,role_code)
VALUES ('10000000-0000-4000-8000-000000000002','DEMO-SCHEME-001','dido')
ON CONFLICT (officer_id,scheme_id,role_code) DO NOTHING;
INSERT INTO nimis_collect_demo.officer(officer_id,role_code)
VALUES ('10000000-0000-4000-8000-000000000003','provincial_officer'),
       ('10000000-0000-4000-8000-000000000004','admin')
ON CONFLICT (officer_id) DO UPDATE SET role_code=EXCLUDED.role_code;
INSERT INTO nimis_collect_demo.assignment(officer_id,scheme_id,role_code)
VALUES ('10000000-0000-4000-8000-000000000003','DEMO-SCHEME-001','pido')
ON CONFLICT (officer_id,scheme_id,role_code) DO NOTHING;
CREATE TABLE IF NOT EXISTS nimis_collect_demo.field_submission (
  event_id uuid PRIMARY KEY,
  scheme_id text NOT NULL REFERENCES nimis_collect_demo.scheme(scheme_id),
  collector_user_id uuid NOT NULL REFERENCES nimis_collect_demo.officer(officer_id),
  district_code text NOT NULL,
  province_code text NOT NULL,
  form_id text NOT NULL DEFAULT 'scheme_baseline',
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','VERIFIED','REVIEWED','PUBLISHED','RETURNED')),
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

-- Update the status check in already-created local demonstration databases.
ALTER TABLE nimis_collect_demo.field_submission DROP CONSTRAINT IF EXISTS field_submission_status_check;
ALTER TABLE nimis_collect_demo.field_submission ADD CONSTRAINT field_submission_status_check
 CHECK (status IN ('SUBMITTED','VERIFIED','REVIEWED','PUBLISHED','RETURNED'));

-- Immutable local demonstration decision history. This is not an official audit service.
CREATE TABLE IF NOT EXISTS nimis_collect_demo.demo_decision (
  decision_id uuid PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES nimis_collect_demo.field_submission(event_id),
  actor_user_id uuid NOT NULL REFERENCES nimis_collect_demo.officer(officer_id),
  actor_role text NOT NULL CHECK (actor_role IN ('district_officer','provincial_officer','admin')),
  action text NOT NULL CHECK (action IN ('VERIFY','RETURN','REVIEW','PUBLISH')),
  reason text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action <> 'RETURN' OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE INDEX IF NOT EXISTS demo_decision_event_date_idx
 ON nimis_collect_demo.demo_decision(event_id,decided_at DESC);
REVOKE ALL ON nimis_collect_demo.demo_decision FROM PUBLIC;
