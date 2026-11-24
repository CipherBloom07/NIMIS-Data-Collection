import { useState } from 'react';
import { Send, ShieldCheck, RefreshCw } from 'lucide-react';

/** Intentional fictional-only demonstration: never sends saved officer surveys. */
const OUTBOX_KEY = 'nimis-fictitious-demo-event-id';
export default function DemoIntegrationPanel() {
  const [note, setNote] = useState('Fictional demonstration: canal condition checked');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function send() {
    setBusy(true);
    setMessage('');
    try {
      // Reuse event ID on retries; keep it if network fails. Never send a real draft.
      let eventId = localStorage.getItem(OUTBOX_KEY);
      if (!eventId) {
        eventId = crypto.randomUUID();
        localStorage.setItem(OUTBOX_KEY, eventId);
      }
      const tokenResponse = await fetch('/api/v1/dev/token', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'officer.demo' }),
      });
      if (!tokenResponse.ok) throw new Error('Start the PostgreSQL fictional backend first.');
      const { access_token } = (await tokenResponse.json()) as { access_token: string };
      const response = await fetch('/api/v1/dev/integration/submit', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + access_token },
        body: JSON.stringify({
          event_id: eventId, scheme_id: 'DEMO-SCHEME-001',
          form_id: 'scheme_baseline', note: note.trim(),
        }),
      });
      if (!response.ok) {
        const details = await response.json().catch(() => ({})) as { detail?: string };
        throw new Error(details.detail || 'Server rejected the fictional submission (HTTP ' + response.status + ')');
      }
      const result = await response.json() as { outcome: string; event_id: string };
      // Only release the event ID after the server acknowledged it.
      localStorage.removeItem(OUTBOX_KEY);
      setMessage('Server ' + result.outcome + ' fictional event ' + result.event_id +
        '. Check the District Officer inbox in the main NIMIS development app.');
    } catch (error) {
      setMessage('Not acknowledged; fictional event remains pending for retry. ' + String(error));
    } finally { setBusy(false); }
  }
  return <section className="panel" style={{ padding: 24 }}>
    <div className="overline">LOCAL INTEGRATION LAB / NO REAL DATA</div>
    <h1>Collector → District Officer test</h1>
    <p>This sends only a fabricated irrigation scheme test record to your local PostgreSQL demonstration. It does not upload your offline surveys, photographs or GPS coordinates.</p>
    <p><strong>Assigned scheme:</strong> DEMO-SCHEME-001 — Example Scheme (fictional)</p>
    <label className="field"><span>Fictional observation (200 characters maximum)</span>
      <input maxLength={200} value={note} onChange={event => setNote(event.target.value)}
        placeholder="Enter a fictional test observation" /></label>
    <button className="primary" disabled={busy || !note.trim()}
      onClick={() => void send()}>{busy ? <RefreshCw size={17}/> : <Send size={17}/>}
      {busy ? 'Sending test…' : 'Send fictional test submission'}</button>
    <p style={{ marginTop: 16, fontSize: 12 }}><ShieldCheck size={15}/> Only the local fictional database is used. The official national synchronization and approval workflows remain disabled.</p>
    {message && <div className="notice" role="status">{message}</div>}
  </section>;
}
