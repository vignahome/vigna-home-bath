import { ProfesionalesFirebase as api } from "./mvp-profesionales-firebase.js";

let rolActual = "publico";
let operacionEnCurso = false;

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
    panel: rolActual === "profesional" || rolActual === "admin",
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
    await ejecutar(form, async () => {
      const datos = new FormData(form);
      await api.iniciarSesion(String(datos.get("correo") || "").trim(), String(datos.get("password") || ""));
      document.getElementById("pvAccessDialog")?.close();
    }, "Sesión iniciada correctamente.");
    return;
  }
  const acciones = {
    formProfesional: [() => api.registrarProfesional(new FormData(form)), "Perfil profesional enviado a revisión."],
    formCliente: [() => api.registrarCliente(new FormData(form)), "Cuenta de cliente enviada a revisión."],
    formSolicitud: [() => api.crearSolicitud(new FormData(form)), "Solicitud guardada en Firebase."],
    formPortafolio: [() => api.agregarPortafolio(new FormData(form)), "Proyecto guardado en Firebase Storage."],
    formCotizacion: [() => api.crearCotizacion(new FormData(form)), "Cotización guardada en Firebase."]
  };
  const accion = acciones[form.id];
  if (!accion) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  await ejecutar(form, accion[0], accion[1]);
}, true);

document.addEventListener("click", async (event) => {
  const acceso = event.target.closest("[data-pv-access]");
  if (acceso) {
    if (api.usuarioActual()) {
      await api.cerrarSesion();
      location.reload();
    } else document.getElementById("pvAccessDialog")?.showModal();
    return;
  }
  if (event.target.closest("[data-pv-close]")) document.getElementById("pvAccessDialog")?.close();
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
  const admin = event.target.closest("[data-admin-professional]");
  if (admin) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await ejecutar(null, () => api.cambiarEstadoProfesional(admin.dataset.adminProfessional, admin.dataset.state), `Perfil ${admin.dataset.state.toLowerCase()}.`);
  }
}, true);

insertarAcceso();
insertarPasswords();
api.observarSesion(async (user) => {
  rolActual = await api.obtenerRol(user?.uid);
  actualizarNavegacion(user);
  await refrescarNube();
});
