const VERSION = "v1.0.0"; // غيّر هذا الرقم عند كل تحديث لملفاتك ليتجدد الكاش
const CACHE = "rafiq-" + VERSION;
const LOCAL = ["./", "index.html", "manifest.webmanifest", "storage.js", "check.html",
  "icon-192.png", "icon-512.png", "maskable-192.png", "maskable-512.png", "apple-touch-icon.png", "favicon-32.png"];
const REMOTE = ["https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600;700&display=swap"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(LOCAL.map(u => new Request(u, { cache: "reload" })));
    // ملفات خارجية: محاولة اختيارية لا تُفشل التثبيت
    await Promise.allSettled(REMOTE.map(async u => {
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 8000);
      try { const r = await fetch(u, { mode: "no-cors", signal: ctl.signal }); await c.put(u, r); } finally { clearTimeout(t); }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("rafiq-") && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!/^https?:$/.test(url.protocol)) return;
  const same = url.origin === self.location.origin;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req, { ignoreSearch: same });
    const net = fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
      return res;
    }).catch(() => null);
    if (hit) { e.waitUntil(net); return hit; }          // الكاش أولاً ثم تحديث بالخلفية
    const res = await net;
    if (res) return res;
    if (req.mode === "navigate") return (await c.match("index.html")) || (await c.match("./")) || Response.error();
    return Response.error();
  })());
});
