/** ISOLATED FICTIONAL OPERATIONS ONLY.
 * Separate from real baseline survey drafts/photos/outbox. No data leaves device
 * except user-created fictional Stage 1 operational status measurements.
 */
export type StageState = 'pending' | 'synced' | 'needs_attention' | 'conflict';
export type StageMeasurement = {
  name:'equipped_area_ha'|'functional_area_ha';
  value:string; unit:'ha'; observed_at:string; source:string;
};
export type StagePayload = {
  submission_id:string;event_id:string;scheme_id:string;device_id:string;
  form_id:'operational_status';form_version:1;
  period_code:string;prior_submission_id:string|null;
  base_scheme_revision:number;captured_at:string;
  measurements:StageMeasurement[];note:string;
};
export type StageOperation = {
  id:string; created_at:string; state:StageState;
  payload:StagePayload; server_status?:string; last_error?:string;
};
const STORE='nimis_core_stage_demo_operations_v1';
const DATABASE='nimis_core_stage_demo_v1';
const STAGE_ACTOR='00000000-0000-4000-8000-000000000004';
const BASE='http://127.0.0.1:8775/api/v1/stage';
export const DEMO_SCHEME='00000000-0000-4000-8000-000000001000';

function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains(STORE)){
        request.result.createObjectStore(STORE,{keyPath:'id'});
      }
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function all():Promise<StageOperation[]>{
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const request=db.transaction(STORE,'readonly').objectStore(STORE).getAll();
    request.onsuccess=()=>resolve((request.result as StageOperation[]).sort((a,b)=>a.created_at.localeCompare(b.created_at)));
    request.onerror=()=>reject(request.error);
  });}finally{db.close();}
}
async function save(row:StageOperation){
  const db=await openDb();
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(STORE,'readwrite');
    tx.objectStore(STORE).put(row);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error??new Error('Stage operation save failed'));
  });}finally{db.close();}
}
export const listStageOperations=all;

export async function addStageOperation(input:{
  schemeId:string;equippedHa:string;functionalHa:string;periodCode:string;
  baseRevision:number;priorSubmissionId?:string|null;
}):Promise<StageOperation>{
  const equipped=Number(input.equippedHa),functional=Number(input.functionalHa);
  if(!Number.isFinite(equipped)||!Number.isFinite(functional)||functional<0||equipped<0||functional>equipped){
    throw new Error('Enter valid hectares: functional area must not exceed equipped area.');
  }
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodCode))throw new Error('Reporting period must be YYYY-MM.');
  if(!/^[0-9a-f-]{36}$/i.test(input.schemeId))throw new Error('Use a valid fictional scheme UUID.');
  if(!Number.isInteger(input.baseRevision)||input.baseRevision<1)throw new Error('Revision must be a positive integer.');
  const now=new Date().toISOString();
  const eventId=crypto.randomUUID();
  const payload:StagePayload={
    event_id:eventId,submission_id:crypto.randomUUID(),
    scheme_id:input.schemeId,device_id:crypto.randomUUID(),
    form_id:'operational_status',form_version:1,period_code:input.periodCode,
    prior_submission_id:input.priorSubmissionId??null,
    base_scheme_revision:input.baseRevision,captured_at:now,
    measurements:[
      {name:'equipped_area_ha',value:equipped.toFixed(2),unit:'ha',observed_at:now,source:'Synthetic stage sync test'},
      {name:'functional_area_ha',value:functional.toFixed(2),unit:'ha',observed_at:now,source:'Synthetic stage sync test'},
    ],
    note:'Fictional test only — not a real scheme survey',
  };
  const row:StageOperation={id:eventId,created_at:now,state:'pending',payload};
  await save(row);
  return row;
}

let inFlight=false;
export async function syncStageOperations():Promise<{accepted:number;pending:number;errors:number}>{
  if(inFlight)throw new Error('Stage synchronization is already running.');
  inFlight=true;
  let accepted=0,errors=0;
  try{
    const rows=(await all()).filter(row=>row.state==='pending').slice(0,25);
    if(rows.length===0)return {accepted:0,pending:0,errors:0};
    const response=await fetch(BASE+'/sync/push',{
      method:'POST',cache:'no-store',
      headers:{'Content-Type':'application/json','X-Nimis-Dev-Actor':STAGE_ACTOR},
      body:JSON.stringify({operations:rows.map(row=>row.payload)}),
    });
    if(!response.ok)throw new Error('Development server returned HTTP '+response.status+'. Keep operations queued.');
    const data:unknown=await response.json();
    if(!data||typeof data!=='object'||!('results' in data)||!Array.isArray(data.results)){
      throw new Error('Invalid sync acknowledgements; no operations were cleared.');
    }
    const acknowledgements=data.results as Array<{index?:number;event_id?:string;outcome?:string;status?:string;reason?:unknown}>;
    for(let i=0;i<rows.length;i++){
      const row=rows[i];
      const ack=acknowledgements.find(result=>result.index===i&&result.event_id===row.id);
      if(!ack){errors++;continue;}
      if(ack.outcome==='accepted'||ack.outcome==='duplicate'){
        await save({...row,state:'synced',server_status:ack.status,last_error:undefined});
        accepted++;
      }else if(ack.outcome==='rejected'||ack.outcome==='conflict'){
        await save({...row,state:ack.outcome==='conflict'?'conflict':'needs_attention',
          last_error:typeof ack.reason==='string'?ack.reason:JSON.stringify(ack.reason??'Review the submitted fields')});
        errors++;
      }else errors++;
    }
    return {accepted,pending:(await all()).filter(row=>row.state==='pending').length,errors};
  }finally{inFlight=false;}
}

/** Explicitly refresh latest officer review status; never changes the local event payload. */
export async function pullStageStatuses():Promise<{updated:number;errors:number}>{
  const rows=(await all()).filter(row=>row.state==='synced').slice(-25);
  let updated=0,errors=0;
  for(const row of rows){
    try{
      const response=await fetch(BASE+'/sync/status/'+encodeURIComponent(row.payload.submission_id),{
        cache:'no-store',headers:{'X-Nimis-Dev-Actor':STAGE_ACTOR},
      });
      if(!response.ok){errors++;continue;}
      const payload:unknown=await response.json();
      if(!payload||typeof payload!=='object'||!('submission_id' in payload)||
         payload.submission_id!==row.payload.submission_id||!('status' in payload)||
         typeof payload.status!=='string'){
         errors++;continue;
      }
      await save({...row,server_status:payload.status});
      updated++;
    }catch{errors++}
  }
  return {updated,errors};
}
