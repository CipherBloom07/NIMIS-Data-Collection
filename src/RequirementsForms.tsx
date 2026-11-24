/** Review-only catalog forms derived from NIMIS requirements and mWater.
 * Every form can be drafted offline; unapproved versions are NEVER uploaded.
 * Separate IDB prevents migration/mutation of existing baseline/photo storage.
 */
import {useEffect,useState} from 'react';
import {ClipboardList,MapPin,Camera,Save} from 'lucide-react';
import catalogue from '../schemas/form-catalogue.v1.json';
import {loadAssignedCoreSchemes,type CoreAssignedScheme} from './core-stage-sync';
import {savePhoto} from './storage';
import {validateRequirementsDraft} from './requirements-validation';
import {queueSavedForm,listFormQueue,syncQueuedForms,refreshFormReviewStatuses,type StageQueueItem} from './form-stage-sync';
import {institutionalSessionIsActive,startInstitutionalSignIn,signOutInstitutionalSession} from './oidc-session';

type FormField={field_id:string;type:string;units:string|null;metadata:string[]};
type FormDefinition={form_id:string;form_version:number;name:string;frequency:string;fields:FormField[]};
type LocalRecord={
  id:string;form_id:string;form_version:number;scheme_id:string;
  base_scheme_revision:number|null;
  period_code:string;observed_at:string;source:string;
  answers:Record<string,unknown>;updated_at:string;revision:number;
  status:'DRAFT_UNAPPROVED';
};
const forms=catalogue.forms as FormDefinition[];
const DB='nimis_requirements_drafts_v1',STORE='records';
function openDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB,2);
    req.onupgradeneeded=()=>{
      if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'});
      if(!req.result.objectStoreNames.contains('queue'))req.result.createObjectStore('queue',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function transact<T>(mode:IDBTransactionMode,fn:(store:IDBObjectStore,resolve:(v:T)=>void,reject:(e:unknown)=>void)=>void):Promise<T>{
  const db=await openDb();
  try{return await new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    fn(tx.objectStore(STORE),resolve,reject);
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error||new Error('Local draft storage transaction failed'));
  });}finally{db.close();}
}
async function listRecords():Promise<LocalRecord[]>{
  return transact('readonly',(store,resolve,reject)=>{
    const req=store.getAll();req.onsuccess=()=>resolve(req.result as LocalRecord[]);
    req.onerror=()=>reject(req.error);
  });
}
async function putRecord(record:LocalRecord):Promise<void>{
  return transact('readwrite',(store,resolve,reject)=>{
    const request=store.put(record);
    request.onerror=()=>reject(request.error);
    store.transaction.oncomplete=()=>resolve();
  });
}
function labelOf(field:string){return field.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}
function valueText(value:unknown):string{
  if(typeof value==='string'||typeof value==='number')return String(value);
  return value===undefined||value===null?'':JSON.stringify(value);
}
function isMeasurement(type:string){return type.startsWith('measurement:')}
const today=()=>new Date().toISOString();
const typesSet=new Set(['text','reference','choice','choice:yes_no','choice:good_moderate_bad','choice:gauge_visual_estimate']);
function StructuredField({field,value,onChange}:{field:FormField;value:unknown;onChange:(v:unknown)=>void}){
  const template=field.type==='group'?'{}':'[]';
  const [draft,setDraft]=useState(valueText(value)||template);
  const [error,setError]=useState('');
  useEffect(()=>{setDraft(valueText(value)||template);setError('')},[value,template]);
  function apply(){
    try{
      const parsed:unknown=JSON.parse(draft);
      const valid=field.type==='group'
        ? Boolean(parsed)&&typeof parsed==='object'&&!Array.isArray(parsed)
        : Array.isArray(parsed)&&(
            field.type==='repeating_group'
              ? parsed.every(x=>x&&typeof x==='object'&&!Array.isArray(x))
              : parsed.every(x=>typeof x==='string'));
      if(!valid)throw new Error(field.type==='group'?'Expected one object':'Expected a list');
      onChange(parsed);setError('');
    }catch(error){setError('Invalid structured entries: '+String(error))}
  }
  return <div className="field">
    <span>{labelOf(field.field_id)} — {field.type.replaceAll('_',' ')}</span>
    <small>{field.type==='group'?'Enter a JSON object with named properties.':'Enter a JSON array of structured entries.'} These field templates are not yet Department-approved.</small>
    <textarea rows={4} value={draft} onChange={e=>setDraft(e.target.value)}
      spellCheck={false} aria-label={labelOf(field.field_id)+' structured data'}/>
    <button type="button" className="secondary" onClick={apply}>Validate and apply entries</button>
    {error&&<small role="alert">{error}</small>}
  </div>;
}
function Field({field,value,onChange}:{field:FormField;value:unknown;onChange:(v:unknown)=>void}){
  const type=field.type;
  const title=labelOf(field.field_id);
  if(type==='point')return <div className="field"><span>{title}</span><button type="button" className="secondary" onClick={()=>{
    navigator.geolocation?.getCurrentPosition(
      p=>onChange({latitude:p.coords.latitude,longitude:p.coords.longitude,
        accuracy_m:p.coords.accuracy,captured_at:today()}),
      ()=>{window.alert('Location unavailable: ensure GPS permission and HTTPS or localhost.')},
      {enableHighAccuracy:true,timeout:25000});
  }}><MapPin size={17}/> Capture GPS</button><small>{valueText(value)}</small></div>;
  if(type==='photo'||type==='attachments')return <label className="field"><span>{title}</span><span className="secondary small"><Camera size={16}/> Select photograph</span>
    <input type="file" accept="image/*" onChange={async event=>{
      const file=event.target.files?.[0];if(!file)return;
      try{const id=await savePhoto(file);onChange(type==='attachments'?[...(Array.isArray(value)?value:[]),id]:id)}
      catch(error){window.alert('Photo not saved: '+String(error))}
      event.target.value='';
    }}/><small>{valueText(value)}</small></label>;
  if(type==='choice:yes_no'||type==='choice:good_moderate_bad')
    return <label className="field"><span>{title}</span><select value={valueText(value)} onChange={e=>onChange(e.target.value)}>
      <option value="">Select</option>{(type==='choice:yes_no'?['Yes','No']:['Good','Moderate','Bad']).map(x=><option key={x}>{x}</option>)}
    </select></label>;
  if(isMeasurement(type)||type==='integer')return <label className="field"><span>{title} {field.units?'('+field.units+')':''}</span>
    <input type="number" min="0" step="any" value={valueText(value)} onChange={e=>onChange(e.target.value)}/></label>;
  if(type==='datetime')return <label className="field"><span>{title}</span><input type="datetime-local" value={valueText(value)} onChange={e=>onChange(e.target.value)}/></label>;
  if(type==='group'||type==='repeating_group')
    return <StructuredField field={field} value={value} onChange={onChange}/>;
  if(type==='reference_list'||type==='multi')
    return <label className="field"><span>{title} — one entry per line</span>
      <textarea rows={3} value={Array.isArray(value)?value.join('\n'):valueText(value)}
        onChange={e=>onChange(e.target.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean))}/></label>;
  if(type==='choice:gauge_visual_estimate'||type==='choice:SI87_B1_B2_B3_B4_SIRP_other'){
    const options=type==='choice:gauge_visual_estimate'
      ? ['gauge','visual','estimate']:['SI87','B1','B2','B3','B4','SIRP','other'];
    return <label className="field"><span>{title}</span>
      <select value={valueText(value)} onChange={e=>onChange(e.target.value)}>
        <option value="">Select</option>{options.map(option=><option key={option} value={option}>{option}</option>)}
      </select></label>;
  }
  if(type==='date')return <label className="field"><span>{title}</span>
    <input type="date" value={valueText(value)} onChange={e=>onChange(e.target.value)}/></label>;
  return <label className="field"><span>{title}</span>
    <input type="text" value={valueText(value)} onChange={e=>onChange(e.target.value)}
      placeholder={typesSet.has(type)?'Enter or select approved value':'Enter reference'}/></label>;
}
export default function RequirementsForms(){
  const [records,setRecords]=useState<LocalRecord[]>([]);
  const [queue,setQueue]=useState<StageQueueItem[]>([]);
  const [schemes,setSchemes]=useState<CoreAssignedScheme[]>([]);
  const [formId,setFormId]=useState(forms[0].form_id);
  const [schemeId,setSchemeId]=useState('');
  const [period,setPeriod]=useState(new Date().toISOString().slice(0,7));
  const [observed,setObserved]=useState(today());
  const [source,setSource]=useState('Field observation');
  const [answers,setAnswers]=useState<Record<string,unknown>>({});
  const [recordId,setRecordId]=useState<string|null>(null);
  const [revision,setRevision]=useState(0);
  const [notice,setNotice]=useState('Draft-only catalogue. Do not enter sensitive or official data into an unapproved development system.');
  const [busy,setBusy]=useState(false);
  const [sessionActive,setSessionActive]=useState(institutionalSessionIsActive());
  const form=forms.find(x=>x.form_id===formId)!;
  const issues=validateRequirementsDraft(formId,answers,observed,source);
  useEffect(()=>{
    void listRecords().then(setRecords).catch(error=>setNotice('Local storage: '+String(error)));
    void listFormQueue().then(setQueue).catch(error=>setNotice('Pilot queue: '+String(error)));
  },[]);
  useEffect(()=>{
    const retry=()=>{void syncQueuedForms().then(()=>{
      void listFormQueue().then(setQueue);
    }).catch(()=>{})};
    window.addEventListener('online',retry);
    return()=>window.removeEventListener('online',retry);
  },[]);
  useEffect(()=>{void loadAssignedCoreSchemes().then(list=>{
    setSchemes(list);setSchemeId(list[0]?.scheme_id??'');
  }).catch(error=>setNotice('Main NIMIS Core scheme assignments unavailable: '+String(error)))},[sessionActive]);
  function fresh(next:string){setFormId(next);setAnswers({});setRecordId(null);setRevision(0)}
  function edit(record:LocalRecord){
    setFormId(record.form_id);setSchemeId(record.scheme_id);setPeriod(record.period_code);
    setObserved(record.observed_at);setSource(record.source);setAnswers(structuredClone(record.answers));
    setRecordId(record.id);setRevision(record.revision);
    setNotice('Opened preserved local draft. Changes are not sent to NIMIS.');
  }
  async function save(){
    if(busy)return;
    if(form.form_id!=='new_scheme_request' && !schemes.some(x=>x.scheme_id===schemeId)){setNotice('Select a scheme assigned by Main NIMIS Core.');return;}
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)){setNotice('Use a valid YYYY-MM reporting period.');return;}
    setBusy(true);
    try{
      const id=recordId??crypto.randomUUID();
      const item:LocalRecord={id,scheme_id:form.form_id==='new_scheme_request'?'':schemeId,
        base_scheme_revision:form.form_id==='new_scheme_request'?null:
          (schemes.find(s=>s.scheme_id===schemeId)?.revision??null),form_id:form.form_id,
        form_version:form.form_version,period_code:period,observed_at:observed,
        source,answers:structuredClone(answers),updated_at:today(),revision:revision+1,
        status:'DRAFT_UNAPPROVED'};
      await putRecord(item);
      setRecordId(id);setRevision(item.revision);
      setRecords(await listRecords());
      setNotice('Offline draft saved with '+issues.length+' data-quality issue(s). NOT synchronized — Department-approved server validation is required.');
    }catch(error){setNotice('Saving failed. Keep this screen open: '+String(error))}
    finally{setBusy(false)}
  }
  async function enqueue(){
    const saved=records.find(row=>row.id===recordId&&row.revision===revision);
    if(!saved){setNotice('Save the current form revision first.');return;}
    const check=validateRequirementsDraft(saved.form_id,saved.answers,saved.observed_at,saved.source);
    if(check.length){setNotice('Resolve '+check.length+' data quality issue(s) before test queueing.');return;}
    setBusy(true);
    try{
      const item=await queueSavedForm(saved,saved.base_scheme_revision);
      setQueue(await listFormQueue());
      setNotice('Saved revision queued for ISOLATED fictional NIMIS Core. Event '+item.payload.event_id+' retained until acknowledged.');
    }catch(error){setNotice('Not queued: '+String(error))}
    finally{setBusy(false)}
  }
  async function upload(){
    setBusy(true);
    try{
      const result=await syncQueuedForms();
      setQueue(await listFormQueue());
      setNotice('Development sync: '+result.synced+' acknowledged, '+result.remaining+
        ' pending, '+result.attention+' require review. Referenced photos are uploaded and checksum-verified before form receipt for assigned schemes.');
    }catch(error){setNotice('Sync unavailable; operations preserved: '+String(error))}
    finally{setBusy(false)}
  }
  async function refreshReviews(){
    setBusy(true);
    try{
      const result=await refreshFormReviewStatuses();
      setQueue(await listFormQueue());
      setNotice('Officer review: '+result.checked+' receipts checked, '+result.updated+
        ' status changes, '+result.attention+' returned or conflicted. Returned submissions need a corrected new draft revision.');
    }catch(error){setNotice('Review lookup unavailable; saved receipts remain untouched: '+String(error))}
    finally{setBusy(false)}
  }
  if(!import.meta.env.DEV)return <p>Unapproved collection forms are disabled outside development.</p>;
  return <section className="panel" style={{padding:18}}>
    <div className="panel-title"><div><h2>Data collection — requirements forms</h2>
      <p>All {forms.length} proposed operational datasets · Offline drafts only · Not published or synchronized</p></div></div>
    <p role="status" className="notice">{notice}</p>
    {import.meta.env.VITE_NIMIS_AUTH_MODE==='oidc'&&<div className="form-validation">
      <strong>Institutional account: {sessionActive?'Signed in (session only)':'Not signed in'}</strong>
      <p>Uses an approved identity provider with PKCE. No shared officer account or stored access token.</p>
      {!sessionActive?<button className="secondary" type="button" onClick={()=>{
        void startInstitutionalSignIn().catch(error=>setNotice('Sign-in unavailable: '+String(error)));
      }}>Sign in with institutional account</button>:
        <button type="button" className="secondary" onClick={()=>{
          signOutInstitutionalSession();setSessionActive(false);setSchemes([]);setSchemeId('');
        }}>Sign out of this device</button>}
    </div>}
    <div className="form-grid">
      <label className="field"><span>Required dataset</span><select value={formId} onChange={e=>fresh(e.target.value)}>
        {forms.map(f=><option key={f.form_id} value={f.form_id}>{f.name}</option>)}</select></label>
      <label className="field"><span>{form.form_id==='new_scheme_request'?'Existing scheme (optional — new scheme request only)':'Assigned scheme (Main NIMIS Core)'}</span>
        <select value={schemeId} onChange={e=>setSchemeId(e.target.value)}>
          {!schemes.length&&<option value="">No approved scheme assignments loaded</option>}
          {schemes.map(s=><option key={s.scheme_id} value={s.scheme_id}>{s.scheme_name} — {s.scheme_code}</option>)}
        </select></label>
      <label className="field"><span>Reporting month</span><input type="month" value={period} onChange={e=>setPeriod(e.target.value)}/></label>
      <label className="field"><span>Observation timestamp (UTC)</span><input value={observed} onChange={e=>setObserved(e.target.value)}/></label>
      <label className="field"><span>Evidence source</span><input value={source} onChange={e=>setSource(e.target.value)}/></label>
    </div>
    <p><strong>Reporting frequency:</strong> {form.frequency}. Form dictionary is DRAFT; values and conditional rules require Department approval.</p>
    <div role="status" className="form-validation"><strong>Preflight data quality:</strong> {issues.length} issue(s).
      {issues.length>0&&<ul>{issues.slice(0,10).map((issue,index)=>
        <li key={issue.field+index}>{issue.field}: {issue.message}</li>)}</ul>}
      <p>Drafts can be saved with issues, but cannot be synchronized or published as verified records.</p>
    </div>
    <div className="form-grid">
      {form.fields.map(field=><Field key={field.field_id} field={field} value={answers[field.field_id]}
        onChange={v=>setAnswers(old=>({...old,[field.field_id]:v}))}/>)}
    </div>
    <div style={{display:'flex',gap:12,flexWrap:'wrap',padding:'16px 0'}}>
      <button className="primary" disabled={busy||(!schemeId&&form.form_id!=='new_scheme_request')} onClick={()=>void save()}><Save size={18}/> Save offline draft</button>
      <button className="secondary" disabled={busy||issues.length>0||!recordId} onClick={()=>void enqueue()}>Queue saved revision (fictional test)</button>
      <button className="secondary" disabled={busy||!queue.some(x=>x.status==='pending')} onClick={()=>void upload()}>Sync test queue to NIMIS Core</button>
      <button className="secondary" disabled={busy||!queue.some(x=>x.status==='synced'||Boolean(x.server_status))}
        onClick={()=>void refreshReviews()}>Refresh officer decisions</button>
      <span>Revision {revision} · No automatic upload or approval</span>
    </div>
    <p role="status"><strong>Development queue:</strong> {queue.filter(x=>x.status==='pending').length} pending,
      {' '}{queue.filter(x=>x.status==='synced').length} acknowledged,
      {' '}{queue.filter(x=>x.status==='attention').length} need attention.
      Photos for assigned schemes are uploaded to the isolated local Core before form receipt; originals remain on the device.</p>
    {queue.filter(x=>x.status==='attention'||x.server_status==='EVIDENCE_PENDING').length>0&&
     <div role="status" className="form-validation"><strong>Collector follow-up required</strong>
      {queue.filter(x=>x.status==='attention'||x.server_status==='EVIDENCE_PENDING')
        .map(row=><p key={row.id}>{row.payload.form_id} · {row.payload.period_code} · {row.server_status??row.status}
          {row.reason?': '+row.reason:''}</p>)}
     </div>}
    {queue.some(x=>Boolean(x.server_status))&&
     <div><h3>Officer review status</h3>
      {queue.filter(x=>Boolean(x.server_status)).slice(-10).map(row=>
       <p key={row.id}><strong>{row.payload.form_id}</strong> · {row.payload.period_code} · {row.server_status}
       </p>)}</div>}
    <h3><ClipboardList size={18}/> Saved local forms</h3>
    {records.length===0?<p>No drafts in the proposed form catalogue.</p>:
      <div className="record-list">{records.slice().reverse().map(row=><button key={row.id} className="record"
        onClick={()=>edit(row)}><strong>{forms.find(f=>f.form_id===row.form_id)?.name??row.form_id}</strong>
        <span>{row.period_code} · {row.status} · Revision {row.revision}</span></button>)}</div>}
  </section>;
}
