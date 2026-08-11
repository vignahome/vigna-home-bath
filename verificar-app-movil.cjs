const fs = require("node:fs");

const leer = (archivo) => fs.readFileSync(archivo, "utf8");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`Verificación móvil fallida: ${mensaje}`);
};

const html = leer("mvp-profesionales.html");
const bootstrap = leer("mvp-profesionales-bootstrap.js");
const worker = leer("service-worker.js");
const build = leer("preparar-hosting-profesionales.js");
const firebase = JSON.parse(leer("firebase.json"));
const manifest = JSON.parse(leer("manifest.webmanifest"));

exigir(manifest.name === "Profesionales Vigna’s", "el manifiesto no identifica la aplicación");
exigir(manifest.display === "standalone", "la aplicación no abre en modo independiente");
exigir(manifest.start_url === "/mvp-profesionales", "la ruta de inicio no abre Profesionales Vigna’s");
exigir(html.includes('rel="manifest" href="manifest.webmanifest?v=1"'), "la página no enlaza el manifiesto");
exigir(html.includes('name="apple-mobile-web-app-capable"'), "falta compatibilidad de instalación en iOS");
exigir(bootstrap.includes('navigator.serviceWorker.register("/service-worker.js"'), "el modo instalable no registra el service worker");
exigir(worker.includes('url.origin !== self.location.origin'), "el service worker podría interceptar servicios externos");
exigir(worker.includes('url.pathname.startsWith("/api/")'), "el service worker no excluye respuestas de API");
exigir(worker.includes('request.mode === "navigate"'), "la recuperación sin conexión no está limitada a navegación");
exigir(build.includes('"manifest.webmanifest"') && build.includes('"service-worker.js"'), "el build no incluye los archivos instalables");
exigir(firebase.hosting.headers.some((item) => item.source === "/service-worker.js"), "Hosting no controla la caché del service worker");

console.log("Base instalable móvil: manifiesto, service worker y privacidad verificados.");
