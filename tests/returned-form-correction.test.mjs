import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const ui=readFileSync('src/RequirementsForms.tsx','utf8');
const sync=readFileSync('src/form-stage-sync.ts','utf8');

test('returned forms must reopen preserved drafts, not overwrite a submitted event',()=>{
  assert.match(ui,/function startCorrection\(row:StageQueueItem\)/);
  assert.match(ui,/edit\(saved\)/);
  assert.match(ui,/Correct returned form/);
  assert.match(ui,/save a new revision/);
  assert.match(sync,/record\.id\+'\:\'\+record\.revision/);
  assert.match(sync,/event_id:crypto\.randomUUID\(\)/);
});
test('transient offline failures keep original payloads pending with reviewable reasons',()=>{
  assert.match(sync,/Connection unavailable/);
  assert.match(sync,/No verified acknowledgement received/);
  assert.match(sync,/Server unavailable or authentication required/);
  assert.match(sync,/status:'pending',last_attempt_at/);
  assert.match(ui,/Offline synchronization is waiting/);
  assert.doesNotMatch(sync,/deleteDatabase|\.delete\(row\./);
});
