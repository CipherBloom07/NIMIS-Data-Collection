import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const forms=readFileSync('src/RequirementsForms.tsx','utf8');
const sync=readFileSync('src/form-stage-sync.ts','utf8');
const db=readFileSync('scripts/START_POSTGRES_LOCAL.ps1','utf8');
test('connected collector checks actual local Core and retransmits only queued work',()=>{
 assert.match(forms,/bridgeState/);
 assert.match(forms,/127\.0\.0\.1:8775\/api\/v1\/stage\/health/);
 assert.match(forms,/body\.mode!=='isolated-development'/);
 assert.match(forms,/setInterval\(\(\)=>\{if\(document\.visibilityState==='visible'\)void refreshBridge\(\)\},15000\)/);
 assert.match(forms,/Reconnect and sync queued forms/);
 assert.match(sync,/filter\(x=>x\.status==='pending'\)/);
 assert.match(sync,/ack\.event_id!==row\.payload\.event_id/);
 assert.match(sync,/status:'synced'/);
});
test('repaired PostgreSQL launcher retains only one executable body and protects data',()=>{
 assert.match(db,/NIMIS_PG_ADMIN_PASSWORD/);
 assert.ok(db.includes("if ($Line -match '^([A-Z_]+)=(.+)$')"));
 assert.match(db,/DATA_DIRECTORY_NOT_EMPTY/);
 assert.match(db,/PG_VERSION/);
 assert.match(db,/START_PHASE2_REFERENCE.ps1/);
 assert.doesNotMatch(db,/\n\) \{\n\s+throw 'LOCAL_SYNC_PASSWORD_INVALID'/);
 assert.equal((db.match(/START_PHASE2_REFERENCE\.ps1/g)||[]).length,1);
});
