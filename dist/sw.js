const CACHE="ic28-muufhh0i";
const ASSETS=['./','./index.html','./app.js','./styles.css','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./assets/choice/netflix_2x.webp','./assets/choice/whitebear_2x.webp','./assets/choice/pacs_2x_update.webp'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(resp=>{const copy=resp.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return resp;}).catch(()=>caches.match('./index.html'))));});
