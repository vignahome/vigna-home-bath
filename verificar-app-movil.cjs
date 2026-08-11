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
const capacitor = JSON.parse(leer("capacitor.config.json"));

exigir(manifest.name === "VIGNA" && manifest.short_name === "VIGNA", "el nombre visible de la aplicación no es VIGNA");
exigir(manifest.display === "standalone", "la aplicación no abre en modo independiente");
exigir(manifest.start_url === "/mvp-profesionales", "la ruta de inicio no abre Profesionales Vigna’s");
exigir(manifest.icons.some((icono) => icono.sizes === "192x192"), "falta el icono PWA de 192 px");
exigir(manifest.icons.some((icono) => icono.sizes === "512x512" && icono.purpose.includes("maskable")), "falta el icono adaptable de 512 px");
exigir(html.includes('rel="manifest" href="manifest.webmanifest?v=2"'), "la página no enlaza el manifiesto vigente");
exigir(html.includes('name="apple-mobile-web-app-capable"'), "falta compatibilidad de instalación en iOS");
exigir(html.includes('rel="apple-touch-icon"'), "falta el icono de inicio para iOS");
exigir(bootstrap.includes('navigator.serviceWorker.register("/service-worker.js"'), "el modo instalable no registra el service worker");
exigir(worker.includes('url.origin !== self.location.origin'), "el service worker podría interceptar servicios externos");
exigir(worker.includes('url.pathname.startsWith("/api/")'), "el service worker no excluye respuestas de API");
exigir(worker.includes('request.mode === "navigate"'), "la recuperación sin conexión no está limitada a navegación");
exigir(build.includes('"manifest.webmanifest"') && build.includes('"service-worker.js"'), "el build no incluye los archivos instalables");
exigir(build.includes('"app-icons"'), "el build no incluye los iconos de la aplicación");
exigir(firebase.hosting.headers.some((item) => item.source === "/service-worker.js"), "Hosting no controla la caché del service worker");
exigir(capacitor.appId === "pe.vigna.profesionales", "el identificador nativo no es el aprobado");
exigir(capacitor.appName === "VIGNA", "el nombre nativo visible no es VIGNA");
exigir(capacitor.webDir === "hosting-profesionales", "Capacitor no utiliza el build aislado");
exigir(fs.existsSync("images/app-icons/vigna-app-icon-512.png"), "falta el icono fuente de la aplicación");
exigir(fs.existsSync("android/app/src/main/AndroidManifest.xml"), "falta el proyecto nativo Android");
exigir(fs.existsSync("ios/App/App.xcodeproj/project.pbxproj"), "falta el proyecto nativo iOS");
exigir(fs.existsSync("android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png"), "falta el icono Android generado");
exigir(fs.existsSync("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"), "falta el icono iOS generado");

console.log("Base móvil: PWA, iconos, Capacitor y privacidad verificados.");
