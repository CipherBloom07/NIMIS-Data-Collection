import catalogue from '../schemas/form-catalogue.v1.json';
import {loadPhoto} from './storage';
import {collectorAuthorizationHeaders} from './institutional-auth';
/** Isolated LOCAL/FICTIONAL bridge for the main NIMIS Core stage form intake.
 * Only an explicit saved draft can be queued. No legacy baseline operations,
 * photos, or real user identities are read or transmitted.
 */
export type StageFormRecord = {
  id:string;form_id:string;form_version:number;scheme_id:string;
  period_code:string;observed_at:string;source:string;
  answers:Record<string,unknown>;updated_at:string;revision:number;
};
type Payload = {
  event_id:string;record_id:string;revision:number;device_id:string;
  scheme_id:string|null;form_id:string;form_version:number;period_code:string;
  observed_at:string;captured_at:string;source:string;
  base_scheme_revision:number|null;answers:Record<string,unknown>;
};
export type StageQueueItem = {
  id:string;record_id:string;revision:number;created_at:string;
  status:'pending'|'synced'|'attention';payload:Payload;
  server_status?:string;reason?:string;
};
const DB='nimis_requirements_drafts_v1',QUEUE='queue',VERSION=2;
const BASE='http://127.0.0.1:8775/api/v1/stage/forms';
const DEVICE_KEY='nimis_draft_pilot_device_v1';
function assertDev(){if(!import.meta.env.DEV)throw new Error('Development-only sync route is disabled');}
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB,VERSION);
    request.onupgradeneeded=()=>{
      if(!request.result.objectStoreNames.contains('records'))
        request.result.createObjectStore('records',{keyPath:'id'});
      if(!request.result.objectStoreNames.contains(QUEUE))
        request.result.createObjectStore(QUEUE,{keyPath:'id'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
function deviceId():string{
  let value=localStorage.getItem(DEVICE_KEY);
  if(!value){
    value=crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY,value);
  }
  return value;
}
function normalizeTime(value:string){
  const date=new Date(value);
  if(!value||!Number.isFinite(date.getTime()))throw new Error('Valid observed_at required');
  return date.toISOString();
}
export async function listFormQueue():Promise<StageQueueItem[]>{
  assertDev();
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const request=db.transaction(QUEUE,'readonly').objectStore(QUEUE).getAll();
    request.onsuccess=()=>resolve((request.result as StageQueueItem[]).sort((a,b)=>a.created_at.localeCompare(b.created_at)));
    request.onerror=()=>reject(request.error);
  });}finally{db.close();}
}
export async function queueSavedForm(record:StageFormRecord,baseRevision:number|null):Promise<StageQueueItem>{
  assertDev();
  if(!record.id||!record.revision||!record.source.trim())throw new Error('Save a valid draft with source first');
  const id=record.id+':'+record.revision;
  if(record.form_id!=='new_scheme_request'&&(!record.scheme_id||!baseRevision)) {
    throw new Error('Assigned scheme UUID and recorded master revision required');
  }
  const db=await openDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction([QUEUE,'records'],'readwrite');
    const queue=tx.objectStore(QUEUE);
    const lookup=tx.objectStore('records').get(record.id);
    let outcome:StageQueueItem|undefined;
    lookup.onsuccess=()=>{
      const saved=lookup.result as StageFormRecord|undefined;
      // Refuse to transmit edits that have not been saved to durable storage.
      if(!saved||saved.revision!==record.revision||JSON.stringify(saved.answers)!==JSON.stringify(record.answers)){
        tx.abort();reject(new Error('Save this exact form revision before queuing'));return;
      }
      const get=queue.get(id);
      get.onsuccess=()=>{
        if(get.result){outcome=get.result as StageQueueItem;return;}
        const answers=Object.fromEntries(Object.entries(record.answers)
          .filter(([,value])=>value!==''&&value!==null&&value!==undefined));
        if(Object.keys(answers).length===0){
          tx.abort();reject(new Error('Cannot synchronize an empty form'));return;
        }
        const payload:Payload={
          event_id:crypto.randomUUID(),record_id:record.id,revision:record.revision,
          device_id:deviceId(),
          scheme_id:record.form_id==='new_scheme_request'?null:record.scheme_id,
          form_id:record.form_id,form_version:record.form_version,
          period_code:record.period_code,observed_at:normalizeTime(record.observed_at),
          captured_at:record.updated_at,source:record.source.trim(),
          base_scheme_revision:record.form_id==='new_scheme_request'?null:baseRevision,
          answers,
        };
        outcome={id,record_id:record.id,revision:record.revision,
          created_at:new Date().toISOString(),status:'pending',payload};
        queue.add(outcome);
      };
      get.onerror=()=>{tx.abort();reject(get.error)};
    };
    lookup.onerror=()=>{tx.abort();reject(lookup.error)};
    tx.oncomplete=()=>resolve(outcome!);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Queue transaction failed'));
  });}finally{db.close();}
}
async function putQueue(row:StageQueueItem):Promise<void>{
  const db=await openDb();
  try{await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction(QUEUE,'readwrite');
    tx.objectStore(QUEUE).put(row);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });}finally{db.close();}
}
/**
 * Transfer each evidence blob before its immutable form JSON. Any failed or
 * incomplete upload leaves the original operation queued unchanged.
 */
