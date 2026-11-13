// Минимальный service worker: оболочка приложения кэшируется, данные всегда из сети (работает при https/localhost)
const V='hsk4-v1', SHELL=['/','/style.css','/app.js','/manifest.json','/icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url); if(u.pathname.startsWith('/api')) return;
 e.respondWith(fetch(e.request).then(r=>{if(u.pathname.startsWith('/audio')||e.request.method!=='GET')return r;const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
