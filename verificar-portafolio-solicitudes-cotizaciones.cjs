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
  "validaHasta", "disponibilidadEstimada", "exclusiones", "economicaMateriales", "premiumManoObra"
].forEach((campo) => exigir(html.includes(`name="${campo}"`), `falta el campo estructurado ${campo}`));

exigir(html.includes('id="professionalRequests"'), "el panel profesional no muestra las solicitudes compatibles");
exigir(principal.includes('data-quote-request="${escapar(request.id)}"'), "las solicitudes compatibles no permiten iniciar una cotización");
exigir(principal.includes('quoteSelector.value = quoteRequest.dataset.quoteRequest'), "el botón cotizar no selecciona la solicitud correspondiente");

exigir(firebase.includes('portafolios: "pv_portafolios"'), "falta la colección independiente de portafolio");
exigir(firebase.includes("consentimientoPublicacion: true"), "falta consentimiento verificable del portafolio");
exigir(firebase.includes("async function moderarPortafolio"), "falta moderación administrativa del portafolio");
exigir(ui.includes("data-admin-portfolio"), "la moderación no está conectada a la interfaz");
exigir(firestore.includes("match /pv_portafolios/{proyectoId}"), "faltan reglas del portafolio");
exigir(storage.includes("portafolio/{proyectoId}/{archivo}"), "faltan reglas de archivos moderados");

exigir(firebase.includes("cotizacionRaizId"), "falta la raíz de versionado de cotizaciones");
exigir(firebase.includes("reemplazaA"), "falta trazabilidad entre versiones de cotización");
exigir(firebase.includes("Number(anterior?.version || 0) + 1"), "las versiones no son incrementales");
exigir(firestore.includes("request.resource.data.version >= 1"), "las reglas no validan la versión");

console.log("Portafolio moderado, solicitudes guiadas y cotizaciones versionadas: integración verificada.");
