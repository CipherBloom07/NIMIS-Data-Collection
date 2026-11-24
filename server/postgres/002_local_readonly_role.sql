-- Run ONLY in the isolated nimis_collect_dev database.
-- Supply the password with psql -v app_password=...; never put it in source.
-- The API account is read-only, not a PostgreSQL superuser.
SELECT format('CREATE ROLE nimis_demo LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nimis_demo')
\gexec
SELECT format('ALTER ROLE nimis_demo PASSWORD %L', :'app_password')
\gexec
GRANT CONNECT ON DATABASE nimis_collect_dev TO nimis_demo;
GRANT USAGE ON SCHEMA nimis_collect_demo TO nimis_demo;
GRANT SELECT ON ALL TABLES IN SCHEMA nimis_collect_demo TO nimis_demo;
ALTER DEFAULT PRIVILEGES IN SCHEMA nimis_collect_demo GRANT SELECT ON TABLES TO nimis_demo;
REVOKE CREATE ON SCHEMA nimis_collect_demo FROM nimis_demo;
