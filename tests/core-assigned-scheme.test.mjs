import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync('src/core-stage-sync.ts','utf8');
const view=readFileSync('src/CoreStageSyncLab.tsx','utf8');
test('collector fetches scheme masters from main NIMIS Core instead of inventing IDs',()=>{
  assert.match(source,/loadAssignedCoreSchemes/);
  assert.match(source,/BASE\+'\/schemes'/);
  assert.match(source,/X-Nimis-Dev-Actor/);
  assert.match(source,/ISOLATED_DEVELOPMENT/);
  assert.match(source,/seen\.has\(item\.scheme_id\)/);
  assert.match(source,/item\.revision/);
  assert.match(view,/loadAssignedCoreSchemes\(\)/);
  assert.match(view,/assignedSchemes\.map/);
  assert.match(view,/setRevision\(choice\.revision\)/);
  assert.doesNotMatch(view,/setSchemeId\]=useState\(DEMO_SCHEME\)/);
});
test('pilot refuses to enqueue unassigned scheme and remains fictional only',()=>{
  assert.match(view,/assignedSchemes\.some\(item=>item\.scheme_id===schemeId\)/);
  assert.match(source,/import\.meta\.env\.DEV/);
  assert.match(source,/FICTIONAL OPERATIONS ONLY/);
  assert.doesNotMatch(source,/listDrafts|loadPhoto|saveDraft|nimis_field_pwa_v1/);
});
