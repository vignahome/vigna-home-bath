import { ProfesionalesFirebase as api } from "./mvp-profesionales-firebase.js?v=6";

// Evita mostrar los datos locales de demostración mientras Firebase confirma
// el catálogo público que realmente puede ver el visitante.
document.documentElement.classList.add("pv-cloud-loading");

let rolActual = "publico";
let operacionEnCurso = false;
let notificacionesGlobales = [];
let usuarioNotificaciones = null;
let detenerActividad = null;
let temporizadorAvisoVivo = null;
let temporizadorSincronizacion = null;
let actividadInicializada = false;
let filtroNotificaciones = "todas";
let revisionNotificacionesRemota = 0;
let retornoPagoPlanProcesado = false;

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
      <button class="secondary-button" type="button" data-password-reset>Olvidé mi contraseña</button>
    </form>
    <div id="pvAccountActions" class="table-actions" hidden>
      <button class="secondary-button" type="button" data-account-deletion-open>Eliminar mi cuenta</button>
      <button id="pvLogoutButton" class="secondary-button" type="button">Cerrar sesión</button>
    </div>`;
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
    return Math.max(Number(localStorage.getItem(claveRevisionNotificaciones(uid)) || 0), revisionNotificacionesRemota);
  } catch {
    return revisionNotificacionesRemota;
  }
}

async function guardarRevisionNotificaciones(uid) {
  const marcaTiempo = Date.now();
  revisionNotificacionesRemota = marcaTiempo;
  try {
    localStorage.setItem(claveRevisionNotificaciones(uid), String(marcaTiempo));
  } catch {
    // La lista completa sigue disponible aunque el navegador bloquee el almacenamiento local.
  }
  try {
    await api.guardarRevisionNotificaciones(new Date(marcaTiempo).toISOString());
  } catch (error) {
    console.warn("La marca de lectura se conservará solo en este dispositivo hasta habilitar las reglas actualizadas.", error);
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

async function marcarNotificacionesVistas() {
  if (!usuarioNotificaciones?.uid) return;
  await guardarRevisionNotificaciones(usuarioNotificaciones.uid);
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

function actualizarNavegacion(user, datos = null) {
  const reglas = {
    solicitud: rolActual === "cliente" || rolActual === "admin",
    panel: rolActual === "cliente" || rolActual === "profesional" || rolActual === "admin",
    admin: rolActual === "admin",
    "registro-profesional": !user || Boolean(datos?.registroIncompleto && rolActual === "profesional"),
    "registro-cliente": !user
  };
  Object.entries(reglas).forEach(([vista, visible]) => {
    const boton = document.querySelector(`[data-view="${vista}"]`);
    if (boton) boton.hidden = !visible;
  });
  const acceso = document.getElementById("pvAccessButton");
  if (acceso) acceso.textContent = user ? `${user.email || "Mi cuenta"} · Cuenta` : "Ingresar";
  const login = document.getElementById("pvLoginForm");
  const acciones = document.getElementById("pvAccountActions");
  if (login) login.hidden = Boolean(user);
  if (acciones) acciones.hidden = !user;
}

async function refrescarNube() {
  const mvp = await esperarMVP();
  try {
    const datos = await api.cargarDatos();
    rolActual = datos.rol;
    mvp.setData(datos);
    document.documentElement.classList.remove("pv-cloud-loading");
    const user = api.usuarioActual();
    actualizarNavegacion(user, datos);
    actualizarNotificacionesGlobales(datos, user);
    mensaje(datos.registroIncompleto
      ? "Tu registro profesional quedó incompleto. Abre “Soy profesional” y envíalo nuevamente con el mismo correo."
      : (user ? `Firebase activo · ${rolActual} · ${user.email || "cuenta autenticada"}` : "Firebase activo · catálogo público"), Boolean(datos.registroIncompleto));
  } catch (error) {
    console.error("No se pudieron cargar los datos de Profesionales Vigna’s.", error);
    const user = api.usuarioActual();
    if (user && rolActual === "profesional") {
      try {
        const plan = await api.obtenerPlanProfesionalPropio();
        if (plan) {
          const actuales = mvp.getData();
          const profesionales = (actuales.profesionales || []).map((perfil) =>
            (perfil.uid || perfil.id) === user.uid
              ? {
                  ...perfil,
                  planRegistro: plan,
                  plan: plan.tipo || perfil.plan,
                  planEstado: plan.estado || perfil.planEstado,
                  planVenceEn: plan.venceEn || perfil.planVenceEn
                }
              : perfil
          );
          rolActual = "profesional";
          const datosParciales = {
            ...actuales,
            rol: rolActual,
            usuarioUid: user.uid,
            profesionales,
            planesProfesionales: [plan]
          };
          mvp.setData(datosParciales);
          document.documentElement.classList.remove("pv-cloud-loading");
          actualizarNavegacion(user, datosParciales);
          mensaje(`Firebase activo · profesional · ${user.email || "cuenta autenticada"}`);
          return;
        }
      } catch (planError) {
        console.error("No se pudo recuperar el plan profesional propio.", planError);
      }
    }
    mensaje("No se pudo cargar el catálogo. Intenta actualizar la página.", true);
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

function limpiarRetornoPagoPlan() {
  const url = new URL(window.location.href);
  ["pagoPlan", "payment_id", "collection_id", "collection_status", "payment_type", "merchant_order_id", "preference_id", "site_id", "processing_mode", "merchant_account_id"].forEach((clave) => url.searchParams.delete(clave));
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

async function procesarRetornoPagoPlan(user) {
  if (retornoPagoPlanProcesado) return;
  const params = new URLSearchParams(window.location.search);
  const retorno = params.get("pagoPlan");
  if (!retorno) return;
  if (!user) {
    mensaje("Ingresa con la cuenta profesional que realizó el pago para verificarlo.", true);
    return;
  }

  retornoPagoPlanProcesado = true;
  if (retorno === "fallido" || retorno === "pendiente") {
    const texto = retorno === "fallido"
      ? "El pago no se completó. Puedes volver a intentarlo desde tu panel."
      : "El pago está pendiente. El plan se activará automáticamente cuando Mercado Pago lo apruebe.";
    limpiarRetornoPagoPlan();
    mensaje(texto, retorno === "fallido");
    alert(texto);
    return;
  }

  const paymentId = params.get("payment_id") || params.get("collection_id");
  if (retorno !== "retorno" || !paymentId) {
    limpiarRetornoPagoPlan();
    mensaje("Mercado Pago no devolvió un identificador verificable.", true);
    return;
  }

  try {
    mensaje("Verificando el pago del plan con Mercado Pago…");
    const resultado = await api.verificarPagoPlanProfesional(paymentId);
    limpiarRetornoPagoPlan();
    await refrescarNube();
    const texto = `Pago aprobado. Plan ${resultado.plan || "profesional"} activo${resultado.venceEn ? ` hasta ${new Date(resultado.venceEn).toLocaleDateString("es-PE")}` : ""}.`;
    mensaje(texto);
    alert(texto);
  } catch (error) {
    retornoPagoPlanProcesado = false;
    mensaje(error.message || "No se pudo verificar el pago del plan.", true);
    alert(error.message || "No se pudo verificar el pago del plan.");
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
  if (form.id === "pvAccountDeletionForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const datos = new FormData(form);
    if (datos.get("confirmacion") !== "on") return;
    await ejecutar(form, async () => {
      const solicitud = await api.solicitarEliminacionCuenta(datos.get("motivo"));
      document.getElementById("pvAccountDeletionStatus").textContent = `Solicitud ${solicitud.estado}. VIGNA confirmará cuando la eliminación haya concluido.`;
    }, "Solicitud de eliminación registrada.");
    return;
  }
  const datos = new FormData(form);
  if (form.matches("[data-specialty-create]")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(form, () => api.crearEspecialidad({
      profesion: datos.get("profesion"),
      principal: datos.get("principal") === "on",
      experiencia: datos.get("experiencia"),
      descripcion: datos.get("descripcion")
    }), "Profesión registrada y enviada a revisión.");
    return;
  }
  if (form.matches("[data-specialty-form]")) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(form, () => api.actualizarEspecialidad(form.dataset.specialtyForm, {
      principal: datos.get("principal") === "on",
      experiencia: datos.get("experiencia"),
      descripcion: datos.get("descripcion")
    }, datos.getAll("evidencias")), "Especialidad y evidencias actualizadas.");
    return;
  }
  if (form.id === "milestoneForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const boton = form.querySelector("[data-create-milestone]");
    await ejecutar(form, () => api.crearHito(boton.dataset.createMilestone, datos.get("titulo"), datos.get("detalle"), datos.get("fechaObjetivo")), "Hito creado y vinculado al contrato.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  if (form.id === "paymentDeclarationForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const boton = form.querySelector("[data-declare-payment]");
    const comprobante = datos.get("comprobante");
    await ejecutar(form, () => api.declararPago(boton.dataset.declarePayment, {
      monto: datos.get("monto"), metodo: datos.get("metodo"), referencia: datos.get("referencia"),
      fechaPago: datos.get("fechaPago"), nota: datos.get("nota")
    }, comprobante instanceof File && comprobante.size ? comprobante : null), "Pago declarado y notificado al profesional.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  if (form.id === "changeOrderForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const boton = form.querySelector("[data-propose-change]");
    await ejecutar(form, () => api.proponerOrdenCambio(boton.dataset.proposeChange, {
      descripcion: datos.get("descripcion"), motivo: datos.get("motivo"),
      impactoMonto: datos.get("impactoMonto"), impactoDias: Number(datos.get("impactoDias") || 0)
    }), "Orden de cambio enviada a la otra parte.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  if (form.id === "contractMessageForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const boton = form.querySelector("[data-send-contract-message]");
    const adjunto = datos.get("adjunto");
    await ejecutar(form, () => api.enviarMensajeContrato(boton.dataset.sendContractMessage, datos.get("mensaje"), adjunto instanceof File && adjunto.size ? adjunto : null), "Mensaje agregado al expediente contractual.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  if (form.id === "contractActuationForm") {
    event.preventDefault();
    event.stopImmediatePropagation();
    const boton = form.querySelector("[data-request-actuation]");
    await ejecutar(form, () => api.solicitarActuacionContrato(boton.dataset.requestActuation, datos.get("tipo"), datos.get("motivo")), "Solicitud contractual registrada y notificada.");
    document.getElementById("contractDialog")?.close();
    return;
  }
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
  const recuperar = event.target.closest("[data-password-reset]");
  if (recuperar) {
    const form = document.getElementById("pvLoginForm");
    const correo = form?.elements?.correo?.value || "";
    await ejecutar(form, () => api.recuperarPassword(correo), "Si la cuenta existe, Firebase enviará instrucciones de recuperación al correo indicado.");
    return;
  }
  if (event.target.closest("[data-account-deletion-open]")) {
    document.getElementById("pvAccessDialog")?.close();
    document.getElementById("pvAccountDeletionDialog")?.showModal();
    return;
  }
  if (event.target.closest("[data-account-deletion-close]")) {
    document.getElementById("pvAccountDeletionDialog")?.close();
    return;
  }
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
    if (tipo === "solicitud" && id) mvp.enfocarSolicitud(id);
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
    await marcarNotificacionesVistas();
    return;
  }
  const acceso = event.target.closest("[data-pv-access]");
  if (acceso) {
    document.getElementById("pvAccessDialog")?.showModal();
    return;
  }
  if (event.target.closest("[data-pv-close]")) document.getElementById("pvAccessDialog")?.close();
  if (event.target.closest("[data-pv-docs-close]")) document.getElementById("pvDocumentsDialog")?.close();
  if (event.target.closest("#pvLogoutButton")) {
    await api.cerrarSesion();
    location.reload();
    return;
  }
  const eliminacionAdmin = event.target.closest("[data-admin-deletion]");
  if (eliminacionAdmin) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const estado = eliminacionAdmin.dataset.deletionState;
    const nota = prompt(estado === "Completada"
      ? "Describe brevemente qué datos fueron eliminados o anonimizados antes de confirmar:"
      : "Nota administrativa del trámite:", "");
    if (nota === null) return;
    if (estado === "Completada" && nota.trim().length < 10) {
      alert("La confirmación final requiere una nota de al menos 10 caracteres.");
      return;
    }
    await ejecutar(null, () => api.actualizarSolicitudEliminacion(eliminacionAdmin.dataset.adminDeletion, estado, nota), `Solicitud marcada como ${estado}.`);
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
  const abrirPlanTrabajo = event.target.closest("[data-open-work-plan]");
  if (abrirPlanTrabajo) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, async () => {
      const anexo = await api.abrirAnexoPlanTrabajo(abrirPlanTrabajo.dataset.openWorkPlan);
      const enlace = document.createElement("a");
      enlace.href = anexo.url;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      enlace.download = anexo.nombre;
      enlace.setAttribute("aria-label", `Abrir ${anexo.nombre}`);
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }, "Plan de productos y ejecución abierto de forma segura.");
    return;
  }
  const abrirMensaje = event.target.closest("[data-open-message-file]");
  if (abrirMensaje) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, async () => {
      const adjunto = await api.abrirAdjuntoMensaje(abrirMensaje.dataset.contractId, abrirMensaje.dataset.openMessageFile);
      const enlace = document.createElement("a");
      enlace.href = adjunto.url;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }, "Adjunto contractual abierto de forma segura.");
    return;
  }
  const abrirEspecialidad = event.target.closest("[data-open-specialty-file]");
  if (abrirEspecialidad) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, async () => {
      const evidencia = await api.abrirEvidenciaEspecialidad(abrirEspecialidad.dataset.openSpecialtyFile, abrirEspecialidad.dataset.filePath);
      const enlace = document.createElement("a");
      enlace.href = evidencia.url;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }, "Evidencia de especialidad abierta de forma segura.");
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
  const confirmarFirmado = event.target.closest("[data-confirm-signed-contract]");
  if (confirmarFirmado) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!document.getElementById("contractHashAcceptance")?.checked) return alert("Confirma que revisaste esta versión del documento.");
    await ejecutar(null, () => api.confirmarContratoFirmado(confirmarFirmado.dataset.confirmSignedContract), "Documento contractual confirmado.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const subirPlanTrabajo = event.target.closest("[data-upload-work-plan]");
  if (subirPlanTrabajo) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const file = document.getElementById("workPlanFile")?.files?.[0];
    if (!file) return alert("Selecciona la hoja Excel o CSV.");
    await ejecutar(null, () => api.registrarAnexoPlanTrabajo(subirPlanTrabajo.dataset.uploadWorkPlan, file), "Plan opcional guardado en Firebase Storage.");
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
    const aceptacion = document.getElementById("serviceAcceptance")?.checked === true;
    if (!aceptacion) return alert("Debes aceptar expresamente el acta de entrega y conformidad.");
    if (!confirm("¿Confirmas tu conformidad y deseas cerrar el servicio?")) return;
    await ejecutar(null, () => api.cerrarServicio(cerrarServicio.dataset.closeService, calificacion, comentario, aceptacion), "Acta aceptada, servicio cerrado y calificación registrada.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  if (event.target.closest("[data-print-handover]")) {
    event.preventDefault();
    document.body.classList.add("printing-handover");
    window.addEventListener("afterprint", () => document.body.classList.remove("printing-handover"), { once: true });
    window.print();
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
  const enviarHito = event.target.closest("[data-submit-milestone]");
  if (enviarHito) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const tarjeta = enviarHito.closest("[data-execution-record]");
    await ejecutar(null, () => api.registrarAvanceHito(enviarHito.dataset.contractId, enviarHito.dataset.submitMilestone, tarjeta?.querySelector("[data-hito-files]")?.files, tarjeta?.querySelector("[data-hito-note]")?.value), "Avance enviado al cliente para revisión.");
    document.getElementById("contractDialog")?.close();
    return;
  }
  const revisarHito = event.target.closest("[data-review-milestone]");
  if (revisarHito) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const comentario = revisarHito.closest("[data-execution-record]")?.querySelector("[data-hito-response]")?.value;
    await ejecutar(null, () => api.resolverHito(revisarHito.dataset.contractId, revisarHito.dataset.reviewMilestone, revisarHito.dataset.decision, comentario), `Hito ${revisarHito.dataset.decision.toLowerCase()}.`);
    document.getElementById("contractDialog")?.close();
    return;
  }
  const revisarPago = event.target.closest("[data-review-payment]");
  if (revisarPago) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const comentario = revisarPago.closest("[data-execution-record]")?.querySelector("[data-payment-response]")?.value;
    await ejecutar(null, () => api.resolverPago(revisarPago.dataset.contractId, revisarPago.dataset.reviewPayment, revisarPago.dataset.decision, comentario), `Pago ${revisarPago.dataset.decision.toLowerCase()}.`);
    document.getElementById("contractDialog")?.close();
    return;
  }
  const revisarCambio = event.target.closest("[data-review-change]");
  if (revisarCambio) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const respuesta = revisarCambio.closest("[data-execution-record]")?.querySelector("[data-change-response]")?.value;
    await ejecutar(null, () => api.resolverOrdenCambio(revisarCambio.dataset.contractId, revisarCambio.dataset.reviewChange, revisarCambio.dataset.decision, respuesta), `Orden de cambio ${revisarCambio.dataset.decision.toLowerCase()}.`);
    document.getElementById("contractDialog")?.close();
    return;
  }
  const abrirEjecucion = event.target.closest("[data-open-execution-file]");
  if (abrirEjecucion) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, async () => {
      const evidencia = await api.abrirEvidenciaEjecucion(abrirEjecucion.dataset.openExecutionFile, abrirEjecucion.dataset.executionType, abrirEjecucion.dataset.recordId, abrirEjecucion.dataset.filePath);
      const enlace = document.createElement("a");
      enlace.href = evidencia.url;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
    }, "Archivo privado abierto de forma segura.");
    return;
  }
  const admin = event.target.closest("[data-admin-professional]");
  if (admin) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, () => api.cambiarEstadoProfesional(admin.dataset.adminProfessional, admin.dataset.state), `Perfil ${admin.dataset.state.toLowerCase()}.`);
    return;
  }
  const migrarProfesiones = event.target.closest("[data-admin-migrate-specialties]");
  if (migrarProfesiones) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, () => api.migrarProfesionesLegadas(migrarProfesiones.dataset.adminMigrateSpecialties), "Profesiones antiguas registradas como pendientes.");
    return;
  }
  const especialidad = event.target.closest("[data-admin-specialty]");
  if (especialidad) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, () => api.cambiarEstadoEspecialidad(especialidad.dataset.adminSpecialty, especialidad.dataset.state), `Especialidad ${especialidad.dataset.state.toLowerCase()}.`);
    return;
  }
  const portafolio = event.target.closest("[data-admin-portfolio]");
  if (portafolio) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const observacion = portafolio.dataset.state === "Aprobado" ? "" : prompt("Indica el motivo u observación para el profesional:", "") || "";
    await ejecutar(null, () => api.moderarPortafolio(portafolio.dataset.adminPortfolio, portafolio.dataset.state, observacion), `Portafolio ${portafolio.dataset.state.toLowerCase()}.`);
    return;
  }
  const solicitarPlan = event.target.closest("[data-request-plan]");
  if (solicitarPlan) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (operacionEnCurso) return;
    operacionEnCurso = true;
    solicitarPlan.disabled = true;
    mensaje(api.esPlataformaNativa() ? "Consultando la tienda del dispositivo…" : "Preparando el pago seguro…");
    try {
      const pago = await api.iniciarPagoPlanProfesional(solicitarPlan.dataset.requestPlan);
      window.location.assign(pago.init_point);
    } catch (error) {
      console.error(error);
      mensaje(error.message || "No se pudo iniciar el pago del plan.", true);
      alert(error.message || "No se pudo iniciar el pago del plan.");
      solicitarPlan.disabled = false;
      operacionEnCurso = false;
    }
    return;
  }
  const activarPlan = event.target.closest("[data-admin-activate-plan]");
  if (activarPlan) {
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!confirm(`¿Confirmas que corresponde activar el plan ${activarPlan.dataset.planType}?`)) return;
    await ejecutar(null, () => api.activarPlanProfesional(activarPlan.dataset.adminActivatePlan, activarPlan.dataset.planType), "Plan profesional activado y perfil habilitado según su estado.");
    return;
  }
  const resolverActuacion = event.target.closest("[data-resolve-actuation]");
  if (resolverActuacion) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const resolucion = resolverActuacion.closest(".execution-inline-form")?.querySelector("[data-actuation-resolution]")?.value || "";
    await ejecutar(null, () => api.resolverActuacionContrato(resolverActuacion.dataset.resolveActuation, resolverActuacion.dataset.decision, resolucion), `Actuación ${resolverActuacion.dataset.decision.toLowerCase()}.`);
    document.getElementById("contractDialog")?.close();
    return;
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
  revisionNotificacionesRemota = 0;
  window.clearTimeout(temporizadorSincronizacion);
  if (detenerActividad) {
    detenerActividad();
    detenerActividad = null;
  }
  rolActual = await api.obtenerRol(user?.uid);
  if (user) {
    try {
      const revision = await api.obtenerRevisionNotificaciones();
      revisionNotificacionesRemota = Date.parse(revision || "") || 0;
    } catch (error) {
      console.warn("Se usará el estado local de notificaciones hasta habilitar las preferencias en Firebase.", error);
    }
  }
  actualizarNavegacion(user);
  const formularioEliminacion = document.getElementById("pvAccountDeletionForm");
  const invitadoEliminacion = document.getElementById("pvAccountDeletionGuest");
  if (formularioEliminacion) formularioEliminacion.hidden = !user;
  if (invitadoEliminacion) invitadoEliminacion.hidden = Boolean(user);
  if (user) {
    document.getElementById("pvAccountDeletionEmail").textContent = user.email || user.uid;
    try {
      const solicitud = await api.obtenerSolicitudEliminacion();
      if (solicitud) document.getElementById("pvAccountDeletionStatus").textContent = `Solicitud ${solicitud.estado} desde ${fechaNotificacion(solicitud.solicitadoEn)}.`;
    } catch (error) {
      console.warn("No se pudo consultar la solicitud de eliminación.", error);
    }
  }
  if (new URLSearchParams(location.search).get("eliminar-cuenta") === "1") document.getElementById("pvAccountDeletionDialog")?.showModal();
  await refrescarNube();
  await procesarRetornoPagoPlan(user);
  if (user && api.usuarioActual()?.uid === user.uid) {
    detenerActividad = await api.observarActividad(
      (actividad) => recibirActividadEnTiempoReal(actividad, user),
      (error) => console.warn("La actividad en tiempo real no está disponible temporalmente.", error)
    );
  }
});
