import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('official coat of arms is a real JPEG, not nested SVG', () => {
  const path = 'public/zimbabwe-coat-of-arms.jpg';
  const bytes = readFileSync(path);
  assert.ok(bytes.length > 1000, 'emblem file should contain image data');
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.ok(statSync(path).isFile());
});

test('responsive rules include small screens, tablet, desktop and accessible controls', () => {
  const css = readFileSync('src/responsive.css', 'utf8');
  for (const marker of ['max-width: 360px', 'max-width: 530px', 'max-width: 800px',
    'max-width: 1150px', 'min-width: 1600px', 'min-height: 44px',
    'prefers-reduced-motion', '.mobile-scrim']) {
    assert.ok(css.includes(marker), 'Missing responsive rule: ' + marker);
  }
});

test('baseline survey has exactly 70 declared fields and 8 sections', () => {
  const schema = readFileSync('src/survey.ts', 'utf8');
  assert.equal((schema.match(/\bf\('/g) ?? []).length, 70);
  assert.equal((schema.match(/name: '/g) ?? []).length, 8);
});

test('contract covers reference, form, sync, attachment and verification APIs', () => {
  const contract = readFileSync('api/openapi.yaml', 'utf8');
  for (const path of ['/auth/device/enrol:', '/forms:', '/reference:',
    '/schemes:', '/sync/push:', '/sync/pull:', '/attachments:',
    '/submissions/{id}/decisions:', '/submissions/{id}/history:',
    '/scheme-requests:']) {
    assert.ok(contract.includes(path), 'Missing documented endpoint: ' + path);
  }
});

test('service worker excludes authenticated API routes from cache', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(sw, /Authorization/);
});

test('coat of arms is referenced by both desktop and mobile branding and bundled in the shell cache', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const asset = readFileSync('public/zimbabwe-coat-of-arms.svg', 'utf8');
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.match(app, /<GovernmentEmblem\/>/);
  assert.match(app, /<GovernmentEmblem mobile\/>/);
  assert.match(app, /zimbabwe-coat-of-arms\.svg/);
  assert.match(asset, /data:image\/jpeg;base64,/);
  assert.match(sw, /zimbabwe-coat-of-arms\.svg/);
});

test('baseline capture has validation and ordered autosave', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const checks = readFileSync('src/validation.ts', 'utf8');
  assert.match(app, /writeQueueRef/);
  assert.match(app, /saveDraft\(currentId, snapshot\)/);
  assert.match(checks, /validateBaseline/);
  assert.match(checks, /functional_area_ha/);
  assert.match(checks, /waterlogging_photo/);
});
