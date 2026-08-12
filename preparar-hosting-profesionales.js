const fs = require("node:fs");
const path = require("node:path");

const RAIZ = __dirname;
const SALIDA = path.join(RAIZ, "hosting-profesionales");
const LOGO = path.join("images", "logo", "ChatGPT Image 26 may 2026, 11_05_03 p.m..png");
const PLANTILLA_CONTRATO = path.join("plantillas", "plantilla-productos-paso-a-paso-vigna.xlsx");
const ICONOS_APP = [
  path.join("images", "app-icons", "vigna-app-icon-192.png"),
  path.join("images", "app-icons", "vigna-app-icon-512.png"),
  path.join("images", "app-icons", "apple-touch-icon.png"),
  path.join("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png"),
  path.join("images", "app-icons", "favicon-32.png")
];
const ARCHIVOS = [
  "firebase.js",
  "vigna-config.js",
  "mvp-profesionales.css",
  "mvp-profesionales.js",
  "mvp-profesionales-firebase.js",
  "mvp-profesionales-identidad.mjs",
  "mvp-profesionales-cloud-ui.js",
  "mvp-profesionales-bootstrap.js",
  "manifest.webmanifest",
  "service-worker.js",
  "legal-vigna.css",
  "privacidad-vigna.html",
  "terminos-vigna.html",
  "soporte-vigna.html",
  "eliminar-cuenta.html",
  "libro-reclamaciones.html",
  "garantias-reclamos.html",
  "garantias-reclamos.css",
  "garantias-reclamos.js",
  PLANTILLA_CONTRATO,
  LOGO,
  ...ICONOS_APP
];

fs.rmSync(SALIDA, { recursive: true, force: true });
fs.mkdirSync(SALIDA, { recursive: true });

for (const archivo of ARCHIVOS) {
  const origen = path.join(RAIZ, archivo);
  const destino = path.join(SALIDA, archivo);
  if (!fs.existsSync(origen)) throw new Error(`Falta el archivo requerido: ${archivo}`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origen, destino);
}

const html = fs.readFileSync(path.join(RAIZ, "mvp-profesionales.html"), "utf8");
fs.writeFileSync(path.join(SALIDA, "index.html"), html);
fs.writeFileSync(path.join(SALIDA, "mvp-profesionales.html"), html);

console.log("Publicación aislada preparada en hosting-profesionales.");
