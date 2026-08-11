const fs = require("node:fs");
const assert = require("node:assert/strict");
const { validarDatosPagoPlan, sumarMeses, obtenerOrigenRetorno } = require("./server.js");

const servidor = fs.readFileSync("server.js", "utf8");
const firebase = fs.readFileSync("mvp-profesionales-firebase.js", "utf8");
const interfaz = fs.readFileSync("mvp-profesionales-cloud-ui.js", "utf8");
const aplicacion = fs.readFileSync("mvp-profesionales.js", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");

const pagoValido = validarDatosPagoPlan({
  status: "approved",
  currency_id: "PEN",
  transaction_amount: 19.9,
  external_reference: "profesional_123",
  metadata: { tipo_pago: "plan_profesional", plan_id: "mensual", profesional_uid: "profesional_123" }
});
assert.equal(pagoValido.valido, true);
assert.equal(pagoValido.planId, "mensual");

assert.equal(validarDatosPagoPlan({
  status: "rejected",
  currency_id: "PEN",
  transaction_amount: 19.9,
  external_reference: "profesional_123",
  metadata: { tipo_pago: "plan_profesional", plan_id: "mensual", profesional_uid: "profesional_123" }
}).valido, false);
assert.equal(validarDatosPagoPlan({
  status: "approved",
  currency_id: "PEN",
  transaction_amount: 1,
  metadata: { plan_id: "mensual", profesional_uid: "profesional_123" }
}).valido, false);
assert.equal(sumarMeses("2026-01-15T00:00:00.000Z", 1).toISOString(), "2026-02-15T00:00:00.000Z");
assert.equal(sumarMeses("2026-01-15T00:00:00.000Z", 7).toISOString(), "2026-08-15T00:00:00.000Z");
assert.equal(sumarMeses("2026-01-15T00:00:00.000Z", 14).toISOString(), "2027-03-15T00:00:00.000Z");
assert.deepEqual(require("./server.js").PLANES.semestral, { id: "semestral", nombre: "VIGNA Profesional Semestral + 1 mes gratis", precio: 99.9, meses: 7 });
assert.deepEqual(require("./server.js").PLANES.anual, { id: "anual", nombre: "VIGNA Profesional Anual + 2 meses gratis", precio: 199.9, meses: 14 });
assert.equal(obtenerOrigenRetorno("https://vigna-plomeros.web.app"), "https://vigna-plomeros.web.app");
assert.equal(obtenerOrigenRetorno("https://vigna-plomeros.firebaseapp.com/"), "https://vigna-plomeros.firebaseapp.com");
assert.notEqual(obtenerOrigenRetorno("https://sitio-malicioso.example"), "https://sitio-malicioso.example");

assert.match(servidor, /verifyIdToken\(token, true\)/, "el servidor debe verificar una sesión Firebase vigente");
assert.match(servidor, /https:\/\/vigna-plomeros\.web\.app/, "el Hosting oficial debe estar autorizado por CORS");
assert.match(servidor, /https:\/\/vigna-plomeros\.firebaseapp\.com/, "el dominio alternativo de Firebase debe estar autorizado por CORS");
assert.match(servidor, /obtenerOrigenRetorno\(req\.headers\.origin\)/, "el pago debe regresar al mismo origen autorizado para conservar la sesión");
assert.match(servidor, /success: `\$\{origenRetorno\}\/mvp-profesionales\.html\?pagoPlan=retorno`/, "el retorno aprobado no debe cambiar de dominio");
assert.match(servidor, /procesarPagoPlanProfesional/, "falta el procesador idempotente de planes");
assert.match(servidor, /pagoAnterior\.estado !== "approved"/, "falta protección contra activaciones duplicadas");
assert.match(servidor, /tipo_pago === "plan_profesional"/, "el webhook no separa los pagos de planes");
assert.match(firebase, /Authorization: `Bearer \$\{idToken\}`/, "el navegador no autentica el pago");
assert.match(firebase, /isNativePlatform/, "la app nativa debe separar la facturación de tienda");
assert.match(interfaz, /verificarPagoPlanProfesional/, "falta verificar el retorno de Mercado Pago");
assert.match(reglas, /match \/pv_pagos_planes\/\{pagoId\}/, "faltan reglas de lectura de pagos de planes");
assert.match(reglas, /allow create, update, delete: if false;/, "el cliente no debe poder escribir pagos verificados");
assert.match(firebase, /if \(!perfil\.exists\(\)\)[\s\S]*usuarioUid: user\.uid[\s\S]*solicitudes: \[\]/, "un perfil incompleto debe cargar sin consultar datos privados ni fallar todo el catálogo");
assert.match(firebase, /usuarioUid: user\.uid/, "los datos deben identificar al usuario autenticado");
assert.match(aplicacion, /\(item\.uid \|\| item\.id\) === data\.usuarioUid/, "el panel debe seleccionar el perfil por UID autenticado");
assert.match(aplicacion, /No se mostrará información de otra cuenta/, "un perfil incompleto debe fallar de forma segura");
assert.match(aplicacion, /estado === "Activo" && Number\.isFinite\(vencimiento\) && vencimiento > Date\.now\(\)/, "un plan solo debe figurar activo con estado y vencimiento vigentes");
assert.match(firebase, /registroIncompleto: true/, "la carga debe identificar registros profesionales incompletos");
assert.match(interfaz, /datos\?\.registroIncompleto && rolActual === "profesional"/, "la cuenta incompleta debe poder reabrir el registro profesional");

console.log("Pagos de planes: autenticación, verificación, idempotencia y separación móvil verificadas.");
