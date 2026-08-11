const fs = require("node:fs");
const assert = require("node:assert/strict");
const { validarDatosPagoPlan, sumarMeses } = require("./server.js");

const servidor = fs.readFileSync("server.js", "utf8");
const firebase = fs.readFileSync("mvp-profesionales-firebase.js", "utf8");
const interfaz = fs.readFileSync("mvp-profesionales-cloud-ui.js", "utf8");
const aplicacion = fs.readFileSync("mvp-profesionales.js", "utf8");
const reglas = fs.readFileSync("firestore.rules", "utf8");

const pagoValido = validarDatosPagoPlan({
  status: "approved",
  currency_id: "PEN",
  transaction_amount: 39.9,
  external_reference: "profesional_123",
  metadata: { tipo_pago: "plan_profesional", plan_id: "mensual", profesional_uid: "profesional_123" }
});
assert.equal(pagoValido.valido, true);
assert.equal(pagoValido.planId, "mensual");

assert.equal(validarDatosPagoPlan({
  status: "rejected",
  currency_id: "PEN",
  transaction_amount: 39.9,
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

assert.match(servidor, /verifyIdToken\(token, true\)/, "el servidor debe verificar una sesión Firebase vigente");
assert.match(servidor, /procesarPagoPlanProfesional/, "falta el procesador idempotente de planes");
assert.match(servidor, /pagoAnterior\.estado !== "approved"/, "falta protección contra activaciones duplicadas");
assert.match(servidor, /tipo_pago === "plan_profesional"/, "el webhook no separa los pagos de planes");
assert.match(firebase, /Authorization: `Bearer \$\{idToken\}`/, "el navegador no autentica el pago");
assert.match(firebase, /isNativePlatform/, "la app nativa debe separar la facturación de tienda");
assert.match(interfaz, /verificarPagoPlanProfesional/, "falta verificar el retorno de Mercado Pago");
assert.match(reglas, /match \/pv_pagos_planes\/\{pagoId\}/, "faltan reglas de lectura de pagos de planes");
assert.match(reglas, /allow create, update, delete: if false;/, "el cliente no debe poder escribir pagos verificados");
assert.match(firebase, /profesionales = perfil\.exists\(\) \? \[\{ id: perfil\.id, \.\.\.perfil\.data\(\) \}\] : \[\]/, "el panel profesional debe cargar exclusivamente el perfil de la sesión");
assert.match(firebase, /usuarioUid: user\.uid/, "los datos deben identificar al usuario autenticado");
assert.match(aplicacion, /\(item\.uid \|\| item\.id\) === data\.usuarioUid/, "el panel debe seleccionar el perfil por UID autenticado");
assert.match(aplicacion, /No se mostrará información de otra cuenta/, "un perfil incompleto debe fallar de forma segura");

console.log("Pagos de planes: autenticación, verificación, idempotencia y separación móvil verificadas.");
