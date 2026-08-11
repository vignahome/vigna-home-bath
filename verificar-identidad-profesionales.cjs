const assert = require("node:assert/strict");
const fs = require("node:fs");

(async () => {
  const {
    normalizarPerfilPropio,
    normalizarPlanPropio,
    perfilProfesionalIncompleto,
    seleccionarPerfilProfesional
  } = await import("./mvp-profesionales-identidad.mjs");

  const uid = "profesional_pago_110826";
  const perfil = normalizarPerfilPropio({
    id: uid,
    data: { uid: "valor-legado-incorrecto", nombres: "Profesional correcto" }
  }, uid);
  assert.equal(perfil.id, uid, "el ID del documento debe ser el UID autenticado");
  assert.equal(perfil.uid, uid, "un UID legado no debe desplazar al propietario autenticado");
  assert.equal(perfilProfesionalIncompleto("profesional", uid, perfil), false,
    "un marcador antiguo no debe ocultar un perfil que existe");
  assert.equal(perfilProfesionalIncompleto("profesional", uid, null), true,
    "la ausencia real del documento debe abrir el registro incompleto");

  const ajeno = { id: "otro_uid", uid: "otro_uid", nombres: "Perfil ajeno" };
  assert.equal(seleccionarPerfilProfesional([ajeno, perfil], "profesional", uid), perfil,
    "el panel debe seleccionar únicamente el perfil del UID autenticado");
  assert.equal(seleccionarPerfilProfesional([ajeno], "profesional", uid), null,
    "el panel nunca debe usar el primer profesional disponible");
  assert.equal(normalizarPerfilPropio({ id: "otro_uid", data: perfil }, uid), null,
    "un documento ajeno debe ser rechazado");

  const plan = normalizarPlanPropio({ id: uid, profesionalUid: uid, estado: "Activo" }, uid);
  assert.equal(plan.profesionalUid, uid, "el plan aprobado debe conservar su propietario");
  assert.equal(normalizarPlanPropio({ id: uid, profesionalUid: "otro_uid" }, uid), null,
    "un plan de otra cuenta debe ser rechazado");

  const firebase = fs.readFileSync("mvp-profesionales-firebase.js", "utf8");
  const interfaz = fs.readFileSync("mvp-profesionales-cloud-ui.js", "utf8");
  const aplicacion = fs.readFileSync("mvp-profesionales.js", "utf8");
  const servidor = fs.readFileSync("server.js", "utf8");
  assert.match(firebase, /consultaSecundaria\([\s\S]*el catálogo público/,
    "un fallo del catálogo público no debe derribar el perfil propio");
  assert.match(firebase, /if \(perfilExistente\.exists\(\)\)[\s\S]*return perfilPropio;[\s\S]*estadoRegistro: "incompleto"/,
    "un nuevo envío del registro no debe sobrescribir un perfil ni su plan existentes");
  assert.match(interfaz, /cargaFallida: true[\s\S]*mvp\.setData\(datosSeguros\)/,
    "un fallo total debe reemplazar datos locales por un estado vacío seguro");
  assert.doesNotMatch(interfaz, /const actuales = mvp\.getData\(\)/,
    "un fallo remoto no debe reutilizar perfiles de una sesión o demo anterior");
  assert.doesNotMatch(aplicacion, /profesionales\s*\[\s*0\s*\]/,
    "ningún panel debe seleccionar automáticamente el primer profesional");
  assert.match(aplicacion, /function profesionPublica\(perfil\)[\s\S]*aprobadas\.includes\(perfil\.profesionPrincipal\)[\s\S]*aprobadas\[0\]/,
    "el catálogo debe sustituir una profesión principal todavía no verificada");
  assert.match(interfaz, /panel: rolActual === "cliente" \|\| rolActual === "profesional"/,
    "la cuenta administradora no debe abrir un panel profesional inexistente");
  assert.match(interfaz, /rolActual === "admin"[\s\S]*mvp\.mostrarVista\("admin"\)/,
    "la cuenta administradora debe entrar directamente a Administración");
  assert.match(servidor, /uidMetadata && uidReferencia && uidMetadata === uidReferencia/,
    "Mercado Pago debe coincidir en metadata y external_reference");
  assert.match(servidor, /pagoAnterior\.estado !== "approved"/,
    "un pago aprobado previamente no debe volver a extender el plan");
  assert.match(servidor, /propietario !== sesion\.uid/,
    "el retorno solo puede verificarse con la sesión que creó el pago");

  console.log("Identidad profesional: aislamiento por UID y degradación segura verificados.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
