/** Short-lived institution-issued access token is memory-only and never stored. */
let tokenInMemory:string|null=null;
let expiresAt=0;
export function bindInstitutionalAccessToken(token:string|null,expiresInSeconds?:number){
  if(token!==null && (!token.trim()||token.length>12000||token.split('.').length!==3)){
    throw new Error('Signed institutional access token required');
  }
  if(token!==null && (!Number.isFinite(expiresInSeconds)||
    Number(expiresInSeconds)<=15||Number(expiresInSeconds)>86400)){
    throw new Error('Short-lived access token expiry is required');
  }
  tokenInMemory=token;
  expiresAt=token===null?0:Date.now()+(Number(expiresInSeconds)-15)*1000;
}
export function institutionalAccessTokenIsActive():boolean{
  if(!tokenInMemory)return false;
  if(Date.now()>=expiresAt){
    tokenInMemory=null;expiresAt=0;return false;
  }
  return true;
}
export function collectorAuthorizationHeaders():Record<string,string>{
  if(import.meta.env.VITE_NIMIS_AUTH_MODE==='oidc'){
    if(!institutionalAccessTokenIsActive())throw new Error('Institutional collector session expired; sign in again');
    return {Authorization:'Bearer '+tokenInMemory};
  }
  if(!import.meta.env.DEV)throw new Error('Synthetic test identity disabled');
  return {'X-Nimis-Dev-Actor':'00000000-0000-4000-8000-000000000004'};
}
