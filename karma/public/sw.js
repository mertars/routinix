// Karma service worker — uygulama çevrimdışı da açılsın diye.
// Sayfalar: önce ağ, olmazsa önbellek. /_next/static: önbellek öncelikli
// (dosya adları içerik hash'i taşır). Diğer statik dosyalar: önbellekten sun,
// arkada tazele.

const VERSION = "karma-v2";
// Uygulama kökte ("/") veya Routinix içinde ("/karma") yayınlanabilir; kök yol
// service worker'ın kapsamından çıkarılır.
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const PAGES = ["/oyuncular", "/kadro", "/maclar", "/ayarlar", "/paylas"].map((p) => BASE + p);
const ASSETS = ["/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/favicon.svg"].map((p) => BASE + p);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll([...PAGES, ...ASSETS]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function stripHash(url) {
  const u = new URL(url);
  u.hash = "";
  return u.toString();
}

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") cache.put(stripHash(request.url), response.clone());
    return response;
  } catch {
    const cached = (await cache.match(stripHash(request.url), { ignoreSearch: true })) || (await cache.match(BASE + "/oyuncular"));
    return cached || new Response("Çevrimdışı", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.startsWith(BASE + "/_next/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (!url.pathname.startsWith(BASE + "/_next/")) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
