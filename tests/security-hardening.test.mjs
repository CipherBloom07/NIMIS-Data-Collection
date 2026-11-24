import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const sw=readFileSync('public/sw.js','utf8');
const session=readFileSync('src/oidc-session.ts','utf8');
const auth=readFileSync('src/institutional-auth.ts','utf8');

test('private Collector data and OAuth callback are excluded from caches',()=>{
  assert.match(sw,/url\.search/);
  assert.match(sw,/Authorization/);
  assert.match(sw,/X-Nimis-Dev-Actor/);
  assert.match(sw,/PUBLIC_ASSETS/);
  assert.match(sw,/request\.mode==='navigate'/);
  assert.match(sw,/url\.pathname==='\/'/);
  assert.doesNotMatch(sw,/cache\.put\(event\.request, copy\)/);
});

test('bearer tokens cannot outlive institutional session expiry',()=>{
  assert.match(auth,/expiresAt/);
  assert.match(auth,/institutionalAccessTokenIsActive/);
  assert.match(auth,/Date\.now\(\)>=expiresAt/);
  assert.match(auth,/Institutional collector session expired/);
  assert.match(session,/bindInstitutionalAccessToken\(value\.access_token,value\.expires_in\)/);
  assert.match(session,/institutionalAccessTokenIsActive\(\)/);
  assert.match(session,/sessionStorage\.removeItem\(TEMP_KEY\)/);
});
