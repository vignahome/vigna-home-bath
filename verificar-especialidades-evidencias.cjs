const fs = require("node:fs");
const leer = (ruta) => fs.readFileSync(ruta, "utf8");
const html = leer("mvp-profesionales.html");
const interfaz = leer("mvp-profesionales.js");
const nube = leer("mvp-profesionales-cloud-ui.js");
const firebase = leer("mvp-profesionales-firebase.js");
const storage = leer("storage.rules");
const firestore = leer("firestore.rules");
const exigir = (valor, mensaje) => { if (!valor) throw new Error(`Verificación fallida: ${mensaje}`); };

exigir(html.includes('id="professionalSpecialties"'), "falta el editor de profesiones");
exigir(interfaz.includes("data-specialty-create"), "falta la opción para registrar profesiones en perfiles anteriores");
exigir(interfaz.includes("data-admin-migrate-specialties"), "administración no puede migrar profesiones de perfiles anteriores");
exigir(interfaz.includes("data-specialty-form"), "las profesiones no se editan por separado");
exigir(interfaz.includes("data-open-specialty-file"), "las constancias no son revisables");
exigir(firebase.includes("async function actualizarEspecialidad"), "falta actualización independiente");
exigir(firebase.includes("async function crearEspecialidad"), "falta creación independiente de profesiones");
exigir(firebase.includes("async function migrarProfesionesLegadas"), "falta migración administrativa de profesiones anteriores");
exigir(firebase.includes('actualizacion.estado = "Pendiente"'), "los cambios de evidencia no vuelven a revisión");
exigir(firebase.includes("async function abrirEvidenciaEspecialidad"), "falta apertura privada de evidencia");
exigir(nube.includes("api.actualizarEspecialidad"), "el editor no está conectado a Firebase");
exigir(nube.includes("api.crearEspecialidad"), "el registro de profesiones no está conectado a Firebase");
exigir(nube.includes("api.migrarProfesionesLegadas"), "la migración administrativa no está conectada a Firebase");
exigir(firestore.includes('allow create: if adminPuede("moderacion") || ('), "administración no puede crear profesiones pendientes durante la migración");
exigir(storage.includes("especialidades/{especialidadId}/{archivo}"), "faltan reglas de certificados privados");

console.log("Especialidades independientes y certificados privados: integración verificada.");
