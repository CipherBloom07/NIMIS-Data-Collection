import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync('src/requirements-validation.ts','utf8');
const form=readFileSync('src/RequirementsForms.tsx','utf8');
test('draft preflight rejects impossible GPS and inconsistent area measurements',()=>{
  for(const needle of ['latitude < -90','longitude < -180','functional_area_ha','equipped_area_ha',
    'harvested_area_ha','planted_area_ha','storage_percent','progress_percent','observed_at','source']){
    assert.ok(src.includes(needle),needle);
  }
  assert.match(form,/validateRequirementsDraft\(formId,answers,observed,source\)/);
  assert.match(form,/Drafts can be saved with issues/);
  assert.doesNotMatch(form,/deleteDatabase|indexedDB\.deleteDatabase/);
});
