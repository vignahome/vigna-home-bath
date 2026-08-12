const assert = require("node:assert/strict");
const { crearLimitadorSolicitudes } = require("./server.js");
const firebase = require("./firebase.json");

function respuestaFalsa() {
  return {
    encabezados: {},
    estado: 200,
    cuerpo: null,
    setHeader(nombre, valor) { this.encabezados[nombre] = valor; },
    status(codigo) { this.estado = codigo; return this; },
    json(cuerpo) { this.cuerpo = cuerpo; return this; }
  };
}

const limitador = crearLimitadorSolicitudes({ maximo: 2, ventanaMs: 60000, nombre: "prueba" });
const solicitud = { ip: "127.0.0.1", socket: {} };
let siguientes = 0;
for (let indice = 0; indice < 3; indice += 1) {
  const respuesta = respuestaFalsa();
  limitador(solicitud, respuesta, () => { siguientes += 1; });
  if (indice < 2) assert.equal(respuesta.estado, 200);
  else {
    assert.equal(respuesta.estado, 429);
    assert.match(respuesta.cuerpo.error, /Demasiadas solicitudes/);
    assert.ok(respuesta.encabezados["Retry-After"]);
  }
}
assert.equal(siguientes, 2, "el límite permitió una solicitud adicional");

const encabezados = firebase.hosting.headers.find((regla) => regla.source === "**")?.headers || [];
const nombres = new Set(encabezados.map((item) => item.key));
["Permissions-Policy", "Referrer-Policy", "X-Content-Type-Options", "X-Frame-Options"].forEach((nombre) => {
  assert.ok(nombres.has(nombre), `falta el encabezado ${nombre} en Hosting`);
});

console.log("Seguridad de producción: límites de abuso y encabezados defensivos verificados.");
