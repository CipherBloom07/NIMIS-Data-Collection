import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

test('official national emblem is bundled for offline use', () => {
  const jpg = readFileSync('public/zimbabwe-coat-of-arms.jpg');
  assert.ok(jpg.length > 1000);
  assert.equal(jpg[0], 0xff);
  assert.equal(jpg[1], 0xd8);
  assert.ok(statSync('public/zimbabwe-coat-of-arms.svg').size > 1000);
});

test('desktop and mobile headers use a resilient shared logo', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const logo = readFileSync('src/BrandLogo.tsx', 'utf8');
  assert.match(app, /<BrandLogo\/>/);
  assert.match(app, /<BrandLogo compact\/>/);
  assert.match(logo, /onError=/);
  assert.match(logo, /nimis-logo\.png/);
  assert.match(logo, /zimbabwe-coat-of-arms\.svg/);
  assert.match(logo, /import\.meta\.env\.BASE_URL/);
});

test('service worker upgrades the branding cache and keeps the logo fallback offline', () => {
  const sw = readFileSync('public/sw.js', 'utf8');
  assert.match(sw, /nimis-field-shell-v6-security/);
  assert.match(sw, /'\/nimis-logo\.png'/);
  assert.match(sw, /'\/zimbabwe-coat-of-arms\.svg'/);
});
