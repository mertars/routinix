// Minimal service worker — TEK amacı Chrome'un "yüklenebilirlik" kriterini
// (kayıtlı bir service worker + fetch handler) karşılamak, böylece
// `beforeinstallprompt` event'i ateşlenebiliyor (bkz. src/hooks/useInstallPrompt.js).
// BİLEREK herhangi bir şey CACHE'LEMİYOR — Vite build'leri her deploy'da
// içerik-hash'li yeni dosya adları üretiyor, bu dosyaları önbelleğe alan
// bir SW kullanıcıları eski JS/CSS'e KİLİTLER (klasik "PWA bayat içerik
// gösteriyor" hatası). Her istek doğrudan ağa gidiyor.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});