async function transferEvidence(payload:Payload):Promise<void>{
  if(payload.scheme_id===null)return; // New-scheme request awaits registration.
  const definition=catalogue.forms.find(x=>x.form_id===payload.form_id);
  if(!definition)throw new Error('Form not in approved development catalogue');
  const fields=definition.fields.filter(x=>x.type==='photo'||x.type==='attachments');
  const referenced=new Set<string>();
  for(const field of fields){
    const value=payload.answers[field.field_id];
    if(typeof value==='string'&&value)referenced.add(value);
    if(Array.isArray(value))for(const id of value)if(typeof id==='string'&&id)referenced.add(id);
  }
  for(const id of referenced){
    const blob=await loadPhoto(id);
    if(!blob)throw new Error('Local photograph unavailable; retain submission and restore evidence: '+id);
    if(blob.size>524288)throw new Error('Photo exceeds server evidence limit');
    const bytes=await blob.arrayBuffer();
    const hash=await crypto.subtle.digest('SHA-256',bytes);
    const sha256=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
    const response=await fetch(BASE+'/evidence/'+encodeURIComponent(id)+
      '?scheme_id='+encodeURIComponent(payload.scheme_id),{
        method:'PUT',cache:'no-store',headers:{
          ...collectorAuthorizationHeaders(),
          'Content-Type':blob.type||'image/jpeg',
          'X-Content-SHA256':sha256,
        },body:blob,
      });
    if(!response.ok)throw new Error('Photo not acknowledged by NIMIS Core (HTTP '+response.status+')');
    const ack=await response.json();
    if(ack.photo_id!==id||ack.sha256!==sha256||
       !['accepted','duplicate'].includes(ack.outcome)){
      throw new Error('Invalid photo upload receipt; keep original evidence');
    }
  }
}
let inFlight=false;
export async function syncQueuedForms():Promise<{synced:number;remaining:number;attention:number}>{
  assertDev();
  if(inFlight)throw new Error('A sync attempt is already running');
  inFlight=true;
  let synced=0;
  try{
    const queue=(await listFormQueue()).filter(x=>x.status==='pending').slice(0,25);
    for(const row of queue){
      let response:Response;
      try{
        await transferEvidence(row.payload);
        response=await fetch(BASE+'/sync/push',{
          method:'POST',cache:'no-store',
          headers:{...collectorAuthorizationHeaders(),'Content-Type':'application/json'},
          body:JSON.stringify({operations:[row.payload]}),
        });
      }catch{
        // A network failure is not a rejection or acknowledgement.
        break;
      }
      if(!response.ok)break;
      const json=await response.json().catch(()=>null);
      const ack=json?.source==='ISOLATED_DEVELOPMENT'?json.results?.[0]:null;
      if(!ack||ack.event_id!==row.payload.event_id)break;
      if(ack.outcome==='accepted'||ack.outcome==='duplicate'){
        await putQueue({...row,status:'synced',server_status:ack.status??'STAGED',reason:undefined});
        synced++;
      }else if(ack.outcome==='conflict'||ack.outcome==='rejected'){
        await putQueue({...row,status:'attention',reason:String(ack.reason??ack.outcome)});
      }else break;
    }
    const current=await listFormQueue();
    return {synced,remaining:current.filter(x=>x.status==='pending').length,
      attention:current.filter(x=>x.status==='attention').length};
  }finally{inFlight=false;}
}
