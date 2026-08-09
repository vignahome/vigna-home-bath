import { ProfesionalesFirebase as api } from "./mvp-profesionales-firebase.js";

let rolActual = "publico";
let operacionEnCurso = false;
let notificacionesGlobales = [];
let usuarioNotificaciones = null;
let detenerActividad = null;
let temporizadorAvisoVivo = null;
let temporizadorSincronizacion = null;
let actividadInicializada = false;
let filtroNotificaciones = "todas";

const esperarMVP = () => window.VignaProfesionalesMVP
  ? Promise.resolve(window.VignaProfesionalesMVP)
  : new Promise((resolve) => window.addEventListener("vigna-mvp-ready", () => resolve(window.VignaProfesionalesMVP), { once: true }));

function mensaje(texto, esError = false) {
  const estado = document.getElementById("pvCloudStatus");
  if (estado) {
    estado.textContent = texto;
    estado.classList.toggle("error", esError);
  }
}

function bloquear(form, activo) {
  form?.querySelectorAll("button, input, select, textarea").forEach((elemento) => {
    if (elemento.type !== "reset") elemento.disabled = activo;
  });
}

function insertarAcceso() {
  const nav = document.getElementById("mainNav");
  if (!nav || document.getElementById("pvAccessButton")) return;
  const boton = document.createElement("button");
  boton.id = "pvAccessButton";
  boton.type = "button";
  boton.textContent = "Ingresar";
  boton.dataset.pvAccess = "true";
  nav.appendChild(boton);

  const estado = document.createElement("div");
  estado.id = "pvCloudStatus";
  estado.className = "pv-cloud-status";
  estado.textContent = "Conectando con Firebase…";
  document.body.appendChild(estado);

  const dialogo = document.createElement("dialog");
  dialogo.id = "pvAccessDialog";
  dialogo.className = "mvp-dialog pv-access-dialog";
  dialogo.innerHTML = `
    <button class="dialog-close" data-pv-close type="button" aria-label="Cerrar">×</button>
    <div class="page-intro compact"><p class="eyebrow">ACCESO SEGURO</p><h1>Ingresa a Profesionales Vigna’s</h1><p>Usa la cuenta registrada como cliente, profesional o administrador.</p></div>
    <form id="pvLoginForm" class="mini-form">
      <label>Correo electrónico<input name="correo" type="email" autocomplete="email" required></label>
      <label>Contraseña<input name="password" type="password" autocomplete="current-password" required></label>
      <button class="gold-button" type="submit">Ingresar</button>
    </form>
    <button id="pvLogoutButton" class="secondary-button" type="button" hidden>Cerrar sesión</button>`;
  document.body.appendChild(dialogo);
}

function asegurarAsistenciaFlotante() {
  const enlace = document.getElementById("pvAssistanceFab")
    || document.querySelector('.assistance-link[href="garantias-reclamos.html"]')
    || document.querySelector('#mainNav a[href="garantias-reclamos.html"]');
  if (!enlace) return;
  enlace.id = "pvAssistanceFab";
  enlace.className = "assistance-fab";
  enlace.setAttribute("aria-label", "Asistencia");
  enlace.setAttribute("title", "Asistencia");
  if (enlace.parentElement !== document.body) document.body.appendChild(enlace);
}

