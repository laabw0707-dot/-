const VERSION='rafiq-v1';
const CACHE=VERSION;
const CORE=['./','./index.html','./manifest.webmanifest','./storage.js','./check.html','./icon-192.png','./icon-512.png','./maskable-192.png','./maskable-512.png','./apple-touch-icon.png','./favicon-32.png'];
const EXTRA=['https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(CACHE);
    await c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})));
    // best-effort: fonts + pdf.js (opaque, failures ignored)
    await Promise.all(EXTRA.map(u=>fetch(new Request(u,{mode:'no-cors'})).then(r=>c.put(u,r)).catch(()=>{})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    for(const k of await caches.keys()) if(k!==CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.protocol!=='http:'&&url.protocol!=='https:') return;
  if(req.headers.has('range')) return;
  const same=url.origin===self.location.origin;

  // Pages: serve from cache instantly, refresh in background; offline fallback = index.html
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const hit=await c.match(req,{ignoreSearch:true});
      const net=fetch(req).then(r=>{if(r&&r.ok&&same)c.put(req,r.clone()).catch(()=>{});return r}).catch(()=>null);
      if(hit){e.waitUntil(net);return hit}
      return (await net)||(await c.match('./index.html'))||new Response('offline',{status:503});
    })());
    return;
  }

  // Same-origin files: stale-while-revalidate
  if(same){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      const hit=await c.match(req,{ignoreSearch:true});
      const net=fetch(req).then(r=>{if(r&&r.ok)c.put(req,r.clone()).catch(()=>{});return r}).catch(()=>null);
      if(hit){e.waitUntil(net);return hit}
      return (await net)||new Response('',{status:504});
    })());
    return;
  }

  // Cross-origin (Google Fonts, pdf.js CDN): cache-first, store on first fetch
  e.respondWith((async()=>{
    const c=await caches.open(CACHE);
    const hit=await c.match(req);
    if(hit) return hit;
    try{
      const r=await fetch(req);
      if(r&&(r.ok||r.type==='opaque')) c.put(req,r.clone()).catch(()=>{});
      return r;
    }catch(err){return new Response('',{status:504})}
  })());
});
