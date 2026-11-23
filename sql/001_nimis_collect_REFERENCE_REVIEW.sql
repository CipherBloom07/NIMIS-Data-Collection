-- NIMIS Collect reference schema — REVIEW ONLY, not deployed.
-- PostgreSQL 16 + PostGIS. Integrate only after verifying the main NIMIS authoritative scheme registry.
-- Do NOT create a second authoritative master registry in this schema.
BEGIN;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE SCHEMA IF NOT EXISTS nimis_collect;
REVOKE ALL ON SCHEMA nimis_collect FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS nimis_collect.scheme_reference (
  scheme_id TEXT PRIMARY KEY, -- assigned by existing authoritative NIMIS service
  master_version BIGINT NOT NULL CHECK (master_version > 0),
  name TEXT NOT NULL,
  province_code TEXT NOT NULL,
  district_code TEXT NOT NULL,
  ward_code TEXT,
  gate_location GEOGRAPHY(POINT, 4326),
  boundary GEOMETRY(POLYGON, 4326),
  updated_at TIMESTAMPTZ NOT NULL,
  withdrawn_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS scheme_ref_district_idx ON nimis_collect.scheme_reference(district_code);

CREATE TABLE IF NOT EXISTS nimis_collect.device (
  device_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  public_key TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_successful_sync_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  wipe_required BOOLEAN NOT NULL DEFAULT FALSE,
  last_clock_offset_ms BIGINT
);
CREATE TABLE IF NOT EXISTS nimis_collect.assignment (
  assignment_id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  scheme_id TEXT NOT NULL REFERENCES nimis_collect.scheme_reference(scheme_id),
  role TEXT NOT NULL CHECK(role IN ('scheme_manager','imc_member','field_officer','dido','pido','national_technical','administrator')),
  valid_from TIMESTAMPTZ NOT NULL,
  valid_until TIMESTAMPTZ,
  UNIQUE(user_id,scheme_id,role,valid_from)
);
CREATE INDEX IF NOT EXISTS assignment_user_idx ON nimis_collect.assignment(user_id);

CREATE TABLE IF NOT EXISTS nimis_collect.form_definition (
  form_id TEXT NOT NULL,
  form_version INTEGER NOT NULL CHECK (form_version > 0),
  definition JSONB NOT NULL,
  accepted_until TIMESTAMPTZ,
  released_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY(form_id, form_version)
);
CREATE TABLE IF NOT EXISTS nimis_collect.submission (
  submission_id UUID PRIMARY KEY,
  client_record_id UUID NOT NULL,
  device_id UUID NOT NULL REFERENCES nimis_collect.device(device_id),
  submitted_by UUID NOT NULL,
  scheme_id TEXT REFERENCES nimis_collect.scheme_reference(scheme_id),
  temporary_scheme_id UUID,
  form_id TEXT NOT NULL,
  form_version INTEGER NOT NULL,
  reporting_period TEXT,
  season_id TEXT,
  version_number INTEGER NOT NULL CHECK(version_number > 0),
  previous_submission_id UUID REFERENCES nimis_collect.submission(submission_id),
  base_master_version BIGINT,
  payload JSONB NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  clock_offset_ms BIGINT NOT NULL DEFAULT 0,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provenance JSONB NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('submitted','returned','verified','reviewed','approved','published','conflict')),
  CONSTRAINT submission_form_fk FOREIGN KEY(form_id,form_version)
    REFERENCES nimis_collect.form_definition(form_id,form_version),
  CONSTRAINT submission_scheme_reference CHECK (scheme_id IS NOT NULL OR temporary_scheme_id IS NOT NULL),
  UNIQUE(client_record_id, version_number)
);
CREATE INDEX IF NOT EXISTS submission_scheme_time_idx ON nimis_collect.submission(scheme_id, received_at DESC);
CREATE INDEX IF NOT EXISTS submission_unique_report_key_idx
  ON nimis_collect.submission(scheme_id,form_id,coalesce(reporting_period,''),coalesce(season_id,''),version_number);

CREATE TABLE IF NOT EXISTS nimis_collect.sync_operation (
  operation_id UUID PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES nimis_collect.device(device_id),
  record_id UUID NOT NULL,
  local_sequence BIGINT NOT NULL CHECK(local_sequence > 0),
  operation_type TEXT NOT NULL CHECK(operation_type IN ('save','submit','verify','review','return')),
  request_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  outcome TEXT NOT NULL CHECK(outcome IN ('accepted','accepted_with_warnings','rejected','duplicate','conflict')),
  result JSONB NOT NULL,
  UNIQUE(device_id, local_sequence)
);

CREATE TABLE IF NOT EXISTS nimis_collect.attachment (
  attachment_id UUID PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES nimis_collect.submission(submission_id),
  question_key TEXT NOT NULL,
  object_key TEXT,
  mime_type TEXT NOT NULL,
  file_bytes BIGINT NOT NULL CHECK(file_bytes >= 0),
  sha256 CHAR(64) NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  captured_gps GEOGRAPHY(POINT,4326),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(submission_id, question_key, sha256)
);
CREATE TABLE IF NOT EXISTS nimis_collect.review_decision (
  decision_id UUID PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES nimis_collect.submission(submission_id),
  actor_id UUID NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL CHECK(action IN ('verify','review','return','approve','publish')),
  reason TEXT,
  flagged_fields TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reason_required_on_return CHECK(action <> 'return' OR nullif(trim(reason),'') IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS nimis_collect.audit_event (
  audit_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id TEXT NOT NULL,
  actor_id UUID,
  device_id UUID,
  action TEXT NOT NULL,
  before_version INTEGER,
  after_version INTEGER,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_details JSONB NOT NULL DEFAULT '{}'
);

-- Default-deny all direct client table access; backend verifies user role, scheme assignment
-- and device state before calling trusted server-side queries. Never grant writes to anon.
ALTER TABLE nimis_collect.scheme_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.device ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.form_definition ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.submission ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.sync_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.attachment ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.review_decision ENABLE ROW LEVEL SECURITY;
ALTER TABLE nimis_collect.audit_event ENABLE ROW LEVEL SECURITY;
COMMIT;

-- Engineering notes:
-- - No direct client grants or RLS policies are included; this is intentionally inaccessible.
-- - append-only and state transition enforcement require reviewed SECURITY DEFINER functions
--   or server-side transactions, plus database triggers and integration tests.
-- - Farmer/Plot, asset, water resource, seasonal, project and telemetry records belong in
--   separately designed linked tables only after institutional data model review.
-- - Never run this reference schema against the live Ministry Supabase project unreviewed.
