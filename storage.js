/* storage.js — persistent storage + localStorage <-> IndexedDB mirror */
(function(){
  'use strict';
  var DB='rafiq-ls-backup',ST='kv',KEY='snapshot';
  function openDB(){return new Promise(function(ok,no){
    var r=indexedDB.open(DB,1);
    r.onupgradeneeded=function(){r.result.createObjectStore(ST)};
    r.onsuccess=function(){ok(r.result)};r.onerror=function(){no(r.error)};
  })}
  function idbGet(){return openDB().then(function(d){return new Promise(function(ok,no){
    var q=d.transaction(ST).objectStore(ST).get(KEY);q.onsuccess=function(){ok(q.result);d.close()};q.onerror=function(){no(q.error);d.close()};
  })})}
  function idbPut(v){return openDB().then(function(d){return new Promise(function(ok,no){
    var t=d.transaction(ST,'readwrite');t.objectStore(ST).put(v,KEY);t.oncomplete=function(){ok();d.close()};t.onerror=function(){no(t.error);d.close()};
  })})}
  function snap(){var o={};try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);o[k]=localStorage.getItem(k)}}catch(e){}return o}

  /* 1) request persistent storage */
  function persist(){try{if(navigator.storage&&navigator.storage.persist){navigator.storage.persisted().then(function(p){if(!p)navigator.storage.persist().catch(function(){})}).catch(function(){})}}catch(e){}}
  persist();
  ['click','touchend','keydown'].forEach(function(ev){addEventListener(ev,function f(){removeEventListener(ev,f,true);persist()},true)});

  /* 2) backup: mirror localStorage into IndexedDB (debounced) */
  var timer=null;
  function backupNow(){
    timer=null;var s=snap();
    if(!Object.keys(s).length)return;           // never overwrite a backup with an empty store
    idbPut({t:Date.now(),data:s}).catch(function(){});
  }
  function schedule(){if(timer)clearTimeout(timer);timer=setTimeout(backupNow,800)}
  try{
    var P=Storage.prototype,sI=P.setItem,rI=P.removeItem,cl=P.clear;
    P.setItem=function(){var r=sI.apply(this,arguments);if(this===localStorage)schedule();return r};
    P.removeItem=function(){var r=rI.apply(this,arguments);if(this===localStorage)schedule();return r};
    P.clear=function(){var r=cl.apply(this,arguments);return r};   // clear() is not mirrored on purpose
  }catch(e){}
  addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')backupNow()});
  addEventListener('pagehide',backupNow);
  setInterval(backupNow,30000);

  /* 3) restore: if the main data is gone but a backup exists, restore and reload once */
  var has=false;try{has=localStorage.getItem('mc')!==null}catch(e){}
  if(has){setTimeout(backupNow,3000);return}
  var de=document.documentElement,hidden=false;
  try{de.style.visibility='hidden';hidden=true}catch(e){}
  function show(){if(hidden){de.style.visibility='';hidden=false}}
  var guard=setTimeout(show,1500);
  idbGet().then(function(b){
    clearTimeout(guard);
    if(b&&b.data&&b.data.mc!==undefined&&!sessionStorage.getItem('__rafiq_restored')){
      try{
        Object.keys(b.data).forEach(function(k){if(localStorage.getItem(k)===null)localStorage.setItem(k,b.data[k])});
        sessionStorage.setItem('__rafiq_restored','1');
        location.reload();return;
      }catch(e){}
    }
    show();
  }).catch(function(){clearTimeout(guard);show()});
})();
