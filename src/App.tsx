import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Camera, Check, ClipboardList, CloudOff, Download, Droplets, FilePlus2, MapPin, Menu, Save, Wifi, WifiOff, X } from 'lucide-react';
import { allFields, sections, type SurveyField } from './survey';
import { listDrafts, listOutbox, loadPhoto, saveDraft, savePhoto, type Draft, type SurveyAnswers, type Answer } from './storage';
import './styles.css';

function getText(value: Answer | undefined): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}
const newValues = (): SurveyAnswers => ({});
export default function App() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [outboxCount, setOutboxCount] = useState(0);
  const [activeId, setActiveId] = useState<string | null | undefined>(undefined);
  const [answers, setAnswers] = useState<SurveyAnswers>(newValues);
  const [step, setStep] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [menuOpen, setMenuOpen] = useState(false);
  const [photoPreviews, setPhotoPreviews] = useState<Record<string,string>>({});

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    void refresh();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);

  async function refresh() {
    try {
      const [items, pending] = await Promise.all([listDrafts(), listOutbox()]);
      setDrafts(items);
      setOutboxCount(pending.length);
    } catch (error) { setNotice('Local storage unavailable: ' + String(error)); }
  }

  function begin(draft?: Draft) {
    setActiveId(draft?.id ?? null);
    setAnswers(draft ? structuredClone(draft.answers) : newValues());
    setStep(0);
    setNotice('');
    setMenuOpen(false);
  }

  const section = sections[step];
  const completed = useMemo(() =>
    allFields.filter(field => {
      const value = answers[field.key];
      return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';
    }).length, [answers]);
  const fill = (key: string, value: Answer) => setAnswers(previous => ({ ...previous, [key]: value }));

  async function save() {
    if (!getText(answers.scheme_name).trim()) {
      setNotice('Please enter the irrigation scheme name first.');
      setStep(0);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await saveDraft(activeId ?? null, answers);
      setActiveId(undefined);
      setNotice('Survey saved on this device. No data has been uploaded.');
      await refresh();
    } catch (error) { setNotice('Unable to save survey: ' + String(error)); }
    finally { setBusy(false); }
  }

  function captureGps(key: string) {
    if (!navigator.geolocation) { setNotice('GPS is unavailable in this browser.'); return; }
    setNotice('Capturing GPS location…');
    navigator.geolocation.getCurrentPosition(
      position => {
        fill(key, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          captured_at: new Date().toISOString(),
        });
        setNotice('GPS captured. Save the survey to store this location.');
      },
      error => setNotice('Location not captured: ' + error.message),
      { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
    );
  }

  async function attachPhoto(key: string, file?: File) {
    if (!file) return;
    try {
      const id = await savePhoto(file);
      fill(key, id);
      setPhotoPreviews(previous => ({ ...previous, [key]: URL.createObjectURL(file) }));
      setNotice('Photograph stored offline on this device. Save the survey to keep the reference.');
    } catch (error) { setNotice('Photo could not be stored: ' + String(error)); }
  }

  useEffect(() => {
    const urls: string[] = [];
    let active = true;
    for (const field of allFields.filter(f => f.type === 'photo')) {
      const id = answers[field.key];
      if (typeof id !== 'string') continue;
      void loadPhoto(id).then(blob => {
        if (blob && active) {
          const url = URL.createObjectURL(blob);
          urls.push(url);
          setPhotoPreviews(previous => ({ ...previous, [field.key]: url }));
        }
      }).catch(() => {});
    }
    return () => { active = false; urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [activeId]);

  async function exportDrafts() {
    try {
      const content = JSON.stringify({ format: 'nimis-field-backup', exportedAt: new Date().toISOString(), drafts }, null, 2);
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'nimis-survey-drafts.json'; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('JSON backup exported (photograph binary files are not included).');
    } catch (error) { setNotice('Export failed: ' + String(error)); }
  }

  function fieldUI(field: SurveyField) {
    const value = answers[field.key];
    if (field.type === 'select') return (
      <label className="field" key={field.key}><span>{field.label}</span>
        <select value={getText(value)} onChange={event => fill(field.key, event.target.value)}>
          <option value="">Select an option</option>
          {field.options?.map(option => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
    );
    if (field.type === 'multi') return (
      <fieldset className="field check-group" key={field.key}>
        <legend>{field.label}</legend>
        <div className="check-options">{field.options?.map(option => {
          const chosen = Array.isArray(value) && value.includes(option);
          return <label key={option} className="check-option">
            <input type="checkbox" checked={chosen} onChange={event => {
              const items = new Set(Array.isArray(value) ? value : []);
              if (event.target.checked) items.add(option); else items.delete(option);
              fill(field.key, Array.from(items));
            }}/>{option}
          </label>;
        })}</div>
      </fieldset>
    );
    if (field.type === 'gps') {
      const point = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
      return <div className="field attachment" key={field.key}>
        <span>{field.label}</span>
        <div className="attachment-inner"><div className="attachment-state">
          <MapPin size={20}/>{point ? <span>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)} (±{point.accuracy_m.toFixed(0)}m)</span> : <span>GPS not recorded</span>}
        </div><button type="button" className="secondary small" onClick={() => captureGps(field.key)}>Capture GPS</button></div>
      </div>;
    }
    if (field.type === 'photo') {
      return <label className="field attachment" key={field.key}><span>{field.label}</span>
        <div className="attachment-inner"><div className="attachment-state">
          {photoPreviews[field.key] ? <img className="thumb" src={photoPreviews[field.key]} alt="Saved field evidence"/> : <Camera size={20}/>}
          <span>{typeof value === 'string' ? 'Photo stored on device' : 'No photo attached'}</span>
        </div><span className="secondary small faux-button">Take / select photo</span></div>
        <input className="visually-hidden" type="file" accept="image/*" capture="environment" onChange={event => {
          void attachPhoto(field.key, event.target.files?.[0]); event.currentTarget.value = '';
        }}/>
      </label>;
    }
    return (
      <label className="field" key={field.key}><span>{field.label}{field.required ? ' *' : ''}</span>
        <input type={field.type === 'number' ? 'number' : 'text'} min={field.type === 'number' ? '0' : undefined}
          inputMode={field.type === 'number' ? 'decimal' : undefined}
          value={getText(value)} placeholder={'Enter ' + field.label.toLowerCase()}
          onChange={event => fill(field.key, event.target.value)}/>
      </label>
    );
  }

  const editing = activeId !== undefined;
  return <div className="shell">
    <aside className={'sidebar ' + (menuOpen ? 'sidebar-open' : '')}>
      <div className="logo-row"><img src="/nimis-icon.svg" alt="NIMIS logo"/><div><strong>NIMIS</strong><small>FIELD COLLECTION</small></div></div>
      <div className="aside-label">FIELD OPERATIONS</div>
      <button className={'nav-button ' + (!editing ? 'selected' : '')} onClick={() => { setActiveId(undefined); setMenuOpen(false); }}>
        <ClipboardList size={19}/> Survey dashboard
      </button>
      <button className="nav-button" onClick={() => begin()}><FilePlus2 size={19}/> New survey</button>
      <div className="aside-spacer"/>
      <div className="side-status"><CloudOff size={18}/><span>Local-only development build<br/><small>Server sync not connected</small></span></div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button type="button" className="menu-button" aria-label="Open menu" onClick={() => setMenuOpen(!menuOpen)}><Menu/></button>
        <span className="eyebrow">MINISTRY OF AGRICULTURE · DEPARTMENT OF IRRIGATION</span>
        <span className={'network ' + (online ? 'connected' : '')}>{online ? <Wifi size={16}/> : <WifiOff size={16}/>} {online ? 'Network available' : 'Offline'}</span>
      </header>
      <div className="content">
        {notice && <div role="status" className="notice"><span>{notice}</span><button aria-label="Dismiss" onClick={() => setNotice('')}><X size={16}/></button></div>}
        {!editing ? <>
          <div className="heading-row"><div><div className="overline">NIMIS / FIELD OPERATIONS</div><h1>Survey dashboard</h1><p>Capture reliable irrigation scheme information across Zimbabwe.</p></div>
          <button className="primary" onClick={() => begin()}><FilePlus2 size={18}/> New survey</button></div>
          <div className="metrics">
            <div className="metric"><span>Surveys saved</span><strong>{drafts.length}</strong><small>On this device</small></div>
            <div className="metric"><span>Pending synchronization</span><strong>{outboxCount}</strong><small>Awaiting secure integration</small></div>
            <div className="metric"><span>Questionnaire fields</span><strong>{allFields.length}</strong><small>Across {sections.length} sections</small></div>
          </div>
          <div className="panel">
            <div className="panel-title"><div><h2>Field survey records</h2><p>Tap a survey to resume collection</p></div><button className="secondary" onClick={() => void exportDrafts()}><Download size={16}/> Export backup</button></div>
            {drafts.length === 0 ? <div className="empty"><Droplets size={42}/><h3>No surveys yet</h3><p>Your saved irrigation scheme surveys will appear here.</p><button className="primary" onClick={() => begin()}>Create first survey</button></div> :
              <div className="record-list">{drafts.map(draft => <button className="record" key={draft.id} onClick={() => begin(draft)}>
                <div className="record-icon"><ClipboardList size={21}/></div><div className="record-details"><strong>{getText(draft.answers.scheme_name) || 'Unnamed scheme'}</strong>
                <span>{getText(draft.answers.province) || 'Province not set'} · {getText(draft.answers.district) || 'District not set'}</span></div>
                <span className="record-meta">Revision {draft.revision}<small>Local draft</small></span><ArrowRight size={18}/></button>)}</div>}
          </div>
        </> : <>
          <div className="heading-row"><div><div className="overline">IRRIGATION SCHEME QUESTIONNAIRE</div>
            <h1>{activeId ? 'Edit survey' : 'New irrigation survey'}</h1>
            <p>Save as a draft whenever you need to. GPS and photos are kept on this device.</p></div>
            <button className="secondary" onClick={() => setActiveId(undefined)}><ArrowLeft size={17}/> Dashboard</button></div>
          <div className="survey-layout"><nav className="step-nav" aria-label="Survey sections">
            {sections.map((item,index) => <button className={index === step ? 'active' : ''} key={item.name} onClick={() => setStep(index)}>
              <span className="step-number">{index + 1}</span><span>{item.name}</span>{index < step && <Check size={15}/>}</button>)}
          </nav><div className="panel survey-panel">
            <div className="form-header"><div><span className="overline">SECTION {step+1} OF {sections.length}</span>
              <h2>{section.name}</h2><p>{section.fields.length} fields in this section</p></div>
              <span className="progress-text">{completed}/{allFields.length} captured</span></div>
            <div className="progress"><div style={{width: ((completed / allFields.length)*100) + '%'}}/></div>
            <div className="form-grid">{section.fields.map(fieldUI)}</div>
            <div className="form-footer"><button className="secondary" disabled={step === 0} onClick={() => setStep(s => s-1)}><ArrowLeft size={16}/> Back</button>
              <div className="footer-right"><button className="secondary" disabled={busy} onClick={() => void save()}><Save size={16}/> Save draft</button>
                {step < sections.length - 1 ? <button className="primary" onClick={() => setStep(s => s+1)}>Next section <ArrowRight size={16}/></button> :
                  <button className="primary" disabled={busy} onClick={() => void save()}>Finish & save <Check size={16}/></button>}
              </div></div>
          </div></div>
        </>}
        <footer className="footer">NIMIS Field Collection · Development build · Not connected to the official scheme registry</footer>
      </div>
    </main>
  </div>;
}
