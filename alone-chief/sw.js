// 나홀로 실장 · offline cache for the installed web app
// pages: network first (always the newest version, cached copy when offline) · engine/fonts/icons: cache first · ranking & server calls: never cached
const V='alonechief-v2';
const CORE=['./','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(CORE.map(u=>c.add(u).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
  if(/supabase\.co$|kakao|kakaocdn/.test(u.hostname))return;
  if(r.mode==='navigate'){const main=/\/alone-chief\/(index\.html)?$/.test(u.pathname);
    e.respondWith(fetch(r).then(res=>{if(main&&res.ok){const cp=res.clone();caches.open(V).then(c=>c.put('./',cp));}return res;})
      .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match('./'))));return;}
  const stat=u.hostname==='cdn.jsdelivr.net'||/^fonts\.(googleapis|gstatic)\.com$/.test(u.hostname)||(u.origin===self.location.origin&&/\/icons\/|\.webmanifest$|og\.png$/.test(u.pathname));
  if(stat)e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{if(res.ok||res.type==='opaque'){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}return res;})));
});
