const fs = require("node:fs");

const firebase = fs.readFileSync("mvp-profesionales-firebase.js", "utf8");
const interfaz = fs.readFileSync("mvp-profesionales.js", "utf8");
const nube = fs.readFileSync("mvp-profesionales-cloud-ui.js", "utf8");
const servidor = fs.readFileSync("server.js", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");
const exigir = (condicion, mensaje) => { if (!condicion) throw new Error(`Verificación fallida: ${mensaje}`); };

exigir(firebase.includes('crypto.subtle.digest("SHA-256"'), "el documento no genera huella SHA-256");
exigir(firebase.includes("documentoHashSha256"), "la huella no se conserva en el contrato");
exigir(firebase.includes("confirmacionesFirma"), "faltan confirmaciones por ambas partes");
exigir(firebase.includes("async function confirmarContratoFirmado"), "falta la operación de confirmación bilateral");
exigir(interfaz.includes("data-confirm-signed-contract"), "falta la acción visible de confirmación");
exigir(interfaz.includes("Confirmación bilateral"), "falta el estado visible de las firmas");
exigir(interfaz.includes("Abrir documento confirmado"), "el archivo inmutable se presenta incorrectamente como contrato actualizado");
exigir(interfaz.includes("Abrir documento histórico"), "los contratos heredados no se identifican como históricos");
exigir(interfaz.includes("No existen confirmaciones pendientes para este documento"), "un contrato histórico aparenta confirmaciones pendientes inexistentes");
exigir(interfaz.includes("confirmacionCompleta"), "la etiqueta del documento no depende de la confirmación real");
exigir(interfaz.includes("El archivo original permanece inmutable"), "falta explicar la diferencia entre el archivo y el expediente vigente");
exigir(interfaz.includes("Imprimir expediente actualizado"), "falta una salida del estado contractual vigente");
exigir(interfaz.includes("contract-price-table"), "el contrato no imprime el desglose económico");
exigir(interfaz.includes("Forma de pago"), "el contrato no imprime el calendario de pago");
exigir(interfaz.includes("Privacidad y evidencias"), "el contrato no informa el tratamiento contractual de evidencias");
exigir(interfaz.includes("data-download-contract-pdf"), "falta la descarga del PDF generado por la plataforma");
exigir(nube.includes("api.descargarPdfContrato"), "la descarga PDF no está conectada con la sesión Firebase");
exigir(servidor.includes('/api/profesionales/contratos/:contratoId/pdf'), "falta el endpoint autenticado del PDF contractual");
exigir(servidor.includes("participante") && servidor.includes("adminSnapshot"), "el PDF no valida que el usuario sea parte o administrador");
exigir(servidor.includes('Cache-Control", "private, no-store'), "el PDF privado podría quedar almacenado en caché");
exigir(!interfaz.includes(">Abrir contrato firmado</button>"), "se conserva una etiqueta engañosa para el archivo original");
exigir(nube.includes("api.confirmarContratoFirmado"), "la acción no está conectada con Firebase");
exigir(reglas.includes('resource.data.estado == "Pendiente de confirmación"'), "las reglas no protegen la confirmación bilateral");
exigir(reglas.includes("confirmacionesFirma.profesional == resource.data.confirmacionesFirma.profesional"), "un cliente podría confirmar por el profesional");

console.log("Contrato con huella SHA-256 y confirmación bilateral: integración verificada.");
