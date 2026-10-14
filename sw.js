const VERSION = 'v1'; // غيّر الرقم عند كل تحديث لتتجدد الملفات المخزّنة
const CACHE = 'rafiq-' + VERSION;
const CORE = [
  './', './index.html', './manifest.webmanifest', './storage.js', './check.html',
  './icon-192.png', './icon-512.png', './maskable-192.png', './maskable-512.png',
  './apple-touch-icon.png', './favicon-32.png'
];
// موارد خارجية يستخدمها التطبيق (تُخزَّن إن توفّر الإنترنت وقت التثبيت، وإلا تُخزَّن عند أول استخدام)
const EXTRA = [
  'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    await Promise.all(EXTRA.map(u => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('rafiq-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  const same = url.origin === self.location.origin;

  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: same, ignoreVary: true });
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === 'opaque') && req.headers.get('range') === null) {
        c.put(req, res.clone()).catch(() => {});
      }
      return res;
    });
    if (hit) { net.catch(() => {}); return hit; }          // من الذاكرة فورًا، وتحديث بالخلفية
    try { return await net; }
    catch (err) {
      if (req.mode === 'navigate') {
        const home = await c.match('./index.html');
        if (home) return home;
      }
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
