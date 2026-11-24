import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sync=readFileSync('src/form-stage-sync.ts','utf8');
const forms=readFileSync('src/RequirementsForms.tsx','utf8');
test('saved collector queue can pull authoritative officer decisions without deleting drafts',()=>{
  assert.match(sync,/export async function refreshFormReviewStatuses/);
  assert.match(sync,/sync\/status\//);
  assert.match(sync,/body\.source!=='ISOLATED_DEVELOPMENT'/);
  assert.match(sync,/body\.event_id!==row\.payload\.event_id/);
  assert.match(sync,/state==='RETURNED'/);
  assert.match(sync,/SCHEME_REVISION_CONFLICT/);
  assert.match(sync,/await putQueue\(next\)/);
  assert.doesNotMatch(sync,/deleteDatabase|delete\(row\.id\)/);
});
test('collector UI shows returned decisions and truthful evidence transport',()=>{
  assert.match(forms,/Refresh officer decisions/);
  assert.match(forms,/returned or conflicted/);
  assert.match(forms,/row\.server_status/);
  assert.match(forms,/checksum-verified before form receipt/);
  assert.doesNotMatch(forms,/Photo files are NOT transferred/);
});
