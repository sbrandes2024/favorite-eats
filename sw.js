const C='fe-v3',A=['./','index.html','app.js','manifest.json','icon.svg','icon-192.png','icon-512.png','qrcode.min.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x))))));
self.addEventListener('fetch',e=>{const u=e.request.url;if(e.request.method!=='GET'||u.includes('overpass'))return;
 e.respondWith(fetch(e.request).then(r=>{if(r.ok&&!u.includes('tile.openstreetmap')){const cl=r.clone();caches.open(C).then(c=>c.put(e.request,cl))}return r}).catch(()=>caches.match(e.request)))});
