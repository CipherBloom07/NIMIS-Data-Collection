/* PUBLIC APP SHELL ONLY. Private survey/API/identity payloads never enter CacheStorage. */
const CACHE='nimis-field-shell-v6-security';
const PUBLIC_ASSETS=['/','/manifest.webmanifest','/nimis-logo.png',
  '/nimis-icon.svg','/zimbabwe-coat-of-arms.svg'];
function publicAsset(request){
  const url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||
    url.search||request.headers.has('Authorization')||
    request.headers.has('X-Nimis-Dev-Actor'))return false;
  if(request.mode==='navigate')return url.pathname==='/';
  return PUBLIC_ASSETS.includes(url.pathname)||
    /^\/assets\/[A-Za-z0-9_.-]+\.(?:js|css|svg|png|webp)$/.test(url.pathname);
}
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(key=>key.startsWith('nimis-field-shell-')&&key!==CACHE)
      .map(key=>caches.delete(key))
  )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(!publicAsset(request))return;
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
    if(response.ok&&response.type==='basic'&&
      !response.headers.has('Set-Cookie')&&
      !/private|no-store/i.test(response.headers.get('Cache-Control')||'')){
      const copy=response.clone();
      event.waitUntil(caches.open(CACHE).then(cache=>cache.put(request,copy)));
    }
    return response;
  }).catch(()=>caches.match(request)));
});
