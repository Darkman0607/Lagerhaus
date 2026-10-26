const CACHE_NAME = 'lagerhaus-shell-v0.1.0';
const CACHE_PREFIX = 'lagerhaus-shell-';
const SHELL = [
  './','./index.html','./manifest.webmanifest','./assets/styles.css',
  './assets/icons/icon.svg','./assets/icons/icon-192.png','./assets/icons/icon-512.png',
  './src/main.js','./src/core/icons.js','./src/core/router.js',
  './src/data/store.js','./src/views/dashboard.js','./src/views/warehouse.js',
  './src/views/articles.js','./src/views/shopping.js','./src/views/more.js'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(Promise.all([caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith(CACHE_PREFIX)&&n!==CACHE_NAME).map(n=>caches.delete(n)))),self.clients.claim()]));});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
 if(request.mode==='navigate'){
  event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));return;
 }
 event.respondWith(caches.match(request).then(cached=>cached||fetch(request)));
});
