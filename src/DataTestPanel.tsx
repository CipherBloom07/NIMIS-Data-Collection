import { useState } from 'react';
import { CheckCircle2, Database, FlaskConical, RotateCcw, ShieldAlert, XCircle } from 'lucide-react';
import { clearTestData, demoCases, readTestData, runDataChecks, storeTestData, type DemoResult } from './demo-data-test';

export default function DataTestPanel() {
  const [results, setResults] = useState<DemoResult[] | null>(null);
  const [stored, setStored] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function test() {
    setBusy(true);
    setMessage('');
    try {
      const checks = runDataChecks();
      setResults(checks);
      await storeTestData();
      const rows = await readTestData();
      if (rows.length !== demoCases.length || rows.some(row => !demoCases.some(f => f.id === row.id))) {
        throw new Error('Sandbox storage readback did not match fictional records.');
      }
      setStored(rows.length);
      setMessage('Fictional records saved and read back from isolated offline browser storage.');
    } catch (error) {
      setStored(null);
      setMessage('Data test failure: ' + String(error));
    } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true);
    try {
      const rows = await readTestData();
      setStored(rows.length);
      setMessage(rows.length === demoCases.length ? 'Sandbox records survived reload and can be read offline.' :
        'Sandbox record count differs from the fixture. Run data test to restore sample records.');
    } catch (error) { setMessage('Readback failed: ' + String(error)); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);
    try { await clearTestData(); setStored(0); setResults(null); setMessage('Only fictional sandbox records were cleared. Real draft storage was not changed.'); }
    catch (error) { setMessage('Clearing sandbox failed: ' + String(error)); }
    finally { setBusy(false); }
  }
  return <section className="data-test-page">
    <div className="heading-row"><div><div className="overline">NIMIS / DEVELOPMENT TESTING</div>
      <h1>Fictional data test</h1>
      <p>Test field validation and offline browser storage safely with fabricated irrigation schemes.</p></div></div>
    <div className="panel">
      <div className="panel-title"><div><h2>Data integrity sandbox</h2>
        <p>Three example records are separate from field surveys and the synchronization outbox.</p></div><FlaskConical size={25}/></div>
      <div className="data-test-content">
        <p className="data-test-warning"><ShieldAlert size={20}/>
          DEVELOPMENT ONLY — no real scheme names, no real photographs, no government records and no API uploads.
          This test does not prove encrypted storage, live sync or device enrolment.</p>
        <div className="data-test-actions">
          <button type="button" className="primary" onClick={() => void test()} disabled={busy}>
            <FlaskConical size={17}/> Run sample data test</button>
          <button type="button" className="secondary" onClick={() => void verify()} disabled={busy}>
            <Database size={17}/> Verify saved data</button>
          <button type="button" className="secondary" onClick={() => void clear()} disabled={busy}>
            <RotateCcw size={17}/> Clear test data</button>
        </div>
        <p role="status" className="data-test-message">{message || 'Press Run sample data test to begin.'}</p>
        <div className="data-test-summary">
          <div><span>Fictional cases</span><strong>{demoCases.length}</strong></div>
          <div><span>Validation checks passing</span><strong>{results?.filter(r => r.passed).length ?? '—'}{results ? ' / ' + results.length : ''}</strong></div>
          <div><span>Saved in isolated IndexedDB</span><strong>{stored === null ? 'Not checked' : stored}</strong></div>
        </div>
        <div className="data-test-list">
          {(results ?? demoCases.map(item => ({ ...item, actualErrors: 0, actualWarnings: 0, passed: false, details: [] }))).map(item => (
            <article className="data-test-row" key={item.id}>
              {results ? (item.passed ? <CheckCircle2 size={21} color="#087d47"/> : <XCircle size={21} color="#b43a35"/>) : <FlaskConical size={21}/>}
              <div><strong>{item.label}</strong>
                <span>{results ? (item.passed ? 'PASS' : 'FAIL') + ' — ' : 'Expected — '}
                  {results ? item.actualErrors : item.expectedErrors} errors;
                  {results ? item.actualWarnings : item.expectedWarnings} warnings</span>
                {item.details.length > 0 && <ul>{item.details.map((entry, i) => <li key={i}>{entry}</li>)}</ul>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  </section>;
}
