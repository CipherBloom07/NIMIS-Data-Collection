import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const fixture=JSON.parse(readFileSync('schemas/fictional-manual-test-data.v1.json','utf8'));
const catalogue=JSON.parse(readFileSync('schemas/form-catalogue.v1.json','utf8'));
const ui=readFileSync('src/RequirementsForms.tsx','utf8');
const rules=readFileSync('src/requirements-validation.ts','utf8');

test('all fictional manual test samples match actual collector form catalogue',()=>{
  assert.equal(fixture.period_code,'2026-11');
  assert.equal(fixture.scheme.scheme_id,'00000000-0000-4000-8000-000000001000');
  assert.equal(fixture.forms.length,4);
  for(const sample of fixture.forms){
    const definition=catalogue.forms.find(form=>form.form_id===sample.form_id);
    assert.ok(definition,'Missing form: '+sample.form_id);
    const fields=new Set(definition.fields.map(field=>field.field_id));
    assert.ok(Object.keys(sample.answers).length>=5);
    for(const name of Object.keys(sample.answers))
      assert.ok(fields.has(name),sample.form_id+': invalid field '+name);
  }
});

test('field data is arithmetically plausible, explicitly fake and only guides manual entry',()=>{
  const a=fixture.forms.find(x=>x.form_id==='operational_status').answers;
  assert.ok(Number(a.actually_irrigated_area_ha)<=Number(a.functional_area_ha));
  assert.ok(Number(a.functional_area_ha)<=Number(a.equipped_area_ha));
  const crop=fixture.forms.find(x=>x.form_id==='seasonal_production').answers;
  assert.equal(Number(crop.harvested_area_ha)*Number(crop.yield),Number(crop.production));
  assert.match(fixture.note,/FICTIONAL ONLY/);
  assert.match(ui,/No answer will be filled in automatically/);
  assert.match(ui,/manualSamples\.forms\.filter/);
  assert.match(rules,/recognized draft choices/);
  assert.match(rules,/saved UUID/);
});
