const fs = require("node:fs");
const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const firebase = leer("mvp-profesionales-firebase.js");
const interfaz = leer("mvp-profesionales.js");
const nube = leer("mvp-profesionales-cloud-ui.js");
const firestore = leer("firestore.rules");
const storage = leer("storage.rules");
const exigir = (valor, mensaje) => { if (!valor) throw new Error(`Verificación fallida: ${mensaje}`); };

exigir(firebase.includes('mensajesContrato: "pv_mensajes_contrato"'), "falta la colección de mensajes");
exigir(firebase.includes('actuacionesContrato: "pv_actuaciones_contrato"'), "falta la colección de actuaciones");
exigir(firebase.includes("async function enviarMensajeContrato"), "falta mensajería contractual");
exigir(firebase.includes("async function solicitarActuacionContrato"), "faltan solicitudes de pausa y cancelación");
exigir(firebase.includes("async function resolverActuacionContrato"), "falta resolución administrativa");
exigir(interfaz.includes("Canal contractual"), "el canal no es visible dentro del contrato");
exigir(interfaz.includes("Pausa, reanudación o cancelación"), "faltan controles operativos");
exigir(nube.includes("api.enviarMensajeContrato"), "la mensajería no está conectada");
exigir(nube.includes("api.resolverActuacionContrato"), "la resolución no está conectada");
exigir(firestore.includes("match /pv_mensajes_contrato/{mensajeId}"), "faltan reglas de mensajes");
exigir(firestore.includes("match /pv_actuaciones_contrato/{actuacionId}"), "faltan reglas de actuaciones");
exigir(storage.includes("mensajes/{mensajeId}/{archivo}"), "faltan reglas de adjuntos de mensajes");

console.log("Mensajería, adjuntos y actuaciones contractuales: integración verificada.");