function escaparHtml(valor = "") {
  return String(valor).replace(/[&<>"']/g, (caracter) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[caracter]);
}

function fechaNotificacion(valor) {
  const fecha = new Date(valor || "");
  if (Number.isNaN(fecha.getTime())) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(fecha);
}

function claveRevisionNotificaciones(uid) {
  return `pv_notificaciones_globales_vistas_${uid}`;
}

function ultimaRevisionNotificaciones(uid) {
  try {
    return Number(localStorage.getItem(claveRevisionNotificaciones(uid)) || 0);
  } catch {
    return 0;
  }
}

function guardarRevisionNotificaciones(uid) {
  try {
    localStorage.setItem(claveRevisionNotificaciones(uid), String(Date.now()));
  } catch {
    // La lista completa sigue disponible aunque el navegador bloquee el almacenamiento local.
  }
}

function referenciaNotificacion(item) {
  const detalle = String(item?.detalle || "").trim();
  const id = detalle.match(/^([a-zA-Z0-9_-]+)/)?.[1] || "";
  const accion = String(item?.accion || "").toLocaleLowerCase("es");
  if (!id) return { tipo: "", id: "" };
  if (/reclamo|expediente|resolución administrativa|revisión administrativa|respuesta profesional/.test(accion)) return { tipo: "expediente", id };
  if (/cotización/.test(accion)) return { tipo: "cotizacion", id };
  if (/contrato|servicio/.test(accion)) return { tipo: "contrato", id };
  if (/solicitud/.test(accion)) return { tipo: "solicitud", id };
  return { tipo: "", id: "" };
}

function destinoNotificacion(item) {
  const texto = `${item?.accion || ""} ${item?.detalle || ""}`.toLocaleLowerCase("es");
  const referencia = referenciaNotificacion(item);
  if (/reclamo|expediente|resolución administrativa|revisión administrativa|respuesta profesional/.test(texto)) {
    return { destino: "asistencia", etiqueta: "Abrir expediente", ...referencia };
  }
  if (/cotización/.test(texto)) {
    return { destino: rolActual === "admin" ? "admin" : "panel", etiqueta: "Abrir cotización", ...referencia };
  }
  if (/contrato|servicio/.test(texto)) {
    return { destino: rolActual === "admin" ? "admin" : "panel", etiqueta: "Abrir contrato", ...referencia };
  }
  if (/portafolio/.test(texto)) {
    return { destino: "panel", etiqueta: "Abrir mi panel", ...referencia };
  }
  if (/solicitud/.test(texto)) {
    return rolActual === "profesional"
      ? { destino: "panel", etiqueta: "Revisar solicitud", ...referencia }
      : { destino: rolActual === "admin" ? "admin" : "solicitud", etiqueta: "Abrir solicitudes", ...referencia };
  }
  if (/registrado|estado profesional|revisión/.test(texto)) {
    return rolActual === "admin"
      ? { destino: "admin", etiqueta: "Abrir administración" }
      : { destino: "panel", etiqueta: "Abrir mi panel" };
  }
  return rolActual === "admin"
    ? { destino: "admin", etiqueta: "Ver en administración" }
    : { destino: "inicio", etiqueta: "Ir al inicio" };
}

function pintarNotificacionesGlobales() {
  const boton = document.getElementById("pvNotificationsButton");
  const contador = document.getElementById("pvNotificationsCount");
  const lista = document.getElementById("pvNotificationsList");
  if (!boton || !contador || !lista) return;
  const uid = usuarioNotificaciones?.uid || "";
  boton.hidden = !uid;
  if (!uid) {
    contador.textContent = "0";
    lista.innerHTML = '<div class="pv-notifications-empty">Inicia sesión para consultar tu actividad.</div>';
    return;
  }
  const ultimaRevision = ultimaRevisionNotificaciones(uid);
  const nuevas = notificacionesGlobales.filter((item) => new Date(item.fecha || "").getTime() > ultimaRevision).length;
  const visibles = filtroNotificaciones === "no-leidas"
    ? notificacionesGlobales.filter((item) => new Date(item.fecha || "").getTime() > ultimaRevision)
    : notificacionesGlobales;
  contador.textContent = nuevas > 99 ? "99+" : String(nuevas);
  boton.setAttribute("aria-label", nuevas ? `Abrir todas las notificaciones. ${nuevas} nuevas` : "Abrir todas las notificaciones");
  lista.innerHTML = visibles.length
    ? visibles.map((item) => {
      const nueva = new Date(item.fecha || "").getTime() > ultimaRevision;
      const accion = destinoNotificacion(item);
      return `<article class="pv-notification-item ${nueva ? "unread" : ""}">
        <span class="pv-notification-dot" aria-hidden="true"></span>
        <div><h3>${escaparHtml(item.accion || "Actualización")}</h3>
        <p>${escaparHtml(item.detalle || "Actividad registrada en Profesionales Vigna’s.")}</p>
        <div class="pv-notification-footer"><small>${escaparHtml(fechaNotificacion(item.fecha))} · ${escaparHtml(item.actor || item.actorEmail || item.actorUid || "Sistema")}</small>
        <button class="tiny-button pv-notification-action" type="button" data-pv-notification-target="${escaparHtml(accion.destino)}" data-pv-notification-type="${escaparHtml(accion.tipo || "")}" data-pv-notification-id="${escaparHtml(accion.id || "")}">${escaparHtml(accion.etiqueta)}</button></div></div>
      </article>`;
    }).join("")
    : `<div class="pv-notifications-empty">${filtroNotificaciones === "no-leidas" ? "No tienes notificaciones pendientes." : "Todavía no existe actividad registrada para esta cuenta."}</div>`;
}

function actualizarNotificacionesGlobales(datos, user) {
  usuarioNotificaciones = user || null;
  notificacionesGlobales = [...(datos?.auditoria || [])]
    .sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
  pintarNotificacionesGlobales();
}

function marcarNotificacionesVistas() {
  if (!usuarioNotificaciones?.uid) return;
  guardarRevisionNotificaciones(usuarioNotificaciones.uid);
  pintarNotificacionesGlobales();
}

function mostrarNotificacionEnVivo(item) {
  const aviso = document.getElementById("toast");
  if (!aviso || !item) return;
  aviso.textContent = `Nueva notificación: ${item.accion || "Actividad actualizada"}`;
  aviso.classList.add("show");
  window.clearTimeout(temporizadorAvisoVivo);
  temporizadorAvisoVivo = window.setTimeout(() => aviso.classList.remove("show"), 4200);
}

function recibirActividadEnTiempoReal(actividad, user) {
  const escuchaEstabaLista = actividadInicializada;
  const anteriores = new Set(notificacionesGlobales.map((item) => item.id).filter(Boolean));
  actualizarNotificacionesGlobales({ auditoria: actividad }, user);
  const nueva = notificacionesGlobales.find((item) => item.id && !anteriores.has(item.id));
  actividadInicializada = true;
  if (escuchaEstabaLista && nueva) {
    mostrarNotificacionEnVivo(nueva);
    window.clearTimeout(temporizadorSincronizacion);
    temporizadorSincronizacion = window.setTimeout(() => refrescarNube(), 350);
  }
}

function insertarRevisionDocumentos() {
  if (document.getElementById("pvDocumentsDialog")) return;
  const dialogo = document.createElement("dialog");
  dialogo.id = "pvDocumentsDialog";
  dialogo.className = "mvp-dialog pv-documents-dialog";
  dialogo.innerHTML = '<button class="dialog-close" data-pv-docs-close type="button" aria-label="Cerrar">×</button><div id="pvDocumentsContent"></div>';
  document.body.appendChild(dialogo);
}

async function revisarDocumentos(tipo, uid) {
  const mvp = await esperarMVP();
  const datos = mvp.getData();
  const persona = tipo === "profesional"
    ? datos.profesionales.find((item) => item.id === uid || item.uid === uid)
    : datos.clientes.find((item) => item.id === uid || item.uid === uid);
  if (!persona) return alert("No se encontró el registro.");
  const privado = tipo === "profesional" ? (persona.privado || {}) : persona;
  const documentos = privado.documentos || {};
  const enlace = (url, etiqueta) => /^https:\/\//.test(String(url || ""))
    ? `<a class="gold-button" href="${escaparHtml(url)}" target="_blank" rel="noopener noreferrer">${escaparHtml(etiqueta)}</a>`
    : `<span class="secondary-button disabled">${escaparHtml(etiqueta)} no disponible</span>`;
  document.getElementById("pvDocumentsContent").innerHTML = `
    <div class="page-intro compact">
      <p class="eyebrow">REVISIÓN PRIVADA · SOLO ADMINISTRACIÓN</p>
      <h1>${escaparHtml(`${persona.nombres || ""} ${persona.apellidos || ""}`.trim())}</h1>
      <p>${escaparHtml(privado.tipoDocumento || persona.tipoDocumento || "Documento")} · ${escaparHtml(privado.documento || persona.documento || "Sin número")}</p>
    </div>
    <div class="pv-document-grid">
      ${enlace(documentos.frenteUrl, "Abrir frente")}
      ${enlace(documentos.reversoUrl, "Abrir reverso")}
      ${enlace(documentos.selfieUrl, "Abrir selfie")}
    </div>
    <p class="pv-private-note">Estos enlaces contienen documentación privada y no deben compartirse.</p>`;
  document.getElementById("pvDocumentsDialog").showModal();
}

function insertarPasswords() {
  const agregar = (formId) => {
    const form = document.getElementById(formId);
    const grid = form?.querySelector(".form-section .form-grid");
    if (!grid || grid.querySelector('[name="password"]')) return;
    const password = document.createElement("label");
    password.innerHTML = 'Contraseña segura<input name="password" type="password" minlength="8" autocomplete="new-password" required>';
    const confirmar = document.createElement("label");
    confirmar.innerHTML = 'Confirmar contraseña<input name="passwordConfirm" type="password" minlength="8" autocomplete="new-password" required>';
    grid.append(password, confirmar);
  };
  agregar("formProfesional");
  agregar("formCliente");
}

function actualizarNavegacion(user) {
  const reglas = {
    solicitud: rolActual === "cliente" || rolActual === "admin",
    panel: rolActual === "cliente" || rolActual === "profesional" || rolActual === "admin",
    admin: rolActual === "admin",
    "registro-profesional": !user,
    "registro-cliente": !user
  };
  Object.entries(reglas).forEach(([vista, visible]) => {
    const boton = document.querySelector(`[data-view="${vista}"]`);
    if (boton) boton.hidden = !visible;
  });
  const acceso = document.getElementById("pvAccessButton");
  if (acceso) acceso.textContent = user ? `${user.email || "Mi cuenta"} · Salir` : "Ingresar";
  const salir = document.getElementById("pvLogoutButton");
  if (salir) salir.hidden = !user;
}

async function refrescarNube() {
  const mvp = await esperarMVP();
  try {
    const datos = await api.cargarDatos();
    rolActual = datos.rol;
    mvp.setData(datos);
    const user = api.usuarioActual();
    actualizarNavegacion(user);
    actualizarNotificacionesGlobales(datos, user);
    mensaje(user ? `Firebase activo · ${rolActual} · ${user.email || "cuenta autenticada"}` : "Firebase activo · catálogo público");
  } catch (error) {
    console.error("No se pudieron cargar los datos de Profesionales Vigna’s.", error);
    mensaje("Modo demostración: las reglas Firebase todavía no están desplegadas.", true);
  }
}

async function ejecutar(form, tarea, exito) {
  if (operacionEnCurso) return;
  operacionEnCurso = true;
  bloquear(form, true);
  mensaje("Guardando de forma segura…");
  try {
    await tarea();
    await refrescarNube();
    form?.reset();
    mensaje(exito);
    alert(exito);
  } catch (error) {
    console.error(error);
    mensaje(error.message || "No se pudo completar la operación.", true);
    alert(error.message || "No se pudo completar la operación.");
  } finally {
    bloquear(form, false);
    operacionEnCurso = false;
  }
}

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "pvLoginForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const datos = new FormData(form);
    await ejecutar(form, async () => {
      await api.iniciarSesion(String(datos.get("correo") || "").trim(), String(datos.get("password") || ""));
      document.getElementById("pvAccessDialog")?.close();
    }, "Sesión iniciada correctamente.");
    return;
  }
  const datos = new FormData(form);
  const acciones = {
    formProfesional: [() => api.registrarProfesional(datos), "Perfil profesional enviado a revisión."],
    formCliente: [() => api.registrarCliente(datos), "Cuenta de cliente enviada a revisión."],
    formSolicitud: [() => api.crearSolicitud(datos), "Solicitud guardada en Firebase."],
    formPortafolio: [() => api.agregarPortafolio(datos), "Proyecto guardado en Firebase Storage."],
    formCotizacion: [() => api.crearCotizacion(datos), "Cotización guardada en Firebase."]
  };
  const accion = acciones[form.id];
  if (!accion) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  await ejecutar(form, accion[0], accion[1]);
}, true);

