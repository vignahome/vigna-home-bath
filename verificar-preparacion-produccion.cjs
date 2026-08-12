const fs = require("node:fs");
const assert = require("node:assert/strict");

const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const html = leer("mvp-profesionales.html");
const firebase = leer("mvp-profesionales-firebase.js");
const principal = leer("mvp-profesionales.js");
const css = leer("mvp-profesionales.css");
const privacidad = leer("privacidad-vigna.html");
const terminos = leer("terminos-vigna.html");
const libro = leer("libro-reclamaciones.html");

assert.match(html, /name="documentoVenceEn"/, "falta registrar el vencimiento de identidad");
assert.match(html, /value="Remoto"/, "falta cobertura de asesoría remota");
assert.match(firebase, /profesiones\.length > 10/, "falta el máximo de profesiones");
assert.match(firebase, /sendEmailVerification/, "falta iniciar la verificación de correo");
assert.match(firebase, /contexto:[\s\S]*agente:/, "la auditoría no conserva contexto técnico mínimo");
assert.match(firebase, /desglose: \{ materiales:/, "el contrato no congela su desglose");
assert.match(firebase, /formaPago: cotizacion\.formaPago/, "el contrato no congela la forma de pago");
assert.match(principal, /Transporte, permisos u otros/, "el documento no muestra costos adicionales");
assert.match(css, /@page\{size:A4/, "la impresión contractual no fija una página A4 estable");
assert.match(privacidad, /90 días[\s\S]*cinco años/, "falta una política operativa de conservación");
assert.match(terminos, /Cancelaciones, pagos y reembolsos/, "falta la política comercial inicial");
assert.match(libro, /garantias-reclamos\.html\?origen=libro-reclamaciones/, "el Libro no abre un expediente trazable");

console.log("Preparación de producción: contrato, identidad, conservación y reclamos verificados.");
