import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const stage = readFileSync('src/core-stage-sync.ts','utf8');
const collector = readFileSync('src/App.tsx','utf8');
test('demo offline operations are isolated from real survey IndexedDB',()=>{
  const real=readFileSync('src/storage.ts','utf8');
  assert.match(real,/nimis_field_pwa_v1/);
  assert.match(stage,/nimis_core_stage_demo_v1/);
  assert.doesNotMatch(stage,/nimis_field_pwa_v1/);
  assert.doesNotMatch(stage,/listDrafts|loadPhoto|saveDraft/);
  assert.doesNotMatch(stage,/\.delete\(/);
  assert.match(stage,/state:'pending'/);
  assert.match(stage,/outcome==='accepted'\|\|ack\.outcome==='duplicate'/);
  assert.match(stage,/result\.event_id===row\.id/);
});
test('no official sync claim or auto-unlocked upload of baseline drafts',()=>{
  assert.match(stage,/FICTIONAL OPERATIONS ONLY/);
  assert.match(collector,/import\.meta\.env\.DEV && <button[^>]*coreStageView/);
  const panel=readFileSync('src/CoreStageSyncLab.tsx','utf8');
  assert.match(panel,/NOT production synchronization/);
  assert.match(panel,/Saved fictional event/);
  assert.match(panel,/Pull officer decisions/);
});
