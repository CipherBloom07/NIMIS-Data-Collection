/** Standards-based OIDC Authorization Code + PKCE for a public field client.
 * Provider issuer/client ID and exact callback URI must be registered by ICT.
 * Access tokens only exist in module memory; the temporary PKCE verifier and
 * random state are removed immediately after callback or on expiry.
 */
import {bindInstitutionalAccessToken} from './institutional-auth';

const TEMP_KEY='nimis_oidc_pkce_pending_v1';
type Provider={issuer:string;authorization_endpoint:string;token_endpoint:string};
type Pending={state:string;nonce:string;verifier:string;redirect:string;issuer:string;created:number};
let signedInUntil=0;
const issuerConfigured=()=>String(import.meta.env.VITE_NIMIS_OIDC_ISSUER??'').replace(/\/$/,'');
const clientId=()=>String(import.meta.env.VITE_NIMIS_OIDC_CLIENT_ID??'').trim();
function assertProviderConfig(){
  const issuer=issuerConfigured();
  if(import.meta.env.VITE_NIMIS_AUTH_MODE!=='oidc'||!issuer||!clientId()) {
    throw new Error('Institutional identity configuration is incomplete');
  }
  const url=new URL(issuer);
  if(url.protocol!=='https:')throw new Error('Identity issuer must use HTTPS');
  if(location.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(location.hostname)){
    throw new Error('Institutional login requires a secure HTTPS application');
  }
  return issuer;
}
async function metadata():Promise<Provider>{
  const issuer=assertProviderConfig();
  const url=issuer+'/.well-known/openid-configuration';
  const response=await fetch(url,{cache:'no-store',credentials:'omit'});
  if(!response.ok)throw new Error('Institutional identity discovery unavailable');
  const value:unknown=await response.json();
  if(!value||typeof value!=='object')throw new Error('Invalid identity metadata');
  const doc=value as Record<string,unknown>;
  if(doc.issuer!==issuer||typeof doc.authorization_endpoint!=='string'||
     typeof doc.token_endpoint!=='string')throw new Error('Unexpected identity provider configuration');
  const base=new URL(issuer);
  for(const entry of [doc.authorization_endpoint,doc.token_endpoint]){
    const endpoint=new URL(entry as string);
    if(endpoint.protocol!=='https:'||endpoint.origin!==base.origin) {
      throw new Error('Identity endpoints must remain on the configured provider origin');
    }
  }
  return doc as Provider;
}
function randomUrlSafe(bytes=32):string{
  const array=crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(array).map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function challenge(verifier:string):Promise<string>{
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function redirectUri():string{
  // It must match the URI allowlisted in the official IdP registration.
  return String(import.meta.env.VITE_NIMIS_OIDC_REDIRECT_URI??location.origin+location.pathname);
}
export function institutionalSessionIsActive():boolean{
  return Boolean(signedInUntil>Date.now());
}
export function signOutInstitutionalSession():void{
  bindInstitutionalAccessToken(null);
  signedInUntil=0;
}
export async function startInstitutionalSignIn():Promise<void>{
  const provider=await metadata();
  const redirect=redirectUri();
  const uri=new URL(redirect);
  if(uri.origin!==location.origin)throw new Error('OIDC callback must use this app origin');
  const pending:Pending={
    state:randomUrlSafe(),nonce:randomUrlSafe(),verifier:randomUrlSafe(48),
    redirect,issuer:provider.issuer,created:Date.now(),
  };
  sessionStorage.setItem(TEMP_KEY,JSON.stringify(pending));
  const url=new URL(provider.authorization_endpoint);
  url.search=new URLSearchParams({
    client_id:clientId(),redirect_uri:redirect,response_type:'code',
    scope:'openid profile',state:pending.state,nonce:pending.nonce,
    code_challenge:await challenge(pending.verifier),code_challenge_method:'S256',
  }).toString();
  location.assign(url.toString());
}
export async function completeInstitutionalSignIn():Promise<boolean>{
  const query=new URLSearchParams(location.search);
  if(!query.has('state')&&!query.has('code')&&!query.has('error'))return false;
  // Remove authorization code from address bar immediately.
  history.replaceState(null,'',location.pathname+location.hash);
  const raw=sessionStorage.getItem(TEMP_KEY);
  sessionStorage.removeItem(TEMP_KEY);
  if(!raw)throw new Error('Institutional sign-in session was not initiated here');
  const state=JSON.parse(raw) as Pending;
  if(Date.now()-state.created>5*60*1000||Date.now()<state.created-30*1000||
     query.get('state')!==state.state||!state.verifier||
     state.issuer!==issuerConfigured()){
    throw new Error('Identity callback state mismatch or expired sign-in session');
  }
  if(query.has('error'))throw new Error('Institutional sign-in was not completed');
  const code=query.get('code');
  if(!code)throw new Error('Identity callback missing authorization code');
  const provider=await metadata();
  const response=await fetch(provider.token_endpoint,{
    method:'POST',cache:'no-store',credentials:'omit',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({
      grant_type:'authorization_code',client_id:clientId(),
      code,redirect_uri:state.redirect,code_verifier:state.verifier,
    }),
  });
  if(!response.ok)throw new Error('Institutional token exchange was unsuccessful');
  const body:unknown=await response.json();
  if(!body||typeof body!=='object')throw new Error('Invalid identity token response');
  const value=body as Record<string,unknown>;
  if(typeof value.token_type!=='string'||value.token_type.toLowerCase()!=='bearer'||
     typeof value.access_token!=='string'||typeof value.expires_in!=='number'||
     !Number.isFinite(value.expires_in)||value.expires_in<30){
    throw new Error('Identity provider did not issue a valid short-lived bearer token');
  }
  bindInstitutionalAccessToken(value.access_token);
  signedInUntil=Date.now()+(Number(value.expires_in)-15)*1000;
  return true;
}
