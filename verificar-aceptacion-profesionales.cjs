const fs = require("node:fs");

const leer = (archivo) => fs.readFileSync(archivo, "utf8").replace(/\r\n/g, "\n");
const html = leer("mvp-profesionales.html");
const css = leer("mvp-profesionales.css");
const ui = leer("mvp-profesionales.js");
const firestore = leer("firestore.rules");
const storage = leer("storage.rules");
const matriz = leer("PROFESIONALES-ACEPTACION.md");
const firebase = JSON.parse(fs.readFileSync("firebase.json", "utf8"));
const proyecto = JSON.parse(fs.readFileSync(".firebaserc", "utf8"));
const indices = JSON.parse(fs.readFileSync("firestore.indexes.json", "utf8"));
const exigir = (valor, mensaje) => { if (!valor) throw new Error(`Verificación fallida: ${mensaje}`); };

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((item) => item[1]);
const duplicados = ids.filter((id, indice) => ids.indexOf(id) !== indice);
exigir(!duplicados.length, `hay ID duplicados: ${[...new Set(duplicados)].join(", ")}`);
exigir(html.includes('name="viewport"'), "falta configuración móvil");
exigir((css.match(/@media\(max-width:/g) || []).length >= 5, "faltan adaptaciones responsive");
exigir(html.includes('aria-live="polite"'), "faltan avisos accesibles");
exigir(html.includes('aria-label="Asistencia"'), "el acceso a asistencia no es accesible");
exigir(html.includes("RED DE PROFESIONALES VERIFICADOS"), "falta la identificación pública de la red profesional");
exigir(!html.includes("MVP DE PRUEBAS") && !html.includes("términos del MVP"), "la interfaz pública todavía se presenta como prueba");
exigir(ui.includes('if (profileDialog?.open) profileDialog.close()'), "el perfil permanece abierto al solicitar un servicio");
exigir(!firestore.includes("match /pv_profesionales_privados/{uid} {\n      allow read: if true"), "la identidad profesional quedó pública");
exigir(!firestore.includes("match /pv_contratos/{contratoId} {\n      allow read: if true"), "los contratos quedaron públicos");
exigir(storage.includes("allow update, delete: if false"), "faltan bloqueos de mutación en Storage");
exigir(matriz.includes("Pendiente de confirmación o proveedor externo"), "falta separar decisiones externas");
exigir(matriz.includes("pendiente únicamente de una sesión autenticada"), "falta registrar el bloqueo real de publicación");
exigir(proyecto.projects?.default === "vigna-plomeros", "el proyecto Firebase predeterminado no es el autorizado");
exigir(firebase.firestore?.indexes === "firestore.indexes.json", "falta declarar el archivo de índices");
exigir(Array.isArray(indices.indexes) && Array.isArray(indices.fieldOverrides), "el archivo de índices no es válido");

console.log("Aceptación estructural, responsive, privacidad y alcance: verificada.");
