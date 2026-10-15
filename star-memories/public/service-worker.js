const CACHE='xingji-local-app-__BUILD_REVISION__';
const SHELL=['/','/offline-assets.json','/manifest.webmanifest','/favicon.svg','/icons/icon-192.png','/icons/icon-512.png','/icons/icon-maskable.png','/icons/apple-touch-icon.png','/images/deep-space-panorama.png'];
function assetPaths(inventory){
  if(!inventory||!Array.isArray(inventory.assets)||!inventory.assets.length)throw new Error('Missing app assets');
  return inventory.assets.map(value=>{const url=new URL(value,self.location.origin);if(url.origin!==self.location.origin||!/^\/(assets\/|_next\/static\/)/.test(url.pathname)||!/^.*\.(js|css)$/.test(url.pathname))throw new Error('Invalid app asset');return url.href});
}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const response=await fetch('/offline-assets.json',{cache:'no-store'});if(!response.ok)throw new Error('Missing app inventory');const paths=assetPaths(await response.json());const cache=await caches.open(CACHE);await cache.addAll([...SHELL,...paths]);await self.skipWaiting()})())});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('xingji-local-app-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('message',event=>{
  if(event.data?.type!=='CHECK_OFFLINE_READY')return;
  event.waitUntil((async()=>{const cache=await caches.open(CACHE),inventory=await cache.match('/offline-assets.json');if(!inventory)throw new Error('Missing cached inventory');const paths=[...SHELL,...assetPaths(await inventory.json())];for(const path of paths)if(!await cache.match(path))throw new Error('Offline asset missing');event.source?.postMessage({type:'OFFLINE_READY'})})().catch(()=>{/* Never claim offline readiness for an incomplete app cache. */}));
});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  // Never cache old account APIs, remote memories, or private photo responses.
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  if(request.mode==='navigate'){
    // Each build precaches its HTML and every JS/CSS chunk together. An updated
    // worker activates only after that complete shell is ready, so cached HTML
    // can never point to a new release's missing JavaScript while offline.
    event.respondWith(caches.open(CACHE).then(async cache=>await cache.match('/')||fetch(request)));return;
  }
  if(SHELL.includes(url.pathname)||/^\/(assets\/|_next\/static\/)/.test(url.pathname)){
    event.respondWith((async()=>{const cache=await caches.open(CACHE),saved=await cache.match(request);if(saved)return saved;const response=await fetch(request);if(response.ok)await cache.put(request,response.clone());return response})());
  }
});
