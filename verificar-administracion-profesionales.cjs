const fs = require("node:fs");
const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const html = leer("mvp-profesionales.html");
const interfaz = leer("mvp-profesionales.js");
const firebase = leer("mvp-profesionales-firebase.js");
const reglas = leer("firestore.rules");
const exigir = (valor, mensaje) => { if (!valor) throw new Error(`Verificación fallida: ${mensaje}`); };

exigir(firebase.includes("async function obtenerAdminRol"), "faltan roles administrativos");
exigir(firebase.includes('"superadmin", "moderacion", "soporte", "finanzas"'), "faltan los cuatro roles mínimos");
exigir(firebase.includes('exigirPermisoAdmin("moderacion")'), "la moderación no está segmentada");
exigir(firebase.includes('exigirPermisoAdmin("soporte")'), "el soporte no está segmentado");
exigir(firebase.includes('exigirPermisoAdmin("finanzas")'), "finanzas no está segmentado");
exigir(reglas.includes("function adminPuede(rol)"), "las reglas no reconocen permisos por rol");
exigir(reglas.includes('adminRol() == "admin"'), "las cuentas administrativas heredadas no conservan permisos de superadministración");
exigir(reglas.includes('adminPuede("moderacion")'), "las reglas no protegen moderación");
exigir(reglas.includes('adminPuede("soporte")'), "las reglas no protegen soporte");
exigir(reglas.includes('adminPuede("finanzas")'), "las reglas no protegen finanzas");
exigir(html.includes('id="adminExportCsv"') && html.includes('id="adminExportJson"'), "faltan exportaciones administrativas");
exigir(interfaz.includes("Conversión") && interfaz.includes("Calificación") && interfaz.includes("Planes activos"), "faltan KPI administrativos");
exigir(interfaz.includes("descargarAdministracion"), "las exportaciones no están implementadas");
exigir(interfaz.includes("const auditoriaOrdenada = [...data.auditoria].sort"), "la auditoría no ordena primero los eventos recientes");

console.log("Roles administrativos, KPI y exportaciones: integración verificada.");
