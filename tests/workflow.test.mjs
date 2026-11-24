import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync('src/App.tsx','utf8');
const journey = readFileSync('src/WorkflowHome.tsx','utf8');
const help = readFileSync('src/HelpPanel.tsx','utf8');
const css = readFileSync('src/workflow.css','utf8');
const ref = readFileSync('src/ReferencePanel.tsx','utf8');

test('beginner journey uses a guided module flow without falsely implying live sync', () => {
  for (const phrase of ['Find your scheme', 'Collect information', 'Check and save', 'Officer verification', 'Send to NIMIS']) {
    assert.ok(journey.includes(phrase), phrase);
  }
  assert.match(journey, /Not available yet/);
  assert.match(journey, /Official assignments are not connected yet/);
});
test('editing a form safely persists before navigating between modules', () => {
  assert.match(app, /async function leaveForm/);
  assert.match(app, /await writeQueueRef\.current/);
  assert.match(app, /await saveDraft\(draftIdRef\.current \?\? activeId/);
  assert.match(app, /leaveForm\('dashboard'\)/);
  assert.match(app, /leaveForm\('schemes'\)/);
  assert.match(app, /leaveForm\('help'\)/);
});
test('form sections have understandable progress and help', () => {
  assert.match(app, /sectionCompleted/);
  assert.match(app, /role="progressbar"/);
  assert.match(app, /How to complete this section/);
  assert.match(help, /How to use NIMIS Collect/);
  assert.match(help, /Saving a draft is not the same as submitting/);
});
test('phones get single-column guidance and reference-to-form handoff', () => {
  assert.match(css, /grid-template-columns:1fr/);
  assert.match(ref, /onStartSurvey/);
  assert.match(ref, /Demo schemes are not automatically linked to a permanent scheme ID/);
});
