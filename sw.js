// Idre Julen 2026 – offline support. Version 928628adaa
const CACHE='idre26-928628adaa';
const CORE=["./", "index.html", "manifest.webmanifest", "data.json", "pistmap.jpg", "winter.jpg", "icons/icon-192.png", "icons/apple-touch-icon.png", "house/t_r01.jpg", "house/t_r02.jpg", "house/t_r03.jpg", "house/t_r04.jpg", "house/t_r05.jpg", "house/t_r06.jpg", "house/t_r07.jpg", "house/t_r08.jpg", "house/t_r09.jpg", "house/t_r10.jpg", "house/t_r11.jpg", "house/t_r12.jpg", "house/t_r13.jpg", "house/t_r14.jpg", "house/t_r15.jpg", "house/t_r16.jpg", "house/t_r17.jpg", "house/t_r18.jpg", "house/t_r19.jpg", "house/t_r20.jpg", "house/t_r21.jpg", "house/t_r22.jpg", "house/t_r23.jpg", "house/t_r24.jpg", "house/t_r25.jpg", "house/t_r26.jpg", "house/t_u1.jpg", "house/t_u2.jpg", "house/t_u3.jpg", "house/r02.jpg"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(/^\/api\/photos\/(img|th)\//.test(url.pathname)){ // albumbilder ändras aldrig: spara för offline
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));}return r;})));
    return;
  }
  if(url.pathname.startsWith('/api/'))return; // listor och album: alltid direkt mot servern
  const isPage=req.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/data.json')||url.hostname==='api.open-meteo.com';
  if(isPage){ // network first, fall back to cache when offline
    e.respondWith(fetch(req).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));return r;}).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));
    return;
  }
  // everything else (images, fonts, three.js): cache first, then network, and keep a copy
  e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque')){const c=r.clone();caches.open(CACHE).then(x=>x.put(req,c));}return r;})));
});
