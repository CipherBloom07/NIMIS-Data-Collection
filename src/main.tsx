import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import MobileCollector from './MobileCollector';
import {completeInstitutionalSignIn} from './oidc-session';

function mount(){
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>{new URLSearchParams(location.search).has('legacy')?<App/>:<MobileCollector/>}</React.StrictMode>
  );
}
const query=new URLSearchParams(location.search);
if(import.meta.env.VITE_NIMIS_AUTH_MODE==='oidc' &&
   (query.has('code')||query.has('error'))){
  void completeInstitutionalSignIn().catch(()=>{
    // The sign-in UI can be retried. Do not display credentials or tokens.
  }).finally(mount);
}else mount();

if('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load',()=>{
    void navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}
