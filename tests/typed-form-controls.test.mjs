import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync('src/RequirementsForms.tsx','utf8');
const validator=readFileSync('src/requirements-validation.ts','utf8');
test('collection UI preserves arrays and objects rather than sending unstructured blobs',()=>{
  assert.match(app,/function StructuredField/);
  assert.match(app,/type==='repeating_group'/);
  assert.match(app,/type==='reference_list'\|\|type==='multi'/);
  assert.match(app,/Validate and apply entries/);
  assert.match(app,/type==='date'/);
  assert.match(validator,/repeating form section must contain structured records/);
  assert.match(validator,/Enter a list of named entries/);
  assert.match(validator,/non-negative/);
});
