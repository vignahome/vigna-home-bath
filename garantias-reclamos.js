import { db, auth, storage } from "./firebase.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";

const COLECCIONES = Object.freeze({
  usuarios: "pv_usuarios",
  contratos: "pv_contratos",
  reclamos: "pv_reclamos",
  notificaciones: "pv_notificaciones",
  auditoria: "pv_auditoria"
});

const ROLES_VALIDOS = ["cliente", "profesional", "admin"];
const ESTADOS = ["Abierto", "Respondido", "En revisión", "Resuelto", "Cerrado"];
const MAX_ARCHIVOS = 6;
const MAX_ARCHIVO_BYTES = 25 * 1024 * 1024;

const estado = {
  usuario: null,
  rol: "publico",
  contratos: [],
  reclamos: [],
  notificaciones: [],
  cargando: false
};

let detenerReclamos = null;
let detenerContratos = null;

const elementos = {
  acceso: document.getElementById("acceso"),
  accesoDenegado: document.getElementById("accesoDenegado"),
  modulo: document.getElementById("modulo"),
  estadoSesion: document.getElementById("estadoSesion"),
  cerrarSesion: document.getElementById("cerrarSesion"),
  formAcceso: document.getElementById("formAcceso"),
  correoUsuario: document.getElementById("correoUsuario"),
  etiquetaRol: document.getElementById("etiquetaRol"),
  explicacionRol: document.getElementById("explicacionRol"),
  metricas: document.getElementById("metricas"),
  zonaNuevoReclamo: document.getElementById("zonaNuevoReclamo"),
  formReclamo: document.getElementById("formReclamo"),
  contratoReclamo: document.getElementById("contratoReclamo"),
  filtroEstado: document.getElementById("filtroEstado"),
  tituloListado: document.getElementById("tituloListado"),
  listaReclamos: document.getElementById("listaReclamos"),
  mensaje: document.getElementById("mensaje")
};

function ahora() {
  return new Date().toISOString();
}

function escapar(valor = "") {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[caracter]);
}

function fechaLegible(valor) {
  if (!valor) return "Fecha no disponible";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return String(valor);
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(fecha);
}

function textoFormulario(form, nombre) {
  const control = form?.elements?.namedItem(nombre);
  return String(control?.value || "").trim();
}

function mostrarMensaje(texto, error = false) {
  elementos.mensaje.textContent = texto;
  elementos.mensaje.classList.toggle("error", error);
  elementos.mensaje.hidden = false;
  window.clearTimeout(mostrarMensaje.temporizador);
  mostrarMensaje.temporizador = window.setTimeout(() => {
    elementos.mensaje.hidden = true;
  }, 5200);
}

function bloquear(form, activo) {
  form?.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = activo;
  });
}

function mensajeError(error) {
  const codigo = String(error?.code || "");
  const mensajes = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/invalid-email": "El correo electrónico no es válido.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos y vuelve a intentar.",
    "permission-denied": "Tu cuenta no tiene permiso para realizar esta acción.",
    "storage/unauthorized": "No tienes permiso para acceder a este archivo privado."
  };
  return mensajes[codigo] || error?.message || "No se pudo completar la operación.";
}

async function obtenerRol(uid) {
  if (!uid) return "publico";
  if ((await getDoc(doc(db, "admins", uid))).exists()) return "admin";
  const perfil = await getDoc(doc(db, COLECCIONES.usuarios, uid));
  return perfil.exists() ? String(perfil.data().rol || "sin_perfil") : "sin_perfil";
}

