-- NIMIS Collect secure sync foundation (STAGING / ICT REVIEW ONLY).
-- Applies to a dedicated approved PostgreSQL database AFTER DBA review.
-- Does not create or modify the authoritative national scheme registry.
-- An ICT-controlled view nimis_sync.current_actor_scope MUST be provided separately.
-- Expected view columns: user_id uuid, scheme_id text, role text, active boolean.
-- It must derive its scheme assignments from the authoritative NIMIS master.
BEGIN;
CREATE SCHEMA IF NOT EXISTS nimis_sync;
CREATE TABLE IF NOT EXISTS nimis_sync.enrolled_device (
  device_id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (device_id, user_id)
);
CREATE INDEX IF NOT EXISTS enrolled_device_active_user
  ON nimis_sync.enrolled_device(user_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS nimis_sync.approved_form (
  form_id text NOT NULL,
  form_version integer NOT NULL CHECK (form_version > 0),
  approved_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  PRIMARY KEY (form_id,form_version)
);
CREATE TABLE IF NOT EXISTS nimis_sync.operation (
  event_id uuid PRIMARY KEY,
  record_id uuid NOT NULL,
  user_id uuid NOT NULL,
  device_id uuid NOT NULL,
  local_sequence bigint NOT NULL CHECK (local_sequence > 0),
  scheme_id text NOT NULL,
  form_id text NOT NULL,
  form_version integer NOT NULL,
  action text NOT NULL CHECK (action = 'submit'),
  captured_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 65536),
  content_sha256 char(64) NOT NULL,
  FOREIGN KEY (device_id,user_id) REFERENCES nimis_sync.enrolled_device(device_id,user_id),
  FOREIGN KEY (form_id,form_version) REFERENCES nimis_sync.approved_form(form_id,form_version),
  UNIQUE (device_id,local_sequence)
);
CREATE INDEX IF NOT EXISTS sync_operation_scheme_received
  ON nimis_sync.operation(scheme_id,received_at DESC);
CREATE INDEX IF NOT EXISTS sync_operation_record
  ON nimis_sync.operation(record_id,received_at DESC);
REVOKE ALL ON SCHEMA nimis_sync FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA nimis_sync FROM PUBLIC;
-- Provision a least-privileged API runtime role separately via the DBA.
-- Grant SELECT on enrolled_device, approved_form and authoritative current_actor_scope VIEW;
-- grant SELECT and INSERT (NEVER UPDATE/DELETE) on operation.
-- This migration intentionally creates no demo users, schemes or tokens.
COMMIT;
