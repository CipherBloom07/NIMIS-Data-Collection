import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const auth=readFileSync('src/institutional-auth.ts','utf8');
const forms=readFileSync('src/form-stage-sync.ts','utf8');
const core=readFileSync('src/core-stage-sync.ts','utf8');
test('institutional access token is kept only in memory and never serialized',()=>{
  assert.match(auth,/let tokenInMemory:string\|null=null/);
  assert.match(auth,/VITE_NIMIS_AUTH_MODE==='oidc'/);
  assert.match(auth,/Institutional collector session expired/);
  assert.doesNotMatch(auth,/\b(?:localStorage|sessionStorage|indexedDB)\s*\.|console\.log\s*\(/);
});
test('all collector stage API clients reuse the same signed session',()=>{
  assert.match(forms,/collectorAuthorizationHeaders\(\)/);
  assert.match(core,/collectorAuthorizationHeaders\(\)/);
  assert.doesNotMatch(forms,/X-Nimis-Dev-Actor/);
  assert.doesNotMatch(core,/X-Nimis-Dev-Actor/);
});
