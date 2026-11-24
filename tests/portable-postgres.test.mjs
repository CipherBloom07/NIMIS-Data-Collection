import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(name, 'utf8');
const defaultLauncher = read('scripts/START_POSTGRES_DEMO.ps1');
const local = read('scripts/START_POSTGRES_LOCAL.ps1');
const stop = read('scripts/STOP_POSTGRES_LOCAL.ps1');
const role = read('server/postgres/002_local_readonly_role.sql');
const ignore = read('.gitignore');

test('default PostgreSQL launcher no longer depends on Docker', () => {
  assert.match(defaultLauncher, /START_POSTGRES_LOCAL.ps1/);
  assert.doesNotMatch(defaultLauncher, /docker compose|Docker Desktop/);
});

test('portable database stays under the NIMIS project and does not install a Windows service', () => {
  for (const marker of ['database', 'postgresql', 'data', 'logs', 'initdb.exe',
    'pg_ctl.exe', 'psql.exe', '127.0.0.1', '55432', 'PG_VERSION']) {
    assert.ok(local.includes(marker), marker);
  }
  assert.doesNotMatch(local, /New-Service|sc\.exe\s+create|docker\s+compose/);
  assert.match(ignore, /\/database\//);
});

test('existing data and secrets are not overwritten, client role remains read-only', () => {
  assert.match(local, /if \(-not \(Test-Path -LiteralPath \$Secrets\)\)/);
  assert.match(local, /NONEMPTY|DATA_DIRECTORY_NOT_EMPTY/);
  assert.match(role, /GRANT SELECT ON ALL TABLES/);
  assert.match(role, /REVOKE CREATE/);
  assert.match(role, /CREATE ROLE nimis_demo|CREATE ROLE nimis_demo LOGIN/);
});

test('stopping local PostgreSQL preserves stored records', () => {
  assert.match(stop, /-m fast -w -t 60 stop/);
  assert.match(stop, /Database data preserved/);
  assert.doesNotMatch(stop, /Remove-Item|DROP DATABASE|TRUNCATE/);
});


test('portable installer creates only missing 64-hex sync password before sync role SQL',()=>{
 assert.match(local,/if \(-not \$Values\.ContainsKey\('NIMIS_PG_SYNC_PASSWORD'\)\)/);
 assert.match(local,/Add-Content -LiteralPath \$Secrets -Encoding ASCII/);
 assert.match(local,/LOCAL_SYNC_PASSWORD_INVALID/);
 assert.match(local,/004_local_sync_role\.sql/);
 assert.ok(local.indexOf("if (-not $Values.ContainsKey('NIMIS_PG_SYNC_PASSWORD'))")<
  local.indexOf("004_local_sync_role.sql"));
});