async function obtenerPorCampo(coleccion, campo, valor) {
  const snapshot = await getDocs(query(collection(db, coleccion), where(campo, "==", valor)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

function entradaHistorial(accion, detalle = "") {
  return {
    accion,
    actorUid: estado.usuario.uid,
    rol: estado.rol,
    fecha: ahora(),
    detalle
  };
}

function datosAuditoria(accion, detalle, participantes = []) {
  return {
    accion,
    detalle,
    actorUid: estado.usuario.uid,
    actorEmail: estado.usuario.email || "",
    participantes: [...new Set([estado.usuario.uid, ...participantes.filter(Boolean)])],
    fecha: ahora()
  };
}

function datosNotificacion({ tipo, reclamoId, contratoId, destinatarioUid = "", destinatarioRol, titulo, mensaje }) {
  return {
    tipo,
    reclamoId,
    contratoId,
    actorUid: estado.usuario.uid,
    destinatarioUid,
    destinatarioRol,
    titulo,
    mensaje,
    leida: false,
    leidaEn: "",
    creadoEn: ahora()
  };
}

function agregarNotificacion(escritor, datos) {
  escritor.set(doc(collection(db, COLECCIONES.notificaciones)), datosNotificacion(datos));
}

async function guardarNotificaciones(lista) {
  if (!lista.length) return;
  const lote = writeBatch(db);
  lista.forEach((item) => agregarNotificacion(lote, item));
  try {
    await lote.commit();
  } catch (error) {
    console.warn("La operación principal se completó, pero las notificaciones todavía no están habilitadas en Firebase.", error);
  }
}

function validarArchivos(listaArchivos) {
  const archivos = Array.from(listaArchivos || []);
  if (archivos.length > MAX_ARCHIVOS) throw new Error(`Solo puedes adjuntar hasta ${MAX_ARCHIVOS} archivos.`);
  archivos.forEach((archivo) => {
    if (archivo.size > MAX_ARCHIVO_BYTES) throw new Error(`${archivo.name} supera el máximo de 25 MB.`);
    const permitido = archivo.type.startsWith("image/") || archivo.type.startsWith("video/") || archivo.type === "application/pdf";
    if (!permitido) throw new Error(`${archivo.name} no es una imagen, video o PDF permitido.`);
  });
  return archivos;
}

function limpiarNombre(nombre) {
  return String(nombre || "archivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-110);
}

async function subirArchivos(reclamoId, listaArchivos) {
  const archivos = validarArchivos(listaArchivos);
  const resultados = [];
  for (let indice = 0; indice < archivos.length; indice += 1) {
    const archivo = archivos[indice];
    const ruta = `profesionales-vigna/reclamos/${reclamoId}/${estado.usuario.uid}/${Date.now()}-${indice}-${limpiarNombre(archivo.name)}`;
    const resultado = await uploadBytes(ref(storage, ruta), archivo, {
      contentType: archivo.type,
      customMetadata: {
        propietarioUid: estado.usuario.uid,
        reclamoId
      }
    });
    resultados.push({
      ruta: resultado.ref.fullPath,
      nombre: archivo.name,
      tipo: archivo.type,
      tamano: archivo.size,
      subidoPorUid: estado.usuario.uid,
      subidoEn: ahora()
    });
  }
  return resultados;
}

function contratoNombre(contrato) {
  return contrato.profesion || contrato.opcion || contrato.detalle || "Servicio profesional";
}

function vencimientoGarantia(contrato) {
  if (contrato.garantiaVenceEn) {
    const fecha = new Date(contrato.garantiaVenceEn);
    if (!Number.isNaN(fecha.getTime())) return fecha;
  }
  const dias = Number(contrato.garantiaDias || 0);
  const base = contrato.garantiaInicioEn || contrato.cerradoEn || contrato.actualizadoEn;
  const inicio = new Date(base || "");
  if (dias > 0 && !Number.isNaN(inicio.getTime())) {
    return new Date(inicio.getTime() + dias * 24 * 60 * 60 * 1000);
  }
  return null;
}

function garantiaVigente(contrato) {
  const vencimiento = vencimientoGarantia(contrato);
  return !vencimiento || vencimiento.getTime() >= Date.now();
}

function tieneReclamoActivo(contratoId) {
  return estado.reclamos.some((reclamo) => reclamo.contratoId === contratoId && reclamo.estado !== "Cerrado");
}

function contratoDisponibleParaReclamo(contrato) {
  return contrato.estado === "Cerrado" && garantiaVigente(contrato) && !tieneReclamoActivo(contrato.id);
}

function etiquetaGarantia(contrato) {
  const vencimiento = vencimientoGarantia(contrato);
  if (!vencimiento) return "Garantía sin plazo estructurado";
  return `Garantía hasta ${new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(vencimiento)}`;
}

async function cargarDatos() {
  if (!estado.usuario || !ROLES_VALIDOS.includes(estado.rol)) return;
  estado.cargando = true;
  renderizarLista();
  try {
    if (estado.rol === "admin") {
      const snapshot = await getDocs(collection(db, COLECCIONES.reclamos));
      estado.reclamos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      estado.contratos = [];
    } else {
      const campo = estado.rol === "cliente" ? "clienteUid" : "profesionalUid";
      const tareas = [obtenerPorCampo(COLECCIONES.reclamos, campo, estado.usuario.uid)];
      if (estado.rol === "cliente") tareas.push(obtenerPorCampo(COLECCIONES.contratos, "clienteUid", estado.usuario.uid));
      const resultados = await Promise.all(tareas);
      estado.reclamos = resultados[0];
      estado.contratos = estado.rol === "cliente" ? resultados[1] : [];
    }
    estado.reclamos.sort((a, b) => String(b.actualizadoEn || b.creadoEn || "").localeCompare(String(a.actualizadoEn || a.creadoEn || "")));
  } finally {
    estado.cargando = false;
  }
  renderizar();
}

function detenerActualizaciones() {
  if (detenerReclamos) detenerReclamos();
  if (detenerContratos) detenerContratos();
  detenerReclamos = null;
  detenerContratos = null;
}

function ordenarReclamos(reclamos) {
  return reclamos.sort((a, b) => String(b.actualizadoEn || b.creadoEn || "").localeCompare(String(a.actualizadoEn || a.creadoEn || "")));
}

function suscribirActualizaciones() {
  detenerActualizaciones();
  if (!estado.usuario || !ROLES_VALIDOS.includes(estado.rol)) return;

  const reclamosConsulta = estado.rol === "admin"
    ? collection(db, COLECCIONES.reclamos)
    : query(
      collection(db, COLECCIONES.reclamos),
      where(estado.rol === "cliente" ? "clienteUid" : "profesionalUid", "==", estado.usuario.uid)
    );

  detenerReclamos = onSnapshot(reclamosConsulta, (snapshot) => {
    estado.reclamos = ordenarReclamos(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    renderizar();
  }, (error) => {
    console.error("No se pudo actualizar Asistencia en tiempo real", error);
  });

  if (estado.rol === "cliente") {
    const contratosConsulta = query(
      collection(db, COLECCIONES.contratos),
      where("clienteUid", "==", estado.usuario.uid)
    );
    detenerContratos = onSnapshot(contratosConsulta, (snapshot) => {
      estado.contratos = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderizar();
    }, (error) => {
      console.error("No se pudieron actualizar los contratos en tiempo real", error);
    });
  }
}

function configurarSesionVisual() {
  const autenticado = Boolean(estado.usuario);
  const autorizado = autenticado && ROLES_VALIDOS.includes(estado.rol);
  elementos.acceso.hidden = autenticado;
  elementos.accesoDenegado.hidden = !autenticado || autorizado;
  elementos.modulo.hidden = !autorizado;
  elementos.cerrarSesion.hidden = !autenticado;

  if (!autenticado) {
    elementos.estadoSesion.innerHTML = "<div><strong>Sesión requerida</strong><small>Ingresa para consultar expedientes privados.</small></div>";
    return;
  }
  if (!autorizado) {
    elementos.estadoSesion.innerHTML = `<div><strong>Perfil no autorizado</strong><small>${escapar(estado.usuario.email || "Cuenta autenticada")}</small></div>`;
    return;
  }
  elementos.estadoSesion.innerHTML = `<div><strong>Firebase activo · ${escapar(estado.rol)}</strong><small>${escapar(estado.usuario.email || "Cuenta autenticada")}</small></div>`;
  elementos.etiquetaRol.textContent = estado.rol;
  elementos.correoUsuario.textContent = estado.usuario.email || "Cuenta autenticada";
  const explicaciones = {
    cliente: "Puedes abrir expedientes de tus contratos cerrados y aceptar una solución.",
    profesional: "Puedes revisar y responder reclamos vinculados a tus servicios.",
    admin: "Puedes revisar todos los expedientes, mediar y emitir resoluciones."
  };
  elementos.explicacionRol.textContent = explicaciones[estado.rol];
  elementos.zonaNuevoReclamo.hidden = estado.rol !== "cliente";
  elementos.tituloListado.textContent = estado.rol === "admin" ? "Todos los expedientes" : "Mis expedientes";
}

function renderizarMetricas() {
  const total = estado.reclamos.length;
  const activos = estado.reclamos.filter((item) => !["Resuelto", "Cerrado"].includes(item.estado)).length;
  const revision = estado.reclamos.filter((item) => item.estado === "En revisión").length;
  const cerrados = estado.reclamos.filter((item) => item.estado === "Cerrado").length;
  elementos.metricas.innerHTML = [
    ["Expedientes", total],
    ["En atención", activos],
    ["En revisión", revision],
    ["Cerrados", cerrados]
  ].map(([etiqueta, valor]) => `<div class="gr-metric"><small>${etiqueta}</small><strong>${valor}</strong></div>`).join("");
}

function renderizarContratos() {
  if (estado.rol !== "cliente") return;
  const disponibles = estado.contratos.filter(contratoDisponibleParaReclamo);
  elementos.contratoReclamo.innerHTML = disponibles.length
    ? `<option value="">Selecciona un contrato</option>${disponibles.map((contrato) => `<option value="${escapar(contrato.id)}">${escapar(contrato.id)} · ${escapar(contratoNombre(contrato))} · ${escapar(etiquetaGarantia(contrato))}</option>`).join("")}`
    : '<option value="">No tienes contratos con garantía disponible</option>';
  elementos.formReclamo.querySelector('button[type="submit"]').disabled = !disponibles.length;
}

function historialHtml(reclamo) {
  const historial = Array.isArray(reclamo.historial) ? reclamo.historial : [];
  if (!historial.length) return "";
  return `<div class="gr-history"><h4>Historial verificable</h4>${historial.slice().reverse().map((item) => `
    <div class="gr-history-item">
      <strong>${escapar(item.accion || "Actualización")}</strong>
      <span>${escapar(fechaLegible(item.fecha))} · ${escapar(item.rol || "sistema")}${item.detalle ? ` · ${escapar(item.detalle)}` : ""}</span>
    </div>`).join("")}</div>`;
}

function archivosHtml(reclamo) {
  const archivos = [
    ...(Array.isArray(reclamo.archivosCliente) ? reclamo.archivosCliente : []),
    ...(Array.isArray(reclamo.archivosProfesional) ? reclamo.archivosProfesional : [])
  ];
  if (!archivos.length) return "";
  return `<div class="gr-files">${archivos.map((archivo, indice) => `
    <button class="gr-button" type="button" data-abrir-archivo="${escapar(archivo.ruta)}">Abrir evidencia ${indice + 1}: ${escapar(archivo.nombre || "archivo")}</button>
  `).join("")}</div>`;
}

function accionesHtml(reclamo) {
  if (estado.rol === "profesional" && ["Abierto", "En revisión"].includes(reclamo.estado)) {
    return `<form class="gr-action" data-form-respuesta="${escapar(reclamo.id)}">
      <label>Respuesta al cliente<textarea name="respuesta" required minlength="10" maxlength="2500" placeholder="Explica la solución, visita o corrección que propones."></textarea></label>
      <label>Evidencias privadas<input name="archivos" type="file" multiple accept="image/*,video/*,application/pdf"><small>Hasta 6 archivos, máximo 25 MB cada uno.</small></label>
      <div class="gr-action-buttons"><button class="gr-button gr-primary" type="submit">Enviar respuesta</button></div>
    </form>`;
  }
  if (estado.rol === "admin" && reclamo.estado !== "Cerrado") {
    return `<form class="gr-action" data-form-resolucion="${escapar(reclamo.id)}">
      <label>Actuación o resolución administrativa<textarea name="resolucion" required minlength="10" maxlength="2500" placeholder="Registra la mediación, decisión o motivo del cambio de estado.">${escapar(reclamo.resolucionAdmin || "")}</textarea></label>
      <div class="gr-action-buttons">
        <button class="gr-button" name="accion" value="revision" type="submit">Pasar a revisión</button>
        <button class="gr-button gr-primary" name="accion" value="resolver" type="submit">Marcar resuelto</button>
        <button class="gr-button gr-danger" name="accion" value="cerrar" type="submit">Cerrar sin aceptación del cliente</button>
      </div>
    </form>`;
  }
  if (estado.rol === "cliente" && reclamo.estado === "Resuelto") {
    return `<div class="gr-action"><p>Si la solución fue cumplida, puedes aceptarla y cerrar definitivamente el expediente.</p><div class="gr-action-buttons"><button class="gr-button gr-primary" type="button" data-cerrar-reclamo="${escapar(reclamo.id)}">Aceptar solución y cerrar</button></div></div>`;
  }
  return "";
}

function reclamoHtml(reclamo) {
  const respuesta = reclamo.respuestaProfesional
    ? `<div class="gr-copy-box"><strong>Respuesta profesional</strong><p>${escapar(reclamo.respuestaProfesional)}</p></div>`
    : "";
  const resolucion = reclamo.resolucionAdmin
    ? `<div class="gr-copy-box"><strong>Resolución administrativa</strong><p>${escapar(reclamo.resolucionAdmin)}</p></div>`
    : "";
  return `<article class="gr-case">
    <div class="gr-case-head">
      <div><p class="gr-eyebrow">${escapar(reclamo.categoria || "RECLAMO")}</p><h3>${escapar(reclamo.categoria || "Expediente de servicio")}</h3><div class="gr-case-id">Expediente ${escapar(reclamo.id)}</div></div>
      <span class="gr-status" data-state="${escapar(reclamo.estado || "Abierto")}">${escapar(reclamo.estado || "Abierto")}</span>
    </div>
    <div class="gr-case-meta"><span>Contrato: ${escapar(reclamo.contratoId || "—")}</span><span>Creado: ${escapar(fechaLegible(reclamo.creadoEn))}</span><span>Actualizado: ${escapar(fechaLegible(reclamo.actualizadoEn))}</span></div>
    <div class="gr-case-copy">
      <div class="gr-copy-box"><strong>Descripción</strong><p>${escapar(reclamo.descripcion || "Sin descripción")}</p></div>
      <div class="gr-copy-box"><strong>Solución solicitada</strong><p>${escapar(reclamo.solucionSolicitada || "Sin detalle")}</p></div>
      ${respuesta}${resolucion}
    </div>
    ${archivosHtml(reclamo)}
    ${historialHtml(reclamo)}
    ${accionesHtml(reclamo)}
  </article>`;
}

function renderizarLista() {
  if (estado.cargando) {
    elementos.listaReclamos.innerHTML = '<div class="gr-empty">Cargando expedientes protegidos…</div>';
    return;
  }
  const filtro = elementos.filtroEstado.value;
  const lista = filtro ? estado.reclamos.filter((reclamo) => reclamo.estado === filtro) : estado.reclamos;
  elementos.listaReclamos.innerHTML = lista.length
    ? lista.map(reclamoHtml).join("")
    : '<div class="gr-empty">No existen expedientes para esta vista.</div>';
}

function renderizar() {
  configurarSesionVisual();
  if (!estado.usuario || !ROLES_VALIDOS.includes(estado.rol)) return;
  renderizarMetricas();
  renderizarContratos();
  renderizarLista();
}

async function crearReclamo(form) {
  if (estado.rol !== "cliente") throw new Error("Solo un cliente puede abrir un expediente.");
  const contratoId = textoFormulario(form, "contratoId");
  const contrato = estado.contratos.find((item) => item.id === contratoId);
  if (!contrato || contrato.estado !== "Cerrado" || contrato.clienteUid !== estado.usuario.uid) {
    throw new Error("El contrato cerrado seleccionado no es válido.");
  }
  if (!garantiaVigente(contrato)) throw new Error("La garantía de este contrato ya venció.");
  if (tieneReclamoActivo(contrato.id)) throw new Error("Este contrato ya tiene un expediente activo. Debes cerrarlo antes de abrir otro.");
  const descripcion = textoFormulario(form, "descripcion");
  const solucionSolicitada = textoFormulario(form, "solucionSolicitada");
  if (descripcion.length < 20 || solucionSolicitada.length < 10) throw new Error("Completa la descripción y la solución solicitada.");
  const archivosSeleccionados = validarArchivos(form.elements.archivos.files);
  const reclamoRef = doc(collection(db, COLECCIONES.reclamos));
  const creadoEn = ahora();
  const historial = [entradaHistorial("Expediente abierto")];
  const reclamo = {
    contratoId: contrato.id,
    solicitudId: contrato.solicitudId || "",
    cotizacionId: contrato.cotizacionId || "",
    clienteUid: estado.usuario.uid,
    profesionalUid: contrato.profesionalUid,
    categoria: textoFormulario(form, "categoria"),
    descripcion,
    solucionSolicitada,
    estado: "Abierto",
    archivosCliente: [],
    archivosProfesional: [],
    respuestaProfesional: "",
    resolucionAdmin: "",
    historial,
    creadoEn,
    actualizadoEn: creadoEn
  };
  const lote = writeBatch(db);
  lote.set(reclamoRef, reclamo);
  lote.set(doc(collection(db, COLECCIONES.auditoria)), datosAuditoria("Reclamo abierto", `${reclamoRef.id} · contrato ${contrato.id}`, [contrato.profesionalUid]));
  await lote.commit();
  await guardarNotificaciones([
    {
      tipo: "reclamo_abierto", reclamoId: reclamoRef.id, contratoId: contrato.id,
      destinatarioUid: contrato.profesionalUid, destinatarioRol: "profesional",
      titulo: "Nuevo reclamo recibido", mensaje: "Un cliente abrió un expediente vinculado a uno de tus contratos cerrados."
    },
    {
      tipo: "reclamo_abierto", reclamoId: reclamoRef.id, contratoId: contrato.id,
      destinatarioRol: "admin", titulo: "Nuevo reclamo para revisión",
      mensaje: "Se registró un nuevo expediente que requiere seguimiento administrativo."
    }
  ]);

  if (archivosSeleccionados.length) {
    const archivos = await subirArchivos(reclamoRef.id, archivosSeleccionados);
    await runTransaction(db, async (transaccion) => {
      const actual = await transaccion.get(reclamoRef);
      if (!actual.exists() || actual.data().estado !== "Abierto") throw new Error("El expediente cambió mientras se cargaban las evidencias.");
      const siguienteHistorial = [...(actual.data().historial || []), entradaHistorial("Evidencias iniciales adjuntadas", `${archivos.length} archivo(s)`)];
      transaccion.update(reclamoRef, { archivosCliente: archivos, historial: siguienteHistorial, actualizadoEn: ahora() });
      transaccion.set(doc(collection(db, COLECCIONES.auditoria)), datosAuditoria("Evidencias de reclamo adjuntadas", `${reclamoRef.id}: ${archivos.length}`, [contrato.profesionalUid]));
    });
  }
  form.reset();
  mostrarMensaje("Expediente registrado y protegido correctamente.");
  await cargarDatos();
}

async function responderReclamo(form) {
  if (estado.rol !== "profesional") throw new Error("Solo el profesional vinculado puede responder.");
  const reclamoId = form.dataset.formRespuesta;
  const respuesta = textoFormulario(form, "respuesta");
  if (respuesta.length < 10) throw new Error("La respuesta debe tener al menos 10 caracteres.");
  const archivos = await subirArchivos(reclamoId, form.elements.archivos.files);
  const reclamoRef = doc(db, COLECCIONES.reclamos, reclamoId);
  let reclamoActual = null;
  await runTransaction(db, async (transaccion) => {
    const snapshot = await transaccion.get(reclamoRef);
    if (!snapshot.exists()) throw new Error("El expediente ya no existe.");
    const actual = snapshot.data();
    reclamoActual = actual;
    if (actual.profesionalUid !== estado.usuario.uid || !["Abierto", "En revisión"].includes(actual.estado)) {
      throw new Error("El expediente ya no admite una respuesta profesional.");
    }
    const historial = [...(actual.historial || []), entradaHistorial("Respuesta profesional registrada", archivos.length ? `${archivos.length} evidencia(s)` : "Sin archivos")];
    transaccion.update(reclamoRef, {
      respuestaProfesional: respuesta,
      archivosProfesional: archivos,
      estado: "Respondido",
      historial,
      actualizadoEn: ahora()
    });
    transaccion.set(doc(collection(db, COLECCIONES.auditoria)), datosAuditoria("Respuesta profesional registrada", reclamoId, [actual.clienteUid]));
  });
  await guardarNotificaciones([
    {
      tipo: "respuesta_profesional", reclamoId, contratoId: reclamoActual.contratoId,
      destinatarioUid: reclamoActual.clienteUid, destinatarioRol: "cliente",
      titulo: "El profesional respondió", mensaje: "Tu reclamo recibió una respuesta profesional y ya puede ser revisado."
    },
    {
      tipo: "respuesta_profesional", reclamoId, contratoId: reclamoActual.contratoId,
      destinatarioRol: "admin", titulo: "Respuesta profesional registrada",
      mensaje: "El profesional respondió un expediente pendiente de revisión administrativa."
    }
  ]);
  mostrarMensaje("Respuesta profesional guardada.");
  await cargarDatos();
}

async function resolverReclamo(form, accion) {
  if (estado.rol !== "admin") throw new Error("Se requiere autorización administrativa.");
  const reclamoId = form.dataset.formResolucion;
  const resolucion = textoFormulario(form, "resolucion");
  if (resolucion.length < 10) throw new Error("Registra una actuación administrativa clara.");
  const estadosPorAccion = { revision: "En revisión", resolver: "Resuelto", cerrar: "Cerrado" };
  const nuevoEstado = estadosPorAccion[accion];
  if (!nuevoEstado) throw new Error("La acción administrativa no es válida.");
  const reclamoRef = doc(db, COLECCIONES.reclamos, reclamoId);
  let reclamoActual = null;
  let tituloNotificacion = "";
  let mensajeNotificacion = "";
  await runTransaction(db, async (transaccion) => {
    const snapshot = await transaccion.get(reclamoRef);
    if (!snapshot.exists()) throw new Error("El expediente ya no existe.");
    const actual = snapshot.data();
    reclamoActual = actual;
    if (actual.estado === "Cerrado") throw new Error("Un expediente cerrado no se puede modificar.");
    const accionHistorial = nuevoEstado === "En revisión"
      ? "Revisión administrativa iniciada"
      : nuevoEstado === "Resuelto"
        ? "Resolución administrativa emitida"
        : "Expediente cerrado por administración";
    const historial = [...(actual.historial || []), entradaHistorial(accionHistorial)];
    transaccion.update(reclamoRef, { estado: nuevoEstado, resolucionAdmin: resolucion, historial, actualizadoEn: ahora() });
    transaccion.set(doc(collection(db, COLECCIONES.auditoria)), datosAuditoria(accionHistorial, reclamoId, [actual.clienteUid, actual.profesionalUid]));
    tituloNotificacion = nuevoEstado === "En revisión" ? "Reclamo en revisión" : nuevoEstado === "Resuelto" ? "Reclamo resuelto" : "Expediente cerrado";
    mensajeNotificacion = nuevoEstado === "En revisión"
      ? "Administración inició la revisión formal del expediente."
      : nuevoEstado === "Resuelto"
        ? "Administración emitió una resolución. El cliente puede aceptar la solución y cerrar."
        : "Administración cerró el expediente.";
  });
  await guardarNotificaciones([
    {
      tipo: `admin_${accion}`, reclamoId, contratoId: reclamoActual.contratoId,
      destinatarioUid: reclamoActual.clienteUid, destinatarioRol: "cliente", titulo: tituloNotificacion, mensaje: mensajeNotificacion
    },
    {
      tipo: `admin_${accion}`, reclamoId, contratoId: reclamoActual.contratoId,
      destinatarioUid: reclamoActual.profesionalUid, destinatarioRol: "profesional", titulo: tituloNotificacion, mensaje: mensajeNotificacion
    }
  ]);
  mostrarMensaje("Expediente actualizado por administración.");
  await cargarDatos();
}

async function cerrarReclamoCliente(reclamoId) {
  if (estado.rol !== "cliente") throw new Error("Solo el cliente vinculado puede aceptar la solución.");
  const reclamoRef = doc(db, COLECCIONES.reclamos, reclamoId);
  let reclamoActual = null;
  await runTransaction(db, async (transaccion) => {
    const snapshot = await transaccion.get(reclamoRef);
    if (!snapshot.exists()) throw new Error("El expediente ya no existe.");
    const actual = snapshot.data();
    reclamoActual = actual;
    if (actual.clienteUid !== estado.usuario.uid || actual.estado !== "Resuelto") {
      throw new Error("El expediente no está listo para el cierre del cliente.");
    }
    const historial = [...(actual.historial || []), entradaHistorial("Solución aceptada y expediente cerrado")];
    transaccion.update(reclamoRef, { estado: "Cerrado", historial, actualizadoEn: ahora() });
    transaccion.set(doc(collection(db, COLECCIONES.auditoria)), datosAuditoria("Reclamo cerrado por el cliente", reclamoId, [actual.profesionalUid]));
  });
  await guardarNotificaciones([
    {
      tipo: "cierre_cliente", reclamoId, contratoId: reclamoActual.contratoId,
      destinatarioUid: reclamoActual.profesionalUid, destinatarioRol: "profesional",
      titulo: "El cliente cerró el expediente", mensaje: "El cliente aceptó la solución y cerró el reclamo."
    },
    {
      tipo: "cierre_cliente", reclamoId, contratoId: reclamoActual.contratoId,
      destinatarioRol: "admin", titulo: "Expediente cerrado por el cliente",
      mensaje: "El cliente aceptó la solución y completó el cierre del expediente."
    }
  ]);
  mostrarMensaje("Solución aceptada. El expediente quedó cerrado.");
  await cargarDatos();
}

async function abrirArchivo(ruta) {
  if (!ruta) throw new Error("La evidencia no tiene una ruta válida.");
  const url = await getDownloadURL(ref(storage, ruta));
  const ventana = window.open(url, "_blank", "noopener,noreferrer");
  if (!ventana) mostrarMensaje("El navegador bloqueó la nueva pestaña. Habilita las ventanas emergentes para abrir la evidencia.", true);
}

elementos.formAcceso.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  bloquear(evento.currentTarget, true);
  try {
    await signInWithEmailAndPassword(auth, textoFormulario(evento.currentTarget, "correo"), textoFormulario(evento.currentTarget, "password"));
    evento.currentTarget.reset();
    mostrarMensaje("Sesión iniciada correctamente.");
  } catch (error) {
    mostrarMensaje(mensajeError(error), true);
  } finally {
    bloquear(evento.currentTarget, false);
  }
});

elementos.cerrarSesion.addEventListener("click", async () => {
  await signOut(auth);
  mostrarMensaje("Sesión cerrada.");
});

elementos.formReclamo.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  bloquear(evento.currentTarget, true);
  try {
    await crearReclamo(evento.currentTarget);
  } catch (error) {
    console.error(error);
    mostrarMensaje(mensajeError(error), true);
  } finally {
    bloquear(evento.currentTarget, false);
    renderizarContratos();
  }
});

elementos.filtroEstado.addEventListener("change", renderizarLista);

elementos.listaReclamos.addEventListener("submit", async (evento) => {
  const respuesta = evento.target.closest("[data-form-respuesta]");
  const resolucion = evento.target.closest("[data-form-resolucion]");
  if (!respuesta && !resolucion) return;
  evento.preventDefault();
  const accionAdministrativa = evento.submitter?.value;
  if (resolucion && accionAdministrativa === "cerrar" && !window.confirm("Este cierre omite la aceptación final del cliente. ¿Confirmas que administración debe cerrar el expediente directamente?")) return;
  bloquear(evento.target, true);
  try {
    if (respuesta) await responderReclamo(respuesta);
    if (resolucion) await resolverReclamo(resolucion, accionAdministrativa);
  } catch (error) {
    console.error(error);
    mostrarMensaje(mensajeError(error), true);
  } finally {
    bloquear(evento.target, false);
  }
});

elementos.listaReclamos.addEventListener("click", async (evento) => {
  const archivo = evento.target.closest("[data-abrir-archivo]");
  const cerrar = evento.target.closest("[data-cerrar-reclamo]");
  if (!archivo && !cerrar) return;
  try {
    if (archivo) await abrirArchivo(archivo.dataset.abrirArchivo);
    if (cerrar) {
      if (!window.confirm("¿Confirmas que la solución se cumplió y deseas cerrar el expediente?")) return;
      cerrar.disabled = true;
      await cerrarReclamoCliente(cerrar.dataset.cerrarReclamo);
    }
  } catch (error) {
    console.error(error);
    mostrarMensaje(mensajeError(error), true);
  } finally {
    if (cerrar) cerrar.disabled = false;
  }
});

onAuthStateChanged(auth, async (usuario) => {
  detenerActualizaciones();
  estado.usuario = usuario;
  estado.rol = usuario ? await obtenerRol(usuario.uid) : "publico";
  estado.contratos = [];
  estado.reclamos = [];
  estado.notificaciones = [];
  configurarSesionVisual();
  if (usuario && ROLES_VALIDOS.includes(estado.rol)) {
    try {
      await cargarDatos();
      suscribirActualizaciones();
    } catch (error) {
      console.error(error);
      mostrarMensaje(mensajeError(error), true);
      estado.cargando = false;
      renderizar();
    }
  }
});
