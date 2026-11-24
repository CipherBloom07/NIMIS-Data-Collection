import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const catalog=JSON.parse(readFileSync('schemas/form-catalogue.v1.json','utf8'));
const forms=readFileSync('src/RequirementsForms.tsx','utf8');
const app=readFileSync('src/App.tsx','utf8');
const sync=readFileSync('src/core-stage-sync.ts','utf8');
const expected=[
  'baseline','operational_status','seasonal_production','water_availability',
  'infrastructure_incident','om_finance','energy_power','project_update',
  'risk_register','farmer_plot','new_scheme_request'
];

test('NIMIS requirements catalogue covers eleven explicitly versioned datasets',()=>{
  assert.deepEqual(catalog.forms.map(x=>x.form_id),expected);
  for(const item of catalog.forms){
    assert.equal(item.form_version,1);
    assert.ok(item.fields.length>=5);
    const names=item.fields.map(x=>x.field_id);
    assert.equal(new Set(names).size,names.length);
    assert.ok(item.frequency);
  }
});
test('collector supports offline local drafts for each dataset without uploading unapproved records',()=>{
  assert.match(forms,/nimis_requirements_drafts_v1/);
  assert.match(forms,/DRAFT_UNAPPROVED/);
  assert.match(forms,/loadAssignedCoreSchemes/);
  assert.match(forms,/putRecord\(item\)/);
  assert.doesNotMatch(forms,/fetch\(['"]?\/api/);
  assert.doesNotMatch(forms,/syncStageOperations/);
  assert.match(app,/Requirements Forms \(Draft\)/);
  assert.match(app,/requirementsView \? <RequirementsForms\/>/);
  assert.match(sync,/FICTIONAL OPERATIONS ONLY/);
});
test('mWater baseline values and NIMIS data dimensions retain distinct semantic keys',()=>{
  const fields=new Set(catalog.forms.flatMap(x=>x.fields.map(y=>y.field_id)));
  for(const key of [
    'scheme_gps','scheme_photo','equipped_area_ha','functional_area_ha',
    'actually_irrigated_area_ha','water_source_id','asset_id','plot_id',
    'project_id','observed_at','energy_source','maintenance_activities',
    'market_destination'
  ])assert.ok(fields.has(key),key);
});
