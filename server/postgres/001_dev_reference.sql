-- PostgreSQL-backed NIMIS Collect development reference data.
-- ONLY for a separately provisioned, empty development database.
-- NEVER execute against the authoritative Ministry database.
-- Real scheme masters remain under main NIMIS control.
BEGIN;
CREATE SCHEMA IF NOT EXISTS nimis_collect_demo;
REVOKE ALL ON SCHEMA nimis_collect_demo FROM PUBLIC;

CREATE TABLE IF NOT EXISTS nimis_collect_demo.officer (
  officer_id uuid PRIMARY KEY,
  role_code text NOT NULL CHECK (role_code IN ('field_officer','scheme_manager','dido','pido')),
  active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS nimis_collect_demo.scheme (
  scheme_id text PRIMARY KEY,
  name text NOT NULL,
  province_code text NOT NULL,
  district_code text NOT NULL,
  master_version bigint NOT NULL CHECK (master_version > 0),
  is_fictional boolean NOT NULL DEFAULT true CHECK (is_fictional)
);
CREATE INDEX IF NOT EXISTS scheme_district_index ON nimis_collect_demo.scheme (province_code, district_code);
CREATE TABLE IF NOT EXISTS nimis_collect_demo.assignment (
  officer_id uuid NOT NULL REFERENCES nimis_collect_demo.officer(officer_id),
  scheme_id text NOT NULL REFERENCES nimis_collect_demo.scheme(scheme_id),
  role_code text NOT NULL CHECK (role_code IN ('field_officer','scheme_manager','dido','pido')),
  revoked_at timestamptz,
  PRIMARY KEY(officer_id, scheme_id, role_code)
);
CREATE INDEX IF NOT EXISTS assignment_officer_active_index ON nimis_collect_demo.assignment (officer_id) WHERE revoked_at IS NULL;

-- Fictional fixtures. Do not insert real farmer, phone or personal data.
INSERT INTO nimis_collect_demo.officer(officer_id, role_code)
VALUES ('10000000-0000-4000-8000-000000000001','field_officer')
ON CONFLICT (officer_id) DO NOTHING;
INSERT INTO nimis_collect_demo.scheme(scheme_id, name, province_code, district_code, master_version)
VALUES ('DEMO-SCHEME-001', 'Example Scheme (fictional)', 'DEMO-PROVINCE', 'DEMO-DISTRICT', 1)
ON CONFLICT (scheme_id) DO NOTHING;
INSERT INTO nimis_collect_demo.assignment(officer_id, scheme_id, role_code)
VALUES ('10000000-0000-4000-8000-000000000001','DEMO-SCHEME-001','field_officer')
ON CONFLICT (officer_id, scheme_id, role_code) DO NOTHING;

REVOKE ALL ON ALL TABLES IN SCHEMA nimis_collect_demo FROM PUBLIC;
COMMIT;
