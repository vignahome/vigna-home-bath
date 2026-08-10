const fs = require("node:fs");
const path = require("node:path");

const raiz = __dirname;
const leer = (archivo) => fs.readFileSync(path.join(raiz, archivo), "utf8");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`Verificación de guía fallida: ${mensaje}`);
};

const html = leer("mvp-profesionales.html");
const ui = leer("mvp-profesionales.js");
const nube = leer("mvp-profesionales-cloud-ui.js");
const firebase = leer("mvp-profesionales-firebase.js");
const firestore = leer("firestore.rules");

[
  'profesionesProfesional: "pv_profesiones_profesional"',
  'coberturas: "pv_coberturas"',
  'planesProfesionales: "pv_planes_profesionales"'
].forEach((marca) => exigir(firebase.includes(marca), `falta el modelo ${marca}`));

exigir(html.includes('name="coberturaDepartamentos"'), "la cobertura no guarda departamentos estructurados");
exigir(html.includes('name="coberturaProvincias"'), "la cobertura no guarda provincias estructuradas");
exigir(html.includes('name="coberturaDistritos"'), "la cobertura no guarda distritos estructurados");
exigir(html.includes('name="coberturaExclusiones"'), "la cobertura no permite exclusiones");
exigir(firebase.includes("const especialidades = profesiones.map"), "el registro no separa cada profesión");
exigir(firebase.includes("async function cambiarEstadoEspecialidad"), "administración no puede verificar profesiones por separado");
exigir(firestore.includes("match /pv_profesiones_profesional/{especialidadId}"), "faltan reglas por especialidad");
exigir(ui.includes("function puntajeRanking"), "falta el ranking ponderado");
exigir(ui.includes("* .30") && ui.includes("* .25") && ui.includes("* .20") && ui.includes("* .15") && ui.includes("* .10"), "el ranking no conserva los pesos de la guía");
exigir(ui.includes("function perfilPublicable"), "falta impedir perfiles sin aprobación o plan");
exigir(html.includes('data-request-plan="Mensual"') && html.includes('data-request-plan="Semestral"') && html.includes('data-request-plan="Anual"'), "faltan los tres planes acordados");
exigir(firebase.includes("async function solicitarPlanProfesional"), "el profesional no puede solicitar un plan");
exigir(firebase.includes("async function activarPlanProfesional"), "administración no puede activar un plan verificado");
exigir(nube.includes("api.cambiarEstadoEspecialidad") && nube.includes("api.solicitarPlanProfesional") && nube.includes("api.activarPlanProfesional"), "la interfaz no conecta verificación y planes con Firebase");

console.log("Guía Profesionales Vigna’s: base de especialidades, cobertura, ranking y planes verificada.");
