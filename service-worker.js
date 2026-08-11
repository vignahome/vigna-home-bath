const CACHE_NAME = "profesionales-vigna-shell-v7";
const APP_SHELL = [
  "/mvp-profesionales",
  "/mvp-profesionales.css?v=19",
  "/mvp-profesionales-bootstrap.js?v=24",
  "/manifest.webmanifest?v=3",
  "/images/app-icons/vigna-app-icon-192.png",
  "/images/app-icons/vigna-app-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Nunca se almacenan rutas de API ni respuestas dinámicas con información privada.
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && ["document", "script", "style", "image", "font"].includes(request.destination)) {
          const copia = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
        }
        return response;
      })
      .catch(() => caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode === "navigate") return caches.match("/mvp-profesionales");
        return Response.error();
      }))
  );
});
