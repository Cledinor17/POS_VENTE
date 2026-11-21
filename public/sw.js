// Service worker: caches POS client shells visited while online and static assets.
// It NEVER stores API responses, business data, permissions or sales.
// Product catalog and pending sales remain explicit IndexedDB records.
// (see lib/offlineDb.ts) and are revalidated by the API when connected.
// explicitly by the app via IndexedDB (see lib/offlineDb.ts), never by
// an opaque HTTP cache here.

const CACHE_VERSION = "pos-static-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    // Only cache the already-visited POS React shell, never arbitrary pages or
    // login/API responses. Data, permissions and sales are NOT served from HTTP cache.
    const isPosShell = /^\/[^/]+\/pos(?:\/pending)?\/?$/.test(url.pathname);
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (isPosShell && response.ok && response.type === "basic") {
            // A cache quota/security error must never turn a successful online
            // response into a failed navigation.
            try {
              const cache = await caches.open(CACHE_VERSION);
              await cache.put(request, response.clone());
            } catch { /* Storage unavailable: keep online navigation working. */ }
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          return cached || Response.error();
        }
      })()
    );
    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|gif|svg|ico)$/.test(url.pathname);

  if (!isStaticAsset) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
