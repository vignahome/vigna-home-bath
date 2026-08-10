const fs = require("node:fs");

const html = fs.readFileSync("mvp-profesionales.html", "utf8");
const css = fs.readFileSync("mvp-profesionales.css", "utf8");
const firestore = fs.readFileSync("firestore.rules", "utf8");
const storage = fs.readFileSync("storage.rules", "utf8");
const matriz = fs.readFileSync("PROFESIONALES-ACEPTACION.md", "utf8");
const exigir = (valor, mensaje) => { if (!valor) throw new Error(`Verificación fallida: ${mensaje}`); };

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((item) => item[1]);
const duplicados = ids.filter((id, indice) => ids.indexOf(id) !== indice);
exigir(!duplicados.length, `hay ID duplicados: ${[...new Set(duplicados)].join(", ")}`);
exigir(html.includes('name="viewport"'), "falta configuración móvil");
exigir((css.match(/@media\(max-width:/g) || []).length >= 5, "faltan adaptaciones responsive");
exigir(html.includes('aria-live="polite"'), "faltan avisos accesibles");
exigir(html.includes('aria-label="Asistencia"'), "el acceso a asistencia no es accesible");
exigir(!firestore.includes("match /pv_profesionales_privados/{uid} {\n      allow read: if true"), "la identidad profesional quedó pública");
exigir(!firestore.includes("match /pv_contratos/{contratoId} {\n      allow read: if true"), "los contratos quedaron públicos");
exigir(storage.includes("allow update, delete: if false"), "faltan bloqueos de mutación en Storage");
exigir(matriz.includes("Pendiente de confirmación o proveedor externo"), "falta separar decisiones externas");
exigir(matriz.includes("expresamente fuera del alcance autorizado"), "falta respetar la prohibición de despliegue");

console.log("Aceptación estructural, responsive, privacidad y alcance: verificada.");