document.addEventListener("click", async (event) => {
  const destinoAviso = event.target.closest("[data-pv-notification-target]");
  if (destinoAviso) {
    const destino = destinoAviso.dataset.pvNotificationTarget;
    const tipo = destinoAviso.dataset.pvNotificationType || "";
    const id = destinoAviso.dataset.pvNotificationId || "";
    document.getElementById("pvNotificationsDialog")?.close();
    if (destino === "asistencia") {
      location.href = id ? `garantias-reclamos.html?expediente=${encodeURIComponent(id)}` : "garantias-reclamos.html";
      return;
    }
    const botonVista = document.querySelector(`[data-view="${destino}"]`);
    if (botonVista && !botonVista.hidden) botonVista.click();
    const mvp = await esperarMVP();
    if (tipo === "contrato" && id) mvp.abrirContrato(id);
    if (tipo === "cotizacion" && id) mvp.abrirCotizacion(id);
    return;
  }
  if (event.target.closest("#pvNotificationsButton")) {
    document.getElementById("pvNotificationsDialog")?.showModal();
    return;
  }
  if (event.target.closest("[data-pv-notifications-close]")) {
    document.getElementById("pvNotificationsDialog")?.close();
    return;
  }
  if (event.target.closest("#pvNotificationsSeen")) {
    marcarNotificacionesVistas();
    return;
  }
  const acceso = event.target.closest("[data-pv-access]");
  if (acceso) {
    if (api.usuarioActual()) {
      await api.cerrarSesion();
      location.reload();
    } else document.getElementById("pvAccessDialog")?.showModal();
    return;
  }
  if (event.target.closest("[data-pv-close]")) document.getElementById("pvAccessDialog")?.close();
  if (event.target.closest("[data-pv-docs-close]")) document.getElementById("pvDocumentsDialog")?.close();
  if (event.target.closest("#pvLogoutButton")) {
    await api.cerrarSesion();
    location.reload();
    return;
  }
  const elegir = event.target.closest("[data-contract-quote]");
  if (elegir) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, () => api.aceptarCotizacion(elegir.dataset.contractQuote, Number(elegir.dataset.option)), "Contrato generado en Firebase.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const abrirFirmado = event.target.closest("[data-open-signed-contract]");
  if (abrirFirmado) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, async () => {
      const archivoFirmado = await api.abrirContratoFirmado(abrirFirmado.dataset.openSignedContract);
      const enlace = document.createElement("a");
      enlace.href = archivoFirmado.url;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      enlace.setAttribute("aria-label", `Abrir ${archivoFirmado.nombre}`);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }, "Contrato firmado abierto de forma segura.");
    return;
  }
  const subir = event.target.closest("[data-upload-contract]");
  if (subir) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const file = document.getElementById("signedContractFile")?.files?.[0];
    if (!file) return alert("Selecciona el contrato firmado.");
    await ejecutar(null, () => api.registrarContratoFirmado(subir.dataset.uploadContract, file), "Contrato firmado guardado en Firebase Storage.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const iniciarServicio = event.target.closest("[data-start-service]");
  if (iniciarServicio) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!confirm("¿Confirmas que el servicio ha comenzado?")) return;
    await ejecutar(null, () => api.iniciarServicio(iniciarServicio.dataset.startService), "Servicio marcado como en ejecución.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const finalizarServicio = event.target.closest("[data-finish-service]");
  if (finalizarServicio) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const files = document.getElementById("serviceEvidenceFiles")?.files;
    const nota = document.getElementById("serviceCompletionNote")?.value;
    await ejecutar(null, () => api.finalizarServicio(finalizarServicio.dataset.finishService, files, nota), "Servicio finalizado y evidencias protegidas.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const cerrarServicio = event.target.closest("[data-close-service]");
  if (cerrarServicio) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const calificacion = document.getElementById("serviceRating")?.value;
    const comentario = document.getElementById("serviceReview")?.value;
    if (!confirm("¿Confirmas tu conformidad y deseas cerrar el servicio?")) return;
    await ejecutar(null, () => api.cerrarServicio(cerrarServicio.dataset.closeService, calificacion, comentario), "Servicio cerrado y calificación registrada.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const abrirEvidencia = event.target.closest("[data-open-service-evidence]");
  if (abrirEvidencia) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, async () => {
      const evidencia = await api.abrirEvidenciaServicio(abrirEvidencia.dataset.openServiceEvidence, abrirEvidencia.dataset.evidencePath);
      const enlace = document.createElement("a");
      enlace.href = evidencia.url;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }, "Evidencia abierta de forma segura.");
    return;
  }
  const admin = event.target.closest("[data-admin-professional]");
  if (admin) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, () => api.cambiarEstadoProfesional(admin.dataset.adminProfessional, admin.dataset.state), `Perfil ${admin.dataset.state.toLowerCase()}.`);
  }
  const revisarProfesional = event.target.closest("[data-review-professional]");
  if (revisarProfesional) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await revisarDocumentos("profesional", revisarProfesional.dataset.reviewProfessional);
  }
  const revisarCliente = event.target.closest("[data-review-client]");
  if (revisarCliente) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await revisarDocumentos("cliente", revisarCliente.dataset.reviewClient);
  }
}, true);

document.getElementById("pvNotificationsFilter")?.addEventListener("change", (event) => {
  filtroNotificaciones = event.target.value === "no-leidas" ? "no-leidas" : "todas";
  pintarNotificacionesGlobales();
});

asegurarAsistenciaFlotante();
insertarAcceso();
insertarRevisionDocumentos();
insertarPasswords();
api.observarSesion(async (user) => {
  actividadInicializada = false;
  window.clearTimeout(temporizadorSincronizacion);
  if (detenerActividad) {
    detenerActividad();
    detenerActividad = null;
  }
  rolActual = await api.obtenerRol(user?.uid);
  actualizarNavegacion(user);
  await refrescarNube();
  if (user && api.usuarioActual()?.uid === user.uid) {
    detenerActividad = await api.observarActividad(
      (actividad) => recibirActividadEnTiempoReal(actividad, user),
      (error) => console.warn("La actividad en tiempo real no está disponible temporalmente.", error)
    );
  }
});
