/* تخزين دائم + نسخة احتياطية من localStorage داخل IndexedDB مع استعادة تلقائية */
(function () {
  'use strict';
  var DB = 'rafiq-backup', ST = 'kv', KEY = 'localStorage';
  var ready = false, timer = null;

  // 1) طلب تخزين دائم
  try {
    if (navigator.storage && navigator.storage.persist) {
      navigator.storage.persisted().then(function (p) { return p || navigator.storage.persist(); }).catch(function () {});
    }
  } catch (e) {}

  function open() {
    return new Promise(function (ok, no) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
  }
  function snap() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); o[k] = localStorage.getItem(k); }
    return o;
  }
  function put(data) {
    return open().then(function (db) {
      return new Promise(function (ok, no) {
        var t = db.transaction(ST, 'readwrite');
        t.objectStore(ST).put({ data: data, ts: Date.now() }, KEY);
        t.oncomplete = function () { db.close(); ok(); };
        t.onerror = t.onabort = function () { db.close(); no(t.error); };
      });
    });
  }
  function get() {
    return open().then(function (db) {
      return new Promise(function (ok, no) {
        var q = db.transaction(ST, 'readonly').objectStore(ST).get(KEY);
        q.onsuccess = function () { db.close(); ok(q.result); };
        q.onerror = function () { db.close(); no(q.error); };
      });
    });
  }
  function backup() {
    if (!ready) return;
    try { put(snap()).catch(function () {}); } catch (e) {}
  }
  function schedule() {
    if (!ready) return;
    clearTimeout(timer); timer = setTimeout(backup, 800);
  }

  // 2) نسخ تلقائي عند كل تغيير في localStorage
  try {
    var P = Storage.prototype, s = P.setItem, r = P.removeItem, c = P.clear;
    P.setItem = function () { var v = s.apply(this, arguments); if (this === localStorage) schedule(); return v; };
    P.removeItem = function () { var v = r.apply(this, arguments); if (this === localStorage) schedule(); return v; };
    P.clear = function () { var v = c.apply(this, arguments); if (this === localStorage) schedule(); return v; };
  } catch (e) {}
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { clearTimeout(timer); backup(); } });
  window.addEventListener('pagehide', function () { clearTimeout(timer); backup(); });
  setInterval(backup, 30000);

  // 3) استعادة إن كانت بيانات التطبيق مفقودة
  var lost = false;
  try { lost = localStorage.getItem('mc') === null; } catch (e) {}
  if (!window.indexedDB) { ready = false; return; }
  get().then(function (rec) {
    var already = false;
    try { already = sessionStorage.getItem('rafiq-restored') === '1'; } catch (e) {}
    if (lost && rec && rec.data && rec.data.mc && !already) {
      try { sessionStorage.setItem('rafiq-restored', '1'); } catch (e) {}
      Object.keys(rec.data).forEach(function (k) { try { localStorage.setItem(k, rec.data[k]); } catch (e) {} });
      location.reload();           // إعادة التحميل ليقرأ التطبيق البيانات المستعادة
      return;
    }
    ready = true; backup();
  }).catch(function () { ready = true; });
})();
