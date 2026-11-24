import {useCallback,useEffect,useState} from 'react';
import {AlertTriangle,CloudUpload,Database,RefreshCw,Save,ShieldCheck,WifiOff} from 'lucide-react';
import {addStageOperation,loadAssignedCoreSchemes,listStageOperations,pullStageStatuses,syncStageOperations,type StageOperation,type CoreAssignedScheme} from './core-stage-sync';

const periodNow=()=>new Date().toISOString().slice(0,7);
export default function CoreStageSyncLab(){
  const [rows,setRows]=useState<StageOperation[]>([]);
  const [schemeId,setSchemeId]=useState('');
  const [assignedSchemes,setAssignedSchemes]=useState<CoreAssignedScheme[]>([]);
  const [assignmentsLoading,setAssignmentsLoading]=useState(true);
  const [period,setPeriod]=useState(periodNow);
  const [revision,setRevision]=useState(1);
  const [equipped,setEquipped]=useState('20');
  const [functional,setFunctional]=useState('12.5');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('A fictional scheme and collector assignment must first be seeded in Main NIMIS Core.');
  const [online,setOnline]=useState(navigator.onLine);

  const refresh=useCallback(async()=>setRows(await listStageOperations()),[]);
  useEffect(()=>{void refresh().catch(error=>setMessage(String(error)))},[refresh]);
  useEffect(()=>{
    let alive=true;
    void loadAssignedCoreSchemes().then(items=>{
      if(!alive)return;
      setAssignedSchemes(items);
      setSchemeId(current=>items.some(item=>item.scheme_id===current)?current:items[0]?.scheme_id??'');
      if(items[0])setRevision(items[0].revision);
      setMessage(items.length
        ? 'Loaded '+items.length+' assigned fictional scheme(s) directly from Main NIMIS Core. No national records were copied.'
        : 'No fictional schemes assigned. Create and assign a test scheme in Main NIMIS Core first.');
    }).catch(error=>{
      if(alive)setMessage('Assigned schemes unavailable; no data submitted: '+String(error));
    }).finally(()=>{if(alive)setAssignmentsLoading(false)});
    return()=>{alive=false};
  },[]);
  const sync=useCallback(async()=>{
    setBusy(true);
    try{
      const report=await syncStageOperations();
      await refresh();
      setMessage('Demo sync result: '+report.accepted+' acknowledged, '+report.pending+' still pending, '+report.errors+' need attention. Baseline drafts and photos remain untouched.');
    }catch(error){setMessage('Network or API unavailable; fictional events retained for retry: '+String(error))}
    finally{setBusy(false)}
  },[refresh]);
  useEffect(()=>{
    const on=()=>{setOnline(true);void sync()};
    const off=()=>setOnline(false);
    window.addEventListener('online',on);
    window.addEventListener('offline',off);
    return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)};
  },[sync]);
  async function pullStatus(){
    if(busy)return;
    setBusy(true);
    try{
      const report=await pullStageStatuses();
      await refresh();
      setMessage('Status pull: '+report.updated+' fictional submissions updated; '+report.errors+' unavailable. History retained.');
    }catch(error){setMessage('Status pull unavailable: '+String(error))}
    finally{setBusy(false)}
  }
  async function capture(){
    if(busy)return;
    setBusy(true);
    try{
      if(!assignedSchemes.some(item=>item.scheme_id===schemeId)){
        throw new Error('Choose a scheme currently assigned by Main NIMIS Core.');
      }
      const relevant=rows.filter(row=>row.payload.scheme_id===schemeId&&row.payload.period_code===period);
      if(relevant.some(row=>row.state!=='synced')){
        throw new Error('There is an unsynced fictional observation for this scheme and period. Sync or inspect it before making a correction.');
      }
      const last=relevant.at(-1);
      const row=await addStageOperation({
        schemeId,periodCode:period,baseRevision:revision,
        equippedHa:equipped,functionalHa:functional,
        priorSubmissionId:last?.payload.submission_id??null,
      });
      await refresh();
      setMessage('Saved fictional event '+row.id+' offline. No server call was made; use Sync test queue when connected.');
    }catch(error){setMessage('Not saved: '+String(error))}
    finally{setBusy(false)}
  }
  const pending=rows.filter(row=>row.state==='pending').length;
  const errors=rows.filter(row=>row.state==='needs_attention'||row.state==='conflict').length;
  return <section className="panel" aria-labelledby="stage-lab-heading">
    <div className="panel-title"><div><h2 id="stage-lab-heading">Core PostgreSQL Offline Sync Lab</h2>
      <p>Fictional operational-status events only • never uploads real baseline drafts or photographs</p></div></div>
    <div className="notice" role="note" style={{display:'flex',gap:10,alignItems:'flex-start',margin:'14px 0',padding:14}}>
      <AlertTriangle size={19} aria-hidden="true"/>
      <div><strong>Local development test, NOT production synchronization.</strong>
      <p>Requires the isolated Main NIMIS Core API at 127.0.0.1:8775 with explicitly seeded synthetic officer IDs.
        This test outbox uses separate IndexedDB storage and does not access existing survey answers.</p></div>
    </div>
    <div className="metrics">
      <div className="metric"><span>Fictional pending events</span><strong>{pending}</strong><small>Retained until acknowledged</small></div>
      <div className="metric"><span>Conflicts / needs attention</span><strong>{errors}</strong><small>Never silently cleared</small></div>
      <div className="metric"><span>Network state</span><strong>{online?'Online':'Offline'}</strong><small>Local-only backend required</small></div>
    </div>
    <div className="form-grid" style={{padding:14}}>
      <label className="field"><span>Scheme assigned by Main NIMIS Core (fictional pilot)</span>
        <select value={schemeId} disabled={assignmentsLoading||assignedSchemes.length===0}
          onChange={event=>{
            const choice=assignedSchemes.find(item=>item.scheme_id===event.target.value);
            setSchemeId(choice?.scheme_id??'');
            if(choice)setRevision(choice.revision);
          }}>
          {assignedSchemes.length===0&&<option value="">No assigned schemes loaded</option>}
          {assignedSchemes.map(item=><option key={item.scheme_id} value={item.scheme_id}>
            {item.scheme_name} · {item.scheme_code} · {item.district_code}
          </option>)}
        </select></label>
      <label className="field"><span>Reporting period (YYYY-MM)</span>
        <input type="month" value={period} onChange={event=>setPeriod(event.target.value)}/></label>
      <label className="field"><span>Known master revision</span>
        <input type="number" min="1" step="1" value={revision} onChange={event=>setRevision(Number(event.target.value))}/></label>
      <label className="field"><span>Equipped area — hectares</span>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={equipped} onChange={event=>setEquipped(event.target.value)}/></label>
      <label className="field"><span>Functional area — hectares</span>
        <input type="number" inputMode="decimal" min="0" step="0.01" value={functional} onChange={event=>setFunctional(event.target.value)}/></label>
    </div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',padding:'10px 14px'}}>
      <button type="button" className="primary" disabled={busy||!schemeId||assignmentsLoading} onClick={()=>void capture()}><Save size={16}/> Save fictional event offline</button>
      <button type="button" className="secondary" disabled={busy||pending===0||!online} onClick={()=>void sync()}>
        {online?<CloudUpload size={16}/>:<WifiOff size={16}/>} Sync test queue</button>
      <button type="button" className="secondary" disabled={busy} onClick={()=>void refresh()}><RefreshCw size={16}/> Refresh status</button>
      <button type="button" className="secondary" disabled={busy||!online||!rows.some(row=>row.state==='synced')} onClick={()=>void pullStatus()}><ShieldCheck size={16}/> Pull officer decisions</button>
    </div>
    <p role="status" style={{padding:'5px 14px',fontWeight:650}}>{message}</p>
    <div className="panel-title"><div><h3>Retained fictional event history</h3>
      <p>Acknowledged events remain in this separate lab store for troubleshooting.</p></div></div>
    {rows.length===0?<p className="empty">No staged fictional observations yet.</p>:
      <div className="record-list">{rows.slice().reverse().map(row=><div className="record" key={row.id} style={{cursor:'default'}}>
        <Database size={20}/>
        <div className="record-details"><strong>{row.payload.period_code} · {row.payload.scheme_id.slice(0,8)}</strong>
          <span>{row.state.toUpperCase()} · {row.server_status||'not confirmed by server'}</span>
          {row.last_error&&<small style={{color:'#963f20'}}>{row.last_error}</small>}
        </div><ShieldCheck size={17}/></div>)}</div>}
  </section>;
}
