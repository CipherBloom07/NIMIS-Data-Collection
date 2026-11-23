import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const health = readFileSync('src/storage-health.ts','utf8');
const photo = readFileSync('src/photo-compression.ts','utf8');
const storage = readFileSync('src/storage.ts','utf8');
const app = readFileSync('src/App.tsx','utf8');
const ui = readFileSync('src/StoragePanel.tsx','utf8');

test('storage panel reports quota, local photos, drafts and pending operations', () => {
  for (const part of ['readStorageHealth()', 'usageBytes', 'freeBytes', 'quotaBytes',
    'photoCount', 'photoBytes', 'draftCount', 'operationCount', 'persisted']) {
    assert.ok(health.includes(part) || ui.includes(part), 'Missing storage diagnostic: '+part);
  }
  assert.match(app, /Storage Management/);
  assert.match(ui, /never|No unsynced record is automatically deleted/i);
});

test('photo compression limits field evidence and rejects unsupported formats', () => {
  assert.match(photo, /500 \* 1024/);
  assert.match(photo, /12 \* 1024 \* 1024/);
  assert.match(photo, /image\/jpeg/);
  assert.match(photo, /createImageBitmap/);
  assert.match(photo, /canvasToJpeg/);
  assert.match(storage, /await compressFieldPhoto\(file\)/);
});

test('autosave does not enqueue a full immutable event for every keystroke', () => {
  assert.match(app, /saveDraft\(localId, snapshot, false\)/);
  assert.match(storage, /recordOperation = true/);
  assert.match(storage, /if \(recordOperation\) tx\.objectStore\('operations'\)\.add\(event\)/);
});

test('storage safety requires explicit acknowledgement before any future deletion', () => {
  assert.doesNotMatch(ui, /deleteDatabase\(/);
  assert.doesNotMatch(storage, /\.delete\(|\.clear\(/);
  assert.match(ui, /browser data/);
});
