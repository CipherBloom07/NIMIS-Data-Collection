import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const forms=readFileSync('src/RequirementsForms.tsx','utf8');
const queue=readFileSync('src/form-stage-sync.ts','utf8');

test('one-click save/send never confuses offline queue with server receipt',()=>{
  assert.match(forms,/async function saveAndSubmit\(\)/);
  assert.match(forms,/const saved=await save\(\)/);
  assert.match(forms,/await queueSavedForm\(saved,saved\.base_scheme_revision\)/);
  assert.match(forms,/receipt\?\.status==='synced'/);
  assert.match(forms,/Survey received by NIMIS Core/);
  assert.match(forms,/Core is offline or busy; synchronization retries on reconnection/);
  assert.match(forms,/Save and send to District/);
  assert.match(forms,/Save offline only/);
  assert.match(forms,/Retry queued uploads/);
  assert.match(queue,/ack\.event_id!==row\.payload\.event_id/);
  assert.match(queue,/status:'pending'/);
});

test('Core availability is independent from an assignment lookup failure',()=>{
  assert.match(forms,/bridgeBusy=useRef\(false\)/);
  assert.match(forms,/bridgeBusy\.current=true/);
  assert.match(forms,/bridgeBusy\.current=false/);
  assert.match(forms,/Connected to Core, but assignment lookup needs attention/);
  assert.match(forms,/setBridgeState\('connected'\)/);
});
