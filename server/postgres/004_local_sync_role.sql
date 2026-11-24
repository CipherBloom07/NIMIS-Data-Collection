-- Local development ONLY. Supply password from ignored database/.env.local.
SELECT format('CREATE ROLE nimis_sync_demo LOGIN PASSWORD %L', :'sync_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nimis_sync_demo')
\gexec
SELECT format('ALTER ROLE nimis_sync_demo PASSWORD %L', :'sync_password')
\gexec
GRANT CONNECT ON DATABASE nimis_collect_dev TO nimis_sync_demo;
GRANT USAGE ON SCHEMA nimis_collect_demo TO nimis_sync_demo;
GRANT SELECT ON nimis_collect_demo.officer, nimis_collect_demo.scheme, nimis_collect_demo.assignment TO nimis_sync_demo;
GRANT SELECT, INSERT ON nimis_collect_demo.field_submission TO nimis_sync_demo;
GRANT UPDATE (status, reviewed_at, reviewed_by, review_note) ON nimis_collect_demo.field_submission TO nimis_sync_demo;
REVOKE CREATE ON SCHEMA nimis_collect_demo FROM nimis_sync_demo;
