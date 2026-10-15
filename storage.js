/* تخزين دائم + نسخ localStorage إلى IndexedDB واستعادتها إن مُسحت */
(function () {
  var DB = "rafiq-mirror", ST = "kv", KEY = "localStorage", FLAG = "__pwa_seen", RST = "__pwa_restored";
  var paused = false, last = "", timer = null;

  function idb() {
    return new Promise(function (ok, no) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { ok(r.result); };
      r.onerror = function () { no(r.error); };
    });
  }
  function put(v) {
    return idb().then(function (d) {
      return new Promise(function (ok, no) {
        var t = d.transaction(ST, "readwrite"); t.objectStore(ST).put(v, KEY);
        t.oncomplete = function () { d.close(); ok(); }; t.onerror = function () { no(t.error); };
      });
    });
  }
  function get() {
    return idb().then(function (d) {
      return new Promise(function (ok, no) {
        var q = d.transaction(ST).objectStore(ST).get(KEY);
        q.onsuccess = function () { d.close(); ok(q.result || null); }; q.onerror = function () { no(q.error); };
      });
    });
  }
  function snap() {
    var o = {};
    for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k !== RST) o[k] = localStorage.getItem(k); }
    return o;
  }
  function backup() {
    if (paused) return Promise.resolve(false);
    try {
      var o = snap(), s = JSON.stringify(o);
      if (s === last || !Object.keys(o).length) return Promise.resolve(false);
      last = s; return put({ t: Date.now(), data: o }).then(function () { return true; });
    } catch (e) { return Promise.resolve(false); }
  }
  function later() { if (timer) clearTimeout(timer); timer = setTimeout(backup, 400); }
  function restore() {
    return get().then(function (rec) {
      if (!rec || !rec.data) return false;
      Object.keys(rec.data).forEach(function (k) { localStorage.setItem(k, rec.data[k]); });
      return true;
    });
  }

  try {
    var sp = Storage.prototype, si = sp.setItem, ri = sp.removeItem, cl = sp.clear;
    sp.setItem = function () { var r = si.apply(this, arguments); if (this === localStorage) later(); return r; };
    sp.removeItem = function () { var r = ri.apply(this, arguments); if (this === localStorage) later(); return r; };
    sp.clear = function () { var r = cl.apply(this, arguments); return r; }; // لا ننسخ حالة فارغة
  } catch (e) {}

  window.PWAStorage = {
    backup: backup, restore: restore, get: get,
    persisted: function () { return navigator.storage && navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false); },
    persist: function () { return navigator.storage && navigator.storage.persist ? navigator.storage.persist() : Promise.resolve(false); }
  };

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () {});

  var seen = false;
  try { seen = !!localStorage.getItem(FLAG); } catch (e) {}
  if (seen) { backup(); } else {
    paused = true;                                   // لا نكتب فوق النسخة قبل فحص الاستعادة
    restore().then(function (done) {
      localStorage.setItem(FLAG, "1");
      if (done && !sessionStorage.getItem(RST)) { sessionStorage.setItem(RST, "1"); location.reload(); return; }
      paused = false; backup();
    }).catch(function () { localStorage.setItem(FLAG, "1"); paused = false; backup(); });
  }
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") backup(); });
  addEventListener("pagehide", backup);
  setInterval(backup, 15000);
})();
