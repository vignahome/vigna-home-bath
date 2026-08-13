const fs = require("node:fs");

const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const html = leer("mvp-profesionales.html");
const principal = leer("mvp-profesionales.js");
const firebase = leer("mvp-profesionales-firebase.js");
const ui = leer("mvp-profesionales-cloud-ui.js");
const firestore = leer("firestore.rules");
const storage = leer("storage.rules");
const exigir = (condicion, mensaje) => { if (!condicion) throw new Error(`Verificación fallida: ${mensaje}`); };

[
  "situacionActual", "resultadoEsperado", "responsableMateriales", "restricciones",
  "validaHasta", "disponibilidadEstimada", "exclusiones", "materialNombre", "materialCantidad", "materialUnidad", "materialPrecioUnitario", "cotizacionMateriales", "cotizacionManoObra", "cotizacionOtros", "formaPago"
].forEach((campo) => exigir(html.includes(`name="${campo}"`), `falta el campo estructurado ${campo}`));

exigir(html.includes('id="professionalRequests"'), "el panel profesional no muestra las solicitudes compatibles");
exigir(principal.includes('data-quote-request="${escapar(request.id)}"'), "las solicitudes compatibles no permiten iniciar una cotización");
exigir(principal.includes("Ver solicitud completa"), "el profesional no puede abrir el detalle de la solicitud");
exigir(principal.includes("Fotos, video o documentos"), "el detalle no muestra los archivos del cliente");
exigir(principal.includes("data-quote-from-detail"), "el detalle no permite continuar a la cotización");
exigir(principal.includes("quoteSelector.value = solicitudId"), "el detalle no selecciona la solicitud correspondiente");

exigir(firebase.includes('portafolios: "pv_portafolios"'), "falta la colección independiente de portafolio");
exigir(firebase.includes("consentimientoPublicacion: true"), "falta consentimiento verificable del portafolio");
exigir(firebase.includes("async function moderarPortafolio"), "falta moderación administrativa del portafolio");
exigir(ui.includes("data-admin-portfolio"), "la moderación no está conectada a la interfaz");
exigir(firestore.includes("match /pv_portafolios/{proyectoId}"), "faltan reglas del portafolio");
exigir(storage.includes("portafolio/{proyectoId}/{archivo}"), "faltan reglas de archivos moderados");

exigir(firebase.includes("cotizacionRaizId"), "falta la raíz de versionado de cotizaciones");
exigir(firebase.includes("reemplazaA"), "falta trazabilidad entre versiones de cotización");
exigir(firebase.includes("Number(anterior?.version || 0) + 1"), "las versiones no son incrementales");
exigir(firebase.includes("materiales + manoObra + otros"), "el total no se calcula desde el desglose");
exigir(firebase.includes('opciones: [opcion("cotizacion", "Cotización")]'), "las nuevas cotizaciones deben tener una sola propuesta");
exigir(!html.includes("Tres alternativas comparables"), "el formulario todavía anuncia tres alternativas");
exigir(principal.includes("Descargar cotización en Excel"), "falta la descarga de la cotización en Excel");
exigir(principal.includes('data-download-quote'), "la descarga de Excel no está conectada a la interfaz");
exigir(principal.includes("materialesDetalle"), "el detalle de materiales no se conserva en la cotización");
exigir(firebase.includes("materialesDetalle"), "Firebase no guarda los materiales individuales");
exigir(html.includes("data-add-quote-material"), "falta el botón para agregar materiales");
exigir(firebase.includes("adjuntos.length > 10"), "la solicitud no limita la cantidad de adjuntos");
exigir(firestore.includes("request.resource.data.version >= 1"), "las reglas no validan la versión");

console.log("Portafolio moderado, solicitudes guiadas y cotizaciones versionadas: integración verificada.");
