import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('official coat of arms PNG is a real PNG, not a malformed JPEG', () => {
  const path = 'public/nimis-logo.png';
  const bytes = readFileSync(path);
  assert.ok(bytes.length > 10000, 'emblem file should contain image data');
  assert.deepEqual([...bytes.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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
