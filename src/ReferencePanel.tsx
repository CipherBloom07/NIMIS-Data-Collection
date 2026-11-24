import { useState } from 'react';
import { ArrowRight, Database, LockKeyhole, RefreshCw, ShieldAlert } from 'lucide-react';
import { loadFictionalReferenceDemo, type ReferenceResponse } from './reference-client';

export default function ReferencePanel({ onStartSurvey }: { onStartSurvey: () => void }) {
  const [data, setData] = useState<ReferenceResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);

  async function connect() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await loadFictionalReferenceDemo();
      setData(response);
      setVisibleCount(30);
    } catch (failure) {
      setData(null);
      setError(failure instanceof Error ? failure.message : 'Unknown reference error');
    } finally {
      setLoading(false);
    }
  }

  return <section className="reference-page">
    <div className="heading-row">
      <div><div className="overline">NIMIS / ACCESS & REFERENCE</div>
      <h1>Assigned schemes and reference data</h1>
      <p>Phase 2 development service — official records are not connected.</p></div>
    </div>
    <div className="panel reference-panel">
      <div className="panel-title"><div><h2>Server-scoped reference demonstration</h2>
      <p>Shows the identity and schemes a reference backend allows an officer to see.</p></div>
      <LockKeyhole size={23}/></div>
      <div className="reference-body">
        <p className="reference-warning"><ShieldAlert size={18}/>
          This mode uses fictional development data only. It cannot enrol Ministry devices, grant real roles, or publish surveys.</p>
        {import.meta.env.DEV &&
          <button className="primary" type="button" disabled={loading} onClick={() => void connect()}>
            <RefreshCw size={17}/>{loading ? 'Connecting…' : 'Connect fictional local demo'}
          </button>}
        {!import.meta.env.DEV && <p>Demo access is disabled in production builds.</p>}
        {error && <p role="alert" className="reference-error">{error}</p>}
        {data && <>
          <div className="reference-details">
            <div><strong>Role</strong><span>{data.actor.role}</span></div>
            <div><strong>District scope</strong><span>{data.actor.district_ids.join(', ') || 'None'}</span></div>
            <div><strong>Visible schemes</strong><span>{data.schemes.length}</span></div>
            <div><strong>Proposed form definitions</strong><span>{data.formCount}</span></div>
            <div><strong>Reference database</strong><span>{data.referenceStorage === 'postgresql_demo' ? 'PostgreSQL (fictional)' : 'In-memory demo'}</span></div>
          </div>
          <h3>Assigned scheme records</h3>
          {data.schemes.length === 0 && <p>No schemes assigned to this account.</p>}
          {data.schemes.slice(0, visibleCount).map(scheme => <div className="reference-record" key={scheme.scheme_id}>
            <Database size={20}/><div><strong>{scheme.name}</strong>
            <p>{scheme.scheme_id} · {scheme.district_code} · Master version {scheme.master_version}</p></div>
            {scheme.is_fictional && <span className="fictional-label">FICTIONAL</span>}
          </div>)}
          {data.schemes.length > visibleCount && <button type="button" className="secondary" onClick={() => setVisibleCount(count => count + 30)}>Show more schemes ({visibleCount} of {data.schemes.length})</button>}
          <p className="reference-footnote">Reference catalogue revision: {data.reference.revision}. Form catalogue: {data.formStatus}. No submissions were sent.</p>
          <div className="reference-handoff"><div><strong>Next: collect field information</strong><p>Continue to the baseline form. Demo schemes are not automatically linked to a permanent scheme ID.</p></div><button type="button" className="primary" onClick={onStartSurvey}>Continue to survey <ArrowRight size={16}/></button></div>
        </>}
      </div>
    </div>
  </section>;
}
