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
  "storage.rules",
  "plantillas/plantilla-productos-paso-a-paso-vigna.xlsx"
];
requeridos.forEach((archivo) => exigir(fs.existsSync(path.join(raiz, archivo)), `falta ${archivo}`));

const html = leer("garantias-reclamos.html");
const js = leer("garantias-reclamos.js");
const css = leer("garantias-reclamos.css");
const bootstrap = leer("mvp-profesionales-bootstrap.js");
const principal = leer("mvp-profesionales.html");
const principalJs = leer("mvp-profesionales.js");
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

exigir(html.includes('src="garantias-reclamos.js?v=3"'), "la página no carga su controlador actualizado");
exigir(html.includes('href="garantias-reclamos.css?v=2"'), "la página no carga sus estilos actualizados");
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
exigir(interfazNube.includes("asegurarAsistenciaFlotante"), "falta reforzar la posición flotante fuera del menú");
exigir(interfazNube.includes("document.body.appendChild(enlace)"), "Asistencia debe colocarse directamente sobre el cuerpo de la página");
exigir(principal.includes('id="pvNotificationsDialog"'), "falta el centro global de notificaciones en la página principal");
exigir(!html.includes('id="abrirNotificaciones"'), "las notificaciones no deben permanecer en la página de Asistencia");
exigir(html.includes("<h1>Asistencia</h1>"), "el módulo independiente no se presenta como Asistencia");
exigir(interfazNube.includes("actualizarNotificacionesGlobales(datos, user)"), "la página principal no carga toda la actividad auditada");
exigir(interfazNube.includes("datos?.auditoria || []"), "el centro global no usa la auditoría completa");
exigir(interfazNube.includes("function destinoNotificacion(item)"), "las notificaciones no determinan su acción directa");
exigir(interfazNube.includes("function referenciaNotificacion(item)"), "las notificaciones no identifican el registro exacto");
exigir(interfazNube.includes("data-pv-notification-id"), "las acciones no conservan el identificador del registro");
exigir(interfazNube.includes("?expediente=${encodeURIComponent(id)}"), "Asistencia no recibe el expediente solicitado");
exigir(js.includes('new URLSearchParams(location.search).get("expediente")'), "Asistencia no lee el expediente de la notificación");
exigir(js.includes('data-expediente-id="${escapar(reclamo.id)}"'), "los expedientes no pueden enfocarse de forma segura");
exigir(css.includes(".gr-case-target"), "falta el resaltado visual del expediente solicitado");
exigir(principalJs.includes("abrirContrato: (id) => openContract(id)"), "la notificación no puede abrir un contrato exacto");
exigir(principalJs.includes("abrirCotizacion: (id) => openQuote(id)"), "la notificación no puede abrir una cotización exacta");
exigir(principalJs.includes("enfocarSolicitud: (id) => enfocarSolicitud(id)"), "la notificación no puede enfocar una solicitud exacta");
exigir(interfazNube.includes("mvp.enfocarSolicitud(id)"), "la acción de solicitud no usa su identificador");
exigir(principal.includes('mvp-profesionales-bootstrap.js?v=14'), "la página principal no carga la integración contractual actualizada");
exigir(interfazNube.includes('"garantias-reclamos.html"'), "los avisos de reclamo no abren Asistencia");
exigir(interfazNube.includes("data-pv-notification-target"), "faltan acciones en los avisos globales");
exigir(firebaseProfesionales.includes("onSnapshot"), "falta la escucha Firestore en tiempo real");
exigir(js.includes("function suscribirActualizaciones()"), "Asistencia no prepara sus actualizaciones en tiempo real");
exigir(js.includes("detenerReclamos = onSnapshot"), "los expedientes de Asistencia no se actualizan en vivo");
exigir(js.includes("detenerContratos = onSnapshot"), "los contratos disponibles no se actualizan en vivo");
exigir(firebaseProfesionales.includes("async function observarActividad"), "falta el observador global de actividad");
exigir(firebaseProfesionales.includes('preferenciasNotificaciones: "pv_preferencias_notificaciones"'), "falta persistir las lecturas de notificaciones");
exigir(firebaseProfesionales.includes("async function guardarRevisionNotificaciones"), "falta guardar la lectura entre dispositivos");
exigir(interfazNube.includes("revisionNotificacionesRemota"), "la interfaz no combina la lectura local y remota");
exigir(interfazNube.includes("recibirActividadEnTiempoReal"), "la interfaz no actualiza las notificaciones en vivo");
exigir(interfazNube.includes("temporizadorSincronizacion"), "la actividad nueva no sincroniza el resto de los paneles");
exigir(interfazNube.includes("actividadInicializada = true"), "la primera notificación posterior a una lista vacía puede perderse");
exigir(interfazNube.includes('filtroNotificaciones === "no-leidas"'), "falta el filtro de notificaciones no leídas");
exigir(principal.includes('id="pvNotificationsFilter"'), "falta el selector visual de notificaciones");
exigir(!interfazNube.includes('showModal();\n    marcarNotificacionesVistas();'), "abrir el centro no debe marcar automáticamente los avisos");
exigir(principal.includes('name="garantiaDias"'), "la cotización no solicita una vigencia de garantía");
exigir(firebaseProfesionales.includes("vigenciaGarantia"), "el cierre no prepara la vigencia estructurada de garantía");
exigir(hosting.includes('"garantias-reclamos.html"'), "Hosting no incluye la página independiente");
exigir(hosting.includes('"garantias-reclamos.js"'), "Hosting no incluye el controlador");
exigir(hosting.includes('"garantias-reclamos.css"'), "Hosting no incluye los estilos");
exigir(hosting.includes("plantilla-productos-paso-a-paso-vigna.xlsx"), "Hosting no incluye la plantilla Excel del contrato");
exigir(!bootstrap.includes("mvp-profesionales-reclamos.js"), "el panel flotante anterior todavía se carga");
exigir(!fs.existsSync(path.join(raiz, "mvp-profesionales-reclamos.js")), "el archivo roto anterior todavía existe");
exigir(firestore.includes("match /pv_reclamos/{reclamoId}"), "faltan reglas Firestore para reclamos");
exigir(firestore.includes("match /pv_notificaciones/{notificacionId}"), "faltan reglas Firestore para notificaciones");
exigir(firestore.includes("match /pv_preferencias_notificaciones/{uid}"), "faltan reglas para preferencias privadas de notificaciones");
exigir(firestore.includes('request.resource.data.estado == "Pendiente de firma"'), "la creación de contratos no exige su estado inicial");
exigir(firestore.includes("cotizacionSeleccionada().opciones[2].precio"), "las reglas no validan el precio contra la cotización");
exigir(firestore.includes('"estado", "profesionalUid", "actualizadoEn"'), "la actualización de solicitudes permite modificar campos no autorizados");
exigir(!firestore.includes('resource.data.estado != "Aceptada"'), "el profesional todavía puede reescribir una cotización enviada");
exigir(firestore.includes('"anexoPlanTrabajoNombre", "anexoPlanTrabajoRuta"'), "las reglas Firestore no limitan los campos del anexo contractual");
exigir(firestore.includes('"garantiaInicioEn", "garantiaVenceEn", "actualizadoEn"'), "las reglas no permiten registrar la vigencia de garantía");
exigir(firestore.includes("allow delete: if false"), "los reclamos deben ser indelebles desde el cliente web");
exigir(storage.includes("match /profesionales-vigna/reclamos/{reclamoId}/{uid}/{archivo}"), "faltan reglas Storage para evidencias");
exigir(storage.includes("match /profesionales-vigna/contratos/{contratoId}/anexos/{archivo}"), "faltan reglas Storage para el anexo Excel");
exigir(storage.includes("function hojaCalculo(maximo)"), "Storage no valida archivos Excel o CSV");
exigir(firebaseProfesionales.includes("async function registrarAnexoPlanTrabajo"), "falta guardar el anexo contractual en Firebase");
exigir(firebaseProfesionales.includes("async function abrirAnexoPlanTrabajo"), "falta abrir el anexo contractual de forma privada");
exigir(interfazNube.includes("api.registrarAnexoPlanTrabajo"), "la interfaz conectada no carga el anexo contractual");
exigir(principalJs.includes("data-upload-work-plan"), "el contrato no ofrece adjuntar el plan opcional");
exigir(principalJs.includes("plantilla-productos-paso-a-paso-vigna.xlsx"), "el contrato no permite descargar la plantilla Excel");
const plantilla = fs.readFileSync(path.join(raiz, "plantillas", "plantilla-productos-paso-a-paso-vigna.xlsx"));
exigir(plantilla.length > 4096 && plantilla[0] === 0x50 && plantilla[1] === 0x4b, "la plantilla Excel no es un archivo XLSX válido");
exigir(llavesBalanceadas(firestore), "las llaves de firestore.rules no están balanceadas");
exigir(llavesBalanceadas(storage), "las llaves de storage.rules no están balanceadas");

console.log("Asistencia y notificaciones globales: integración verificada.");
