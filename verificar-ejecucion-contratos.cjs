const fs = require("node:fs");
const path = require("node:path");

const raiz = __dirname;
const leer = (archivo) => fs.readFileSync(path.join(raiz, archivo), "utf8").replace(/\r\n/g, "\n");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`Verificación de ejecución fallida: ${mensaje}`);
};

const interfaz = leer("mvp-profesionales.js");
const nube = leer("mvp-profesionales-cloud-ui.js");
const firebase = leer("mvp-profesionales-firebase.js");
const css = leer("mvp-profesionales.css");
const firestore = leer("firestore.rules");
const storage = leer("storage.rules");

[
  'hitos: "pv_hitos"',
  'pagosDeclarados: "pv_pagos_declarados"',
  'ordenesCambio: "pv_ordenes_cambio"',
  "async function crearHito",
  "async function registrarAvanceHito",
  "async function resolverHito",
  "async function declararPago",
  "async function resolverPago",
  "async function proponerOrdenCambio",
  "async function resolverOrdenCambio",
  "async function abrirEvidenciaEjecucion"
].forEach((marca) => exigir(firebase.includes(marca), `falta ${marca}`));

[
  "data-create-milestone",
  "data-submit-milestone",
  "data-review-milestone",
  "data-declare-payment",
  "data-review-payment",
  "data-propose-change",
  "data-review-change",
  "data-open-execution-file"
].forEach((marca) => exigir(interfaz.includes(marca) && nube.includes(marca), `la acción ${marca} no está conectada de extremo a extremo`));

exigir(interfaz.includes("Ejecución del contrato"), "falta el espacio visual de ejecución");
exigir(interfaz.includes("Los registros no modifican el contrato firmado"), "falta explicar la inmutabilidad contractual");
exigir(css.includes(".contract-execution"), "faltan estilos del espacio de ejecución");
exigir(css.includes("@media(max-width:760px)"), "falta adaptación móvil");

[
  "match /pv_hitos/{hitoId}",
  "match /pv_pagos_declarados/{pagoId}",
  "match /pv_ordenes_cambio/{ordenId}"
].forEach((marca) => exigir(firestore.includes(marca), `faltan reglas ${marca}`));

exigir(firestore.includes('resource.data.estado in ["Pendiente", "Observado"]'), "el profesional no puede reenviar un hito observado");
exigir(firestore.includes('request.resource.data.estado in ["Aprobado", "Observado"]'), "el cliente no controla la revisión de hitos");
exigir(firestore.includes('request.resource.data.estado in ["Confirmado", "Rechazado"]'), "el profesional no controla pagos declarados");
exigir(firestore.includes("request.auth.uid != resource.data.proponenteUid"), "el proponente podría aprobar su propia orden de cambio");
exigir(firestore.includes('affectedKeys().hasOnly([\n          "estado", "respuesta"'), "una orden podría reescribir el contrato o su propuesta");

exigir(storage.includes("/ejecucion/{contratoId}/hitos/{hitoId}/{uid}/{archivo}"), "faltan evidencias privadas de hitos");
exigir(storage.includes("/ejecucion/{contratoId}/pagos/{pagoId}/{uid}/{archivo}"), "faltan comprobantes privados de pagos");
exigir(storage.includes('hitoEjecucion().estado in ["Pendiente", "Observado"]'), "Storage no limita el estado de carga del hito");
exigir(storage.includes('pagoDeclarado().estado == "Declarado"'), "Storage no valida el pago declarado");
exigir(firebase.includes('hitosContrato.some((item) => item.estado !== "Aprobado")'), "la finalización no bloquea hitos pendientes");
exigir(firebase.includes('pagosContrato.some((item) => item.estado === "Declarado")'), "la finalización no bloquea pagos sin resolver");
exigir(firebase.includes('cambiosContrato.some((item) => item.estado === "Propuesta")'), "la finalización no bloquea cambios sin resolver");
exigir(firebase.includes("aceptacionExpresa !== true"), "el cierre no exige aceptación expresa");
exigir(firebase.includes("const actaConformidad ="), "el cierre no genera un acta estructurada");
exigir(interfaz.includes("ACTA DE ENTREGA Y CONFORMIDAD"), "el contrato cerrado no muestra el acta");
exigir(interfaz.includes("data-print-handover"), "el acta no se puede imprimir");
exigir(nube.includes("serviceAcceptance"), "la interfaz conectada no valida la aceptación");
exigir(firestore.includes('"cerradoPorUid", "cerradoEn", "actaConformidad"'), "las reglas no limitan el acta al cierre");
exigir(firestore.includes("request.resource.data.actaConformidad.aceptadaPorUid == request.auth.uid"), "las reglas no autentican al firmante del acta");
exigir(css.includes("body.printing-handover"), "falta la vista de impresión aislada del acta");

const balanceadas = (contenido) => {
  let nivel = 0;
  for (const caracter of contenido) {
    if (caracter === "{") nivel += 1;
    if (caracter === "}") nivel -= 1;
    if (nivel < 0) return false;
  }
  return nivel === 0;
};
exigir(balanceadas(firestore), "las llaves de Firestore no están balanceadas");
exigir(balanceadas(storage), "las llaves de Storage no están balanceadas");

console.log("Ejecución contractual: hitos, pagos y cambios verificados.");
