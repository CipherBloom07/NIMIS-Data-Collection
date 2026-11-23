import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, HardDrive, Image, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { formatBytes, readStorageHealth, requestPersistentStorage, type StorageHealth } from './storage-health';

export default function StoragePanel() {
  const [health, setHealth] = useState<StorageHealth | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function refresh() {
    setBusy(true);
    setMessage('');
    try { setHealth(await readStorageHealth()); }
    catch (error) { setMessage('Storage inspection failed: ' + String(error)); }
    finally { setBusy(false); }
  }
  useEffect(() => { void refresh(); }, []);
  async function persist() {
    setBusy(true);
    setMessage('');
    try {
      const granted = await requestPersistentStorage();
      setMessage(granted ? 'Browser granted persistent storage for this site.' :
        'Persistent storage was not granted. Continue backing up your work and avoid clearing browser data.');
      setHealth(await readStorageHealth());
    } catch (error) { setMessage('Persistence request unavailable: ' + String(error)); }
    finally { setBusy(false); }
  }
  const severity = health?.risk ?? 'unknown';
  const riskLabel = severity === 'critical' ? 'Storage critically low' :
    severity === 'warning' ? 'Storage getting low' :
    severity === 'healthy' ? 'Available space looks adequate' : 'Storage capacity unavailable';
  const usedPercent = health?.usageRatio !== null && health?.usageRatio !== undefined ?
    Math.round(health.usageRatio * 100) : null;
  return <section className="storage-page" aria-labelledby="storage-heading">
    <div className="heading-row">
      <div><div className="overline">NIMIS / DEVICE CARE</div><h1 id="storage-heading">Storage Management</h1>
        <p>Know how much local survey information and photo evidence is saved on this device.</p></div>
      <button className="secondary" type="button" onClick={() => void refresh()} disabled={busy}>
        <RefreshCw size={17}/>{busy ? 'Checking…' : 'Check storage'}
      </button>
    </div>
    <div className={'storage-risk storage-risk-' + severity} role="status">
      {severity === 'healthy' ? <CheckCircle2 size={23}/> : <AlertTriangle size={23}/>}
      <div><strong>{riskLabel}</strong><p>{severity === 'critical'
        ? 'Saving more photos may fail. Preserve existing records, avoid clearing the browser, and arrange backup or secure synchronization.'
        : severity === 'warning'
          ? 'Keep an eye on available space. Do not capture more photographs than necessary.'
          : severity === 'healthy'
            ? 'Storage is currently below the configured warning thresholds, but availability can still change.'
            : 'This browser has not reported a reliable quota. Data is still saved locally, but capacity cannot be guaranteed.'}</p></div>
    </div>
    <div className="storage-metrics">
      <div className="storage-metric"><Database size={21}/><span>Local surveys</span><strong>{health?.draftCount ?? '—'}</strong></div>
      <div className="storage-metric"><Image size={21}/><span>Saved photographs</span><strong>{health?.photoCount ?? '—'}</strong><small>{formatBytes(health?.photoBytes ?? null)} total</small></div>
      <div className="storage-metric"><HardDrive size={21}/><span>Historical local operations</span><strong>{health?.operationCount ?? '—'}</strong><small>Not yet synchronized</small></div>
    </div>
    <div className="panel storage-panel">
      <div className="panel-title"><div><h2>Browser storage estimate</h2>
        <p>This is an approximate site quota, not your phone's total free space.</p></div><HardDrive size={24}/></div>
      <div className="storage-panel-body">
        <div className="storage-quota-values">
          <div><span>Estimated used by this site</span><strong>{formatBytes(health?.usageBytes ?? null)}</strong></div>
          <div><span>Estimated available quota</span><strong>{formatBytes(health?.freeBytes ?? null)}</strong></div>
          <div><span>Estimated total quota</span><strong>{formatBytes(health?.quotaBytes ?? null)}</strong></div>
        </div>
        {usedPercent !== null && <div className="storage-bar" role="progressbar" aria-label="Browser quota in use" aria-valuemin={0} aria-valuemax={100} aria-valuenow={usedPercent}>
          <div style={{width: usedPercent + '%'}}/></div>}
        <p className="storage-explain">Some browsers share this quota with other data from the same site. Estimates may be unavailable, change over time, or differ from physical disk space. A successful storage estimate is not a guarantee that future writes will succeed.</p>
        <div className="storage-persist">
          <div><strong><ShieldCheck size={18}/> Protection against automatic eviction</strong>
            <p>{health?.persisted === true ? 'Persistent storage was granted for this site.' :
              health?.persisted === false ? 'Persistent storage is not granted. You may request it here.' :
              'This browser has not provided its persistence status.'}</p></div>
          <button className="secondary" type="button" disabled={busy || health?.persisted === true || !health?.supported} onClick={() => void persist()}>
            <LockKeyhole size={16}/> Request protection
          </button>
        </div>
        {message && <p role="status" className="storage-message">{message}</p>}
      </div>
    </div>
    <div className="storage-safe-guide">
      <h2>Keep your collected records safe</h2>
      <p>New photographs are compressed to approximately 500 KB or less before being saved. Previously saved photographs remain unchanged.</p>
      <p><strong>Do not use Clear browsing data, uninstall the application, or reset this device</strong> while surveys or photographs are only stored here. Browser persistence is not encryption or a backup.</p>
      <p>Secure server synchronization, full photo-inclusive backup/restore, and automatic cleanup after server acknowledgement are not operational yet. No unsynced record is automatically deleted.</p>
    </div>
  </section>;
}
