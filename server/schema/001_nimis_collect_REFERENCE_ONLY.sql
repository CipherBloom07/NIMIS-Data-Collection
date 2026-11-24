-- NIMIS Collect reference relational model v0.1.
-- REVIEW ONLY: do not execute against production NIMIS without authorized
-- review of existing master schema, user roles, migrations and backups.
-- Requires PostgreSQL + PostGIS + pgcrypto. Not a deployed sync server.
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS nimis_collect;

CREATE TABLE IF NOT EXISTS nimis_collect.scheme_link (
  scheme_id text PRIMARY KEY, -- authoritative ID from main NIMIS
  name text NOT NULL,
  district_code text NOT NULL,
  province_code text NOT NULL,
  gate geography(Point,4326),
  boundary geometry(MultiPolygon,4326),
  master_version bigint NOT NULL DEFAULT 1 CHECK (master_version > 0),
  last_updated_at timestamptz NOT NULL,
  source_system text NOT NULL DEFAULT 'NIMIS'
);

CREATE TABLE IF NOT EXISTS nimis_collect.device (
  device_id uuid PRIMARY KEY,
  owner_user_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz,
  revoked_at timestamptz,
  wipe_requested_at timestamptz,
  public_key text NOT NULL
);

CREATE TABLE IF NOT EXISTS nimis_collect.user_assignment (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  device_id uuid REFERENCES nimis_collect.device(device_id),
  role_code text NOT NULL CHECK(role_code IN ('SCHEME_MANAGER','FIELD_OFFICER','DIDO','PIDO','NATIONAL_TECHNICAL','NIMIS_ADMIN')),
  province_code text,
  district_code text,
  scheme_id text REFERENCES nimis_collect.scheme_link(scheme_id),
  valid_from timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS nimis_collect.form_definition (
  form_id text NOT NULL,
  form_version integer NOT NULL CHECK (form_version > 0),
  schema_json jsonb NOT NULL,
  activated_at timestamptz NOT NULL,
  compatible_until timestamptz,
  PRIMARY KEY(form_id, form_version)
);

CREATE TABLE IF NOT EXISTS nimis_collect.submission (
  submission_id uuid PRIMARY KEY,
  parent_submission_id uuid REFERENCES nimis_collect.submission(submission_id),
  scheme_id text REFERENCES nimis_collect.scheme_link(scheme_id),
  temp_scheme_id uuid,
  form_id text NOT NULL,
  form_version integer NOT NULL,
  reporting_period text,
  season_code text,
  submitted_by uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES nimis_collect.device(device_id),
  captured_at timestamptz NOT NULL,
  clock_offset_seconds double precision NOT NULL DEFAULT 0,
  received_at timestamptz NOT NULL DEFAULT now(),
  base_scheme_version bigint,
  data_json jsonb NOT NULL,
  provenance_json jsonb NOT NULL,
  status text NOT NULL CHECK(status IN ('SUBMITTED','RETURNED','VERIFIED','REVIEWED','APPROVED','PUBLISHED','CONFLICT')),
  revision integer NOT NULL CHECK(revision > 0),
  CHECK (scheme_id IS NOT NULL OR temp_scheme_id IS NOT NULL),
  FOREIGN KEY(form_id, form_version)
    REFERENCES nimis_collect.form_definition(form_id, form_version),
  UNIQUE (submission_id, revision)
);
CREATE INDEX IF NOT EXISTS collect_submission_scheme_idx ON nimis_collect.submission(scheme_id,form_id,reporting_period,season_code);
CREATE INDEX IF NOT EXISTS collect_submission_received_idx ON nimis_collect.submission(received_at,submission_id);

CREATE TABLE IF NOT EXISTS nimis_collect.sync_operation (
  event_id uuid PRIMARY KEY, -- client event idempotency key
  device_id uuid NOT NULL REFERENCES nimis_collect.device(device_id),
  user_id uuid NOT NULL,
  client_record_id uuid NOT NULL,
  local_sequence bigint NOT NULL CHECK(local_sequence > 0),
  action_code text NOT NULL CHECK(action_code IN ('SAVE','SUBMIT','VERIFY','REVIEW','RETURN')),
  payload_sha256 text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  result_code text NOT NULL CHECK(result_code IN ('ACCEPTED','ACCEPTED_WARNINGS','REJECTED','DUPLICATE','CONFLICT')),
  result_json jsonb NOT NULL DEFAULT '{}',
  UNIQUE(device_id,local_sequence)
);

CREATE TABLE IF NOT EXISTS nimis_collect.attachment (
  attachment_id uuid PRIMARY KEY,
  submission_id uuid REFERENCES nimis_collect.submission(submission_id),
  question_key text NOT NULL,
  private_object_key text NOT NULL UNIQUE,
  sha256 text NOT NULL,
  bytes bigint NOT NULL CHECK(bytes >= 0),
  captured_at timestamptz,
  captured_location geography(Point,4326),
  verified_at timestamptz,
  uploaded_by uuid NOT NULL
);

CREATE TABLE IF NOT EXISTS nimis_collect.decision (
  decision_id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES nimis_collect.submission(submission_id),
  actor_user_id uuid NOT NULL,
  device_id uuid NOT NULL REFERENCES nimis_collect.device(device_id),
  action text NOT NULL CHECK(action IN ('VERIFY','REVIEW','RETURN','APPROVE','PUBLISH')),
  reason text,
  field_flags jsonb NOT NULL DEFAULT '[]',
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  CHECK (action <> 'RETURN' OR length(btrim(coalesce(reason,''))) > 0)
);

CREATE TABLE IF NOT EXISTS nimis_collect.audit_event (
  audit_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  action text NOT NULL,
  actor_user_id uuid,
  device_id uuid,
  occurred_at timestamptz,
  received_at timestamptz NOT NULL DEFAULT now(),
  before_hash text,
  after_hash text,
  details jsonb NOT NULL DEFAULT '{}'
);

-- A separate record per season/crop observation; never overwrite earlier seasons.
CREATE TABLE IF NOT EXISTS nimis_collect.seasonal_crop (
  crop_observation_id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES nimis_collect.submission(submission_id),
  scheme_id text NOT NULL REFERENCES nimis_collect.scheme_link(scheme_id),
  season_code text NOT NULL,
  crop_code text NOT NULL,
  period_code text NOT NULL,
  planted_ha numeric(12,3) CHECK(planted_ha >= 0),
  harvested_ha numeric(12,3) CHECK(harvested_ha >= 0),
  yield_value numeric(16,4),
  yield_unit text,
  production_value numeric(16,4),
  production_unit text,
  observed_at timestamptz NOT NULL,
  source_type text NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  UNIQUE(scheme_id,season_code,crop_code,period_code,revision)
);

CREATE TABLE IF NOT EXISTS nimis_collect.measurement (
  measurement_id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES nimis_collect.submission(submission_id),
  scheme_id text REFERENCES nimis_collect.scheme_link(scheme_id),
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  measure_code text NOT NULL,
  value numeric NOT NULL,
  unit_code text NOT NULL,
  observed_at timestamptz NOT NULL,
  source_type text NOT NULL,
  method text,
  observer_id uuid
);

CREATE TABLE IF NOT EXISTS nimis_collect.scheme_request (
  request_id uuid PRIMARY KEY,
  proposed_name text NOT NULL,
  province_code text NOT NULL,
  district_code text NOT NULL,
  location geography(Point,4326),
  applicant_user_id uuid NOT NULL,
  submitted_at timestamptz NOT NULL,
  request_status text NOT NULL DEFAULT 'PENDING'
    CHECK(request_status IN ('PENDING','POSSIBLE_DUPLICATE','CONFIRMED_NEW','MATCHED_EXISTING','REJECTED')),
  assigned_scheme_id text REFERENCES nimis_collect.scheme_link(scheme_id)
);

-- Policy: browser/mobile clients must NEVER connect directly to these tables.
-- Do not grant unauthenticated write privileges or expose through auto-generated REST.
REVOKE ALL ON ALL TABLES IN SCHEMA nimis_collect FROM PUBLIC;
REVOKE ALL ON SCHEMA nimis_collect FROM PUBLIC;
-- Dedicated API service account, row/field policies and PostGIS indexes
-- require Department ICT architecture/security review before deployment.
