/** Institutional account token is owned by approved sign-in integration.
 * Never persist bearer tokens in IndexedDB, localStorage or source code.
 * This is not an OIDC login UI and does not authorize official deployment.
 */
let tokenInMemory:string|null=null;
export function bindInstitutionalAccessToken(token:string|null){
  if(token!==null && (!token.trim()||token.length>12000||token.split('.').length!==3)){
    throw new Error('Signed institutional access token required');
  }
  tokenInMemory=token;
}
export function collectorAuthorizationHeaders():Record<string,string>{
  if(import.meta.env.VITE_NIMIS_AUTH_MODE==='oidc'){
    if(!tokenInMemory)throw new Error('Institutional collector sign-in required');
    return {Authorization:'Bearer '+tokenInMemory};
  }
  if(!import.meta.env.DEV)throw new Error('Synthetic test identity disabled');
  return {'X-Nimis-Dev-Actor':'00000000-0000-4000-8000-000000000004'};
}
