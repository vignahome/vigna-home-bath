const fs = require("node:fs");
const path = require("node:path");

const raiz = __dirname;
const leer = (archivo) => fs.readFileSync(path.join(raiz, archivo), "utf8");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`Verificación fallida: ${mensaje}`);
};

const requeridos = [
  "garantias-reclamos.html",
  "garantias-reclamos.css",
  "garantias-reclamos.js",
  "firestore.rules",
  "storage.rules"
];
requeridos.forEach((archivo) => exigir(fs.existsSync(path.join(raiz, archivo)), `falta ${archivo}`));

const html = leer("garantias-reclamos.html");
const js = leer("garantias-reclamos.js");
const bootstrap = leer("mvp-profesionales-bootstrap.js");
const principal = leer("mvp-profesionales.html");
const firebaseProfesionales = leer("mvp-profesionales-firebase.js");
const interfazNube = leer("mvp-profesionales-cloud-ui.js");
const hosting = leer("preparar-hosting-profesionales.js");
const firestore = leer("firestore.rules");
const storage = leer("storage.rules");

const idsHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((coincidencia) => coincidencia[1]));
const idsControlador = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((coincidencia) => coincidencia[1]);
idsControlador.forEach((id) => exigir(idsHtml.has(id), `el controlador busca #${id}, pero ese elemento no existe`));

const llavesBalanceadas = (contenido) => {
  let nivel = 0;
  for (const caracter of contenido) {
    if (caracter === "{") nivel += 1;
    if (caracter === "}") nivel -= 1;
    if (nivel < 0) return false;
  }
  return nivel === 0;
};

exigir(html.includes('src="garantias-reclamos.js?v=1"'), "la página no carga su controlador");
exigir(html.includes('href="garantias-reclamos.css?v=1"'), "la página no carga sus estilos");
exigir(js.includes('"cliente", "profesional", "admin"'), "faltan los tres roles autorizados");
exigir(js.includes("signInWithEmailAndPassword"), "falta Firebase Auth");
exigir(js.includes('reclamos: "pv_reclamos"'), "falta la conexión a Firestore");
exigir(js.includes("uploadBytes"), "falta la conexión a Firebase Storage");
exigir(js.includes('notificaciones: "pv_notificaciones"'), "falta la colección aislada de notificaciones");
exigir(js.includes("guardarNotificaciones"), "faltan los avisos automáticos por cambio de estado");
exigir(interfazNube.includes("marcarNotificacionesVistas"), "falta el control global de notificaciones vistas");
exigir(js.includes("Este cierre omite la aceptación final del cliente"), "el cierre administrativo directo debe pedir confirmación");
exigir(js.includes("function garantiaVigente(contrato)"), "falta validar la vigencia de la garantía");
exigir(js.includes("function tieneReclamoActivo(contratoId)"), "falta bloquear expedientes activos duplicados");
exigir(js.includes("La garantía de este contrato ya venció"), "falta informar contratos fuera de garantía");
exigir(js.includes("form?.elements?.namedItem(nombre)"), "los formularios deben poder leerse después de bloquear sus controles");
exigir(js.includes("} finally {\n    estado.cargando = false;\n  }\n  renderizar();"), "el listado debe renderizarse después de finalizar la carga");
exigir(principal.includes('href="garantias-reclamos.html"'), "el MVP no enlaza el módulo independiente");
exigir(principal.includes('aria-label="Asistencia"'), "el acceso principal no se llama Asistencia");
exigir(principal.includes('class="assistance-fab"'), "falta el botón flotante de Asistencia con símbolo de auriculares");
exigir(principal.includes('id="pvNotificationsDialog"'), "falta el centro global de notificaciones en la página principal");
exigir(!html.includes('id="abrirNotificaciones"'), "las notificaciones no deben permanecer en la página de Asistencia");
exigir(html.includes("<h1>Asistencia</h1>"), "el módulo independiente no se presenta como Asistencia");
exigir(interfazNube.includes("actualizarNotificacionesGlobales(datos, user)"), "la página principal no carga toda la actividad auditada");
exigir(interfazNube.includes("datos?.auditoria || []"), "el centro global no usa la auditoría completa");
exigir(principal.includes('name="garantiaDias"'), "la cotización no solicita una vigencia de garantía");
exigir(firebaseProfesionales.includes("vigenciaGarantia"), "el cierre no prepara la vigencia estructurada de garantía");
exigir(hosting.includes('"garantias-reclamos.html"'), "Hosting no incluye la página independiente");
exigir(hosting.includes('"garantias-reclamos.js"'), "Hosting no incluye el controlador");
exigir(hosting.includes('"garantias-reclamos.css"'), "Hosting no incluye los estilos");
exigir(!bootstrap.includes("mvp-profesionales-reclamos.js"), "el panel flotante anterior todavía se carga");
exigir(!fs.existsSync(path.join(raiz, "mvp-profesionales-reclamos.js")), "el archivo roto anterior todavía existe");
exigir(firestore.includes("match /pv_reclamos/{reclamoId}"), "faltan reglas Firestore para reclamos");
exigir(firestore.includes("match /pv_notificaciones/{notificacionId}"), "faltan reglas Firestore para notificaciones");
exigir(firestore.includes('"garantiaInicioEn", "garantiaVenceEn", "actualizadoEn"'), "las reglas no permiten registrar la vigencia de garantía");
exigir(firestore.includes("allow delete: if false"), "los reclamos deben ser indelebles desde el cliente web");
exigir(storage.includes("match /profesionales-vigna/reclamos/{reclamoId}/{uid}/{archivo}"), "faltan reglas Storage para evidencias");
exigir(llavesBalanceadas(firestore), "las llaves de firestore.rules no están balanceadas");
exigir(llavesBalanceadas(storage), "las llaves de storage.rules no están balanceadas");

console.log("Asistencia y notificaciones globales: integración verificada.");
