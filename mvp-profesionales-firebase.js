import { db, auth, storage } from "./firebase.js";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import {
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";
import {
  normalizarPerfilPropio,
  normalizarPlanPropio
} from "./mvp-profesionales-identidad.mjs?v=1";

const COLECCIONES = Object.freeze({
  usuarios: "pv_usuarios",
  profesionales: "pv_profesionales",
  profesionalesPrivados: "pv_profesionales_privados",
  profesionesProfesional: "pv_profesiones_profesional",
  coberturas: "pv_coberturas",
  planesProfesionales: "pv_planes_profesionales",
  portafolios: "pv_portafolios",
  clientes: "pv_clientes",
  solicitudes: "pv_solicitudes",
  cotizaciones: "pv_cotizaciones",
  contratos: "pv_contratos",
  hitos: "pv_hitos",
  pagosDeclarados: "pv_pagos_declarados",
  ordenesCambio: "pv_ordenes_cambio",
  mensajesContrato: "pv_mensajes_contrato",
  actuacionesContrato: "pv_actuaciones_contrato",
  resenas: "pv_resenas",
  auditoria: "pv_auditoria",
  preferenciasNotificaciones: "pv_preferencias_notificaciones",
  solicitudesEliminacion: "pv_solicitudes_eliminacion"
});

const ahora = () => new Date().toISOString();
const listaTexto = (valor = "") => [...new Set(String(valor).split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 100);
const nombreCompleto = (valor = {}) => `${valor.nombres || ""} ${valor.apellidos || ""}`.trim();
const texto = (form, nombre) => String(form.get(nombre) || "").trim();
const archivo = (form, nombre) => {
  const valor = form.get(nombre);
  return valor instanceof File && valor.size ? valor : null;
};
const limpiarNombre = (nombre = "archivo") => String(nombre)
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-zA-Z0-9._-]+/g, "-")
  .slice(-100);

function exigirUsuario() {
  if (!auth.currentUser) throw new Error("Debes iniciar sesión para continuar.");
  return auth.currentUser;
}

function validarArchivo(file, { maxMb = 10, tipos = [] } = {}) {
  if (!file) return;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`El archivo ${file.name} supera ${maxMb} MB.`);
  if (tipos.length && !tipos.some((tipo) => file.type.startsWith(tipo) || file.type === tipo)) {
    throw new Error(`El formato de ${file.name} no está permitido.`);
  }
}

async function subir(path, file, opciones) {
  if (!file) return "";
  validarArchivo(file, opciones);
  const referencia = ref(storage, `${path}/${Date.now()}-${limpiarNombre(file.name)}`);
  const resultado = await uploadBytes(referencia, file, {
    contentType: file.type,
    customMetadata: { propietarioUid: auth.currentUser?.uid || "" }
  });
  return getDownloadURL(resultado.ref);
}

async function subirPrivado(path, file, opciones) {
  if (!file) return "";
  validarArchivo(file, opciones);
  const referencia = ref(storage, `${path}/${Date.now()}-${limpiarNombre(file.name)}`);
  const resultado = await uploadBytes(referencia, file, {
    contentType: file.type,
    customMetadata: { propietarioUid: auth.currentUser?.uid || "" }
  });
  return resultado.ref.fullPath;
}

function rutaDesdeUrlStorage(url = "") {
  const coincidencia = String(url).match(/\/o\/([^?]+)/);
  return coincidencia ? decodeURIComponent(coincidencia[1]) : "";
}

async function contratoAutorizado(contratoId) {
  const user = exigirUsuario();
  const contratoRef = doc(db, COLECCIONES.contratos, contratoId);
  const snapshot = await getDoc(contratoRef);
  if (!snapshot.exists()) throw new Error("El contrato ya no existe.");
  const contrato = snapshot.data();
  const autorizado = [contrato.clienteUid, contrato.profesionalUid].includes(user.uid) || await esAdmin(user.uid);
  if (!autorizado) throw new Error("No tienes acceso a este contrato.");
  return { user, contratoRef, contrato };
}

async function esAdmin(uid = auth.currentUser?.uid) {
  if (!uid) return false;
  const snapshot = await getDoc(doc(db, "admins", uid));
  return snapshot.exists() && snapshot.data().activo !== false;
}

async function obtenerAdminRol(uid = auth.currentUser?.uid) {
  if (!uid) return "";
  const snapshot = await getDoc(doc(db, "admins", uid));
  if (!snapshot.exists() || snapshot.data().activo === false) return "";
  const rol = String(snapshot.data().rol || "superadmin").toLowerCase();
  return ["superadmin", "moderacion", "soporte", "finanzas"].includes(rol) ? rol : "superadmin";
}

async function exigirPermisoAdmin(...roles) {
  const rol = await obtenerAdminRol();
  if (!rol || (rol !== "superadmin" && !roles.includes(rol))) throw new Error("Tu rol administrativo no permite esta acción.");
  return rol;
}

async function obtenerRol(uid = auth.currentUser?.uid) {
  if (!uid) return "publico";
  if (await esAdmin(uid)) return "admin";
  const snapshot = await getDoc(doc(db, COLECCIONES.usuarios, uid));
  return snapshot.exists() ? snapshot.data().rol : "sin_perfil";
}

async function auditar(accion, detalle, participantes = []) {
  const user = exigirUsuario();
  await addDoc(collection(db, COLECCIONES.auditoria), {
    accion,
    detalle,
    actorUid: user.uid,
    actorEmail: user.email || "",
    contexto: {
      agente: String(globalThis.navigator?.userAgent || "").slice(0, 300),
      idioma: String(globalThis.navigator?.language || "").slice(0, 20)
    },
    participantes: [...new Set([user.uid, ...participantes.filter(Boolean)])],
    fecha: ahora()
  });
}

async function registrarProfesional(form) {
  const correo = texto(form, "correo");
  const password = texto(form, "password");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  if (password !== texto(form, "passwordConfirm")) throw new Error("Las contraseñas no coinciden.");
  const profesiones = form.getAll("profesiones").map(String);
  if (!profesiones.length) throw new Error("Selecciona al menos una profesión.");
  if (profesiones.length > 10) throw new Error("Puedes registrar como máximo 10 profesiones.");
  const sesionExistente = auth.currentUser;
  const mismoCorreo = sesionExistente?.email?.trim().toLowerCase() === correo.trim().toLowerCase();
  const uid = mismoCorreo
    ? sesionExistente.uid
    : (await createUserWithEmailAndPassword(auth, correo, password)).user.uid;
  if (!mismoCorreo && auth.currentUser && !auth.currentUser.emailVerified) {
    await sendEmailVerification(auth.currentUser).catch(() => {});
  }
  const perfilExistente = await getDoc(doc(db, COLECCIONES.profesionales, uid));
  if (perfilExistente.exists()) {
    const perfilPropio = normalizarPerfilPropio({ id: perfilExistente.id, data: perfilExistente.data() }, uid);
    if (!perfilPropio) throw new Error("El perfil existente no corresponde a la sesión autenticada.");
    await setDoc(doc(db, COLECCIONES.usuarios, uid), {
      uid, rol: "profesional", correo, estadoRegistro: "completo"
    }, { merge: true });
    return perfilPropio;
  }
  await setDoc(doc(db, COLECCIONES.usuarios, uid), {
    uid, rol: "profesional", correo, estadoRegistro: "incompleto", creadoEn: ahora()
  }, { merge: true });

  const frente = archivo(form, "documentoFrente");
  const reverso = archivo(form, "documentoReverso");
  const selfie = archivo(form, "selfie");
  const baseIdentidad = `profesionales-vigna/profesionales/${uid}/identidad`;
  const [frenteUrl, reversoUrl, selfieUrl] = await Promise.all([
    subir(baseIdentidad, frente, { maxMb: 10, tipos: ["image/", "application/pdf"] }),
    subir(baseIdentidad, reverso, { maxMb: 10, tipos: ["image/", "application/pdf"] }),
    subir(baseIdentidad, selfie, { maxMb: 8, tipos: ["image/"] })
  ]);

  const nombres = texto(form, "nombres");
  const apellidos = texto(form, "apellidos");
  const cobertura = {
    tipo: texto(form, "coberturaTipo"),
    departamentos: listaTexto(form.get("coberturaDepartamentos")),
    provincias: listaTexto(form.get("coberturaProvincias")),
    distritos: listaTexto(form.get("coberturaDistritos")),
    exclusiones: listaTexto(form.get("coberturaExclusiones")),
    distanciaKm: Math.max(0, Number(form.get("distanciaKm") || 0)),
    recargo: texto(form, "recargo")
  };
  const publico = {
    uid, nombres, apellidos, correo, whatsapp: texto(form, "whatsapp"), modalidad: texto(form, "modalidad"),
    nombrePublico: texto(form, "nombrePublico"), ruc: texto(form, "ruc"), idiomas: listaTexto(form.get("idiomas")),
    disponibilidad: texto(form, "disponibilidad"),
    departamento: texto(form, "departamento"), provincia: texto(form, "provincia"), distrito: texto(form, "distrito"),
    profesiones, profesionPrincipal: texto(form, "profesionPrincipal"), experiencia: Number(form.get("experiencia") || 0),
    coberturaTipo: texto(form, "coberturaTipo"), coberturaDetalle: texto(form, "coberturaDetalle"), cobertura,
    distancia: texto(form, "distancia"), recargo: texto(form, "recargo"), descripcion: texto(form, "descripcion"),
    estado: "Pendiente", plan: "Sin plan", planEstado: "Sin plan", planVenceEn: "", calificacion: 0, trabajos: 0,
    fotoIniciales: `${nombres[0] || ""}${apellidos[0] || ""}`.toUpperCase(), documentosDeclarados: [frenteUrl, reversoUrl, selfieUrl].filter(Boolean).length,
    portafolio: [], creadoEn: ahora(), actualizadoEn: ahora()
  };
  const privado = {
    uid, fechaNacimiento: texto(form, "fechaNacimiento"), tipoDocumento: texto(form, "tipoDocumento"),
    documento: texto(form, "documento"), documentoVenceEn: texto(form, "documentoVenceEn"),
    paisEmisor: texto(form, "paisEmisor"), direccionPrivada: texto(form, "direccion"),
    referencia: texto(form, "referencia"), documentos: { frenteUrl, reversoUrl, selfieUrl }, actualizadoEn: ahora()
  };
  const especialidades = profesiones.map((profesion) => {
    const especialidadRef = doc(collection(db, COLECCIONES.profesionesProfesional));
    return {
      ref: especialidadRef,
      datos: {
        id: especialidadRef.id, profesionalUid: uid, profesion,
        principal: profesion === publico.profesionPrincipal,
        experiencia: publico.experiencia, descripcion: "", evidencias: [],
        estado: "Pendiente", calificacion: 0, trabajos: 0,
        creadoEn: ahora(), actualizadoEn: ahora()
      }
    };
  });
  await Promise.all([
    setDoc(doc(db, COLECCIONES.profesionales, uid), publico),
    setDoc(doc(db, COLECCIONES.profesionalesPrivados, uid), privado),
    setDoc(doc(db, COLECCIONES.coberturas, uid), { uid, profesionalUid: uid, ...cobertura, creadoEn: ahora(), actualizadoEn: ahora() }),
    setDoc(doc(db, COLECCIONES.planesProfesionales, uid), { uid, profesionalUid: uid, tipo: "", precio: 0, meses: 0, estado: "Sin plan", solicitadoEn: "", activadoEn: "", venceEn: "", actualizadoEn: ahora() }),
    ...especialidades.map((item) => setDoc(item.ref, item.datos)),
    setDoc(doc(db, COLECCIONES.usuarios, uid), { uid, rol: "profesional", correo, estadoRegistro: "completo", creadoEn: ahora() }, { merge: true })
  ]);
  await auditar("Profesional registrado", `${uid} pendiente de revisión.`, [uid]);
  return publico;
}

async function registrarCliente(form) {
  const correo = texto(form, "correo");
  const password = texto(form, "password");
  if (password.length < 8) throw new Error("La contraseña debe tener al menos 8 caracteres.");
  if (password !== texto(form, "passwordConfirm")) throw new Error("Las contraseñas no coinciden.");
  const credencial = await createUserWithEmailAndPassword(auth, correo, password);
  const uid = credencial.user.uid;
  if (!credencial.user.emailVerified) await sendEmailVerification(credencial.user).catch(() => {});
  await setDoc(doc(db, COLECCIONES.usuarios, uid), {
    uid, rol: "cliente", correo, estadoRegistro: "incompleto", creadoEn: ahora()
  });
  const frente = archivo(form, "documentoFrente");
  const reverso = archivo(form, "documentoReverso");
  const selfie = archivo(form, "selfie");
  const base = `profesionales-vigna/clientes/${uid}/identidad`;
  const [frenteUrl, reversoUrl, selfieUrl] = await Promise.all([
    subir(base, frente, { maxMb: 10, tipos: ["image/", "application/pdf"] }),
    subir(base, reverso, { maxMb: 10, tipos: ["image/", "application/pdf"] }),
    subir(base, selfie, { maxMb: 8, tipos: ["image/"] })
  ]);
  const cliente = {
    uid, nombres: texto(form, "nombres"), apellidos: texto(form, "apellidos"), fechaNacimiento: texto(form, "fechaNacimiento"),
    correo, whatsapp: texto(form, "whatsapp"), tipoDocumento: texto(form, "tipoDocumento"), documento: texto(form, "documento"),
    documentoVenceEn: texto(form, "documentoVenceEn"), correoVerificado: credencial.user.emailVerified === true,
    paisEmisor: texto(form, "paisEmisor"), departamento: texto(form, "departamento"), provincia: texto(form, "provincia"),
    distrito: texto(form, "distrito"), zona: texto(form, "zona"), direccion: texto(form, "direccion"), referencia: texto(form, "referencia"),
    documentos: { frenteUrl, reversoUrl, selfieUrl }, documentosDeclarados: [frenteUrl, reversoUrl, selfieUrl].filter(Boolean).length,
    estado: "Pendiente", creadoEn: ahora(), actualizadoEn: ahora()
  };
  await Promise.all([
    setDoc(doc(db, COLECCIONES.clientes, uid), cliente),
    setDoc(doc(db, COLECCIONES.usuarios, uid), { uid, rol: "cliente", correo, estadoRegistro: "completo", creadoEn: ahora() }, { merge: true })
  ]);
  await auditar("Cliente registrado", `${uid} pendiente de revisión.`, [uid]);
  return cliente;
}

async function iniciarSesion(correo, password) {
  await signInWithEmailAndPassword(auth, correo, password);
  return { user: auth.currentUser, rol: await obtenerRol() };
}

async function recuperarPassword(correo) {
  const email = String(correo || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Ingresa un correo electrónico válido.");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return;
    throw error;
  }
}

async function cerrarSesion() {
  await signOut(auth);
}

async function obtenerSolicitudEliminacion() {
  const user = exigirUsuario();
  const snapshot = await getDoc(doc(db, COLECCIONES.solicitudesEliminacion, user.uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function solicitarEliminacionCuenta(motivo = "") {
  const user = exigirUsuario();
  const referencia = doc(db, COLECCIONES.solicitudesEliminacion, user.uid);
  const existente = await getDoc(referencia);
  if (existente.exists()) throw new Error(`Ya existe una solicitud de eliminación con estado ${existente.data().estado || "registrada"}.`);
  await setDoc(referencia, { uid: user.uid, correo: user.email || "", motivo: String(motivo || "").trim().slice(0, 500), estado: "Pendiente", solicitadoEn: ahora(), actualizadoEn: ahora() });
  return obtenerSolicitudEliminacion();
}

async function actualizarSolicitudEliminacion(uid, estado, nota = "") {
  const admin = exigirUsuario();
  if (!await esAdmin(admin.uid)) throw new Error("Solo administración puede tramitar eliminaciones.");
  if (!["En proceso", "Completada", "Rechazada"].includes(estado)) throw new Error("Estado de eliminación no válido.");
  const referencia = doc(db, COLECCIONES.solicitudesEliminacion, uid);
  const snapshot = await getDoc(referencia);
  if (!snapshot.exists()) throw new Error("La solicitud de eliminación no existe.");
  await updateDoc(referencia, {
    estado,
    notaAdministrativa: String(nota || "").trim().slice(0, 1000),
    atendidoPorUid: admin.uid,
    atendidoPorCorreo: admin.email || "",
    actualizadoEn: ahora(),
    completadoEn: estado === "Completada" ? ahora() : ""
  });
  await auditar("Solicitud de eliminación actualizada", `${uid}: ${estado}`, [uid]);
}

async function obtenerRevisionNotificaciones() {
  const user = exigirUsuario();
  const snapshot = await getDoc(doc(db, COLECCIONES.preferenciasNotificaciones, user.uid));
  return snapshot.exists() ? String(snapshot.data().notificacionesVistasEn || "") : "";
}

async function guardarRevisionNotificaciones(fecha) {
  const user = exigirUsuario();
  const notificacionesVistasEn = fecha || ahora();
  await setDoc(doc(db, COLECCIONES.preferenciasNotificaciones, user.uid), {
    uid: user.uid,
    notificacionesVistasEn,
    actualizadoEn: ahora()
  }, { merge: true });
  return notificacionesVistasEn;
}

async function crearSolicitud(form) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "cliente") throw new Error("Solo una cuenta de cliente puede crear solicitudes.");
  const adjuntos = form.getAll("archivos").filter((item) => item instanceof File && item.size);
  if (adjuntos.length > 10) throw new Error("Puedes adjuntar como máximo 10 archivos por solicitud.");
  const solicitudRef = doc(collection(db, COLECCIONES.solicitudes));
  const urls = [];
  for (const item of adjuntos) {
    urls.push(await subir(`profesionales-vigna/solicitudes/${user.uid}/${solicitudRef.id}`, item, { maxMb: 25, tipos: ["image/", "video/", "application/pdf"] }));
  }
  const solicitud = {
    id: solicitudRef.id, clienteUid: user.uid, profesionalUid: texto(form, "profesionalId"), profesion: texto(form, "profesion"),
    origen: texto(form, "origen"), tipoNecesidad: texto(form, "tipoNecesidad"), subcategoria: texto(form, "subcategoria"),
    departamento: texto(form, "departamento"), provincia: texto(form, "provincia"), distrito: texto(form, "distrito"),
    presupuesto: texto(form, "presupuesto"), fecha: texto(form, "fecha"), fechaFin: texto(form, "fechaFin"),
    modalidadFecha: texto(form, "modalidadFecha"), urgencia: texto(form, "urgencia"), responsableMateriales: texto(form, "responsableMateriales"),
    situacionActual: texto(form, "situacionActual"), resultadoEsperado: texto(form, "resultadoEsperado"), restricciones: texto(form, "restricciones"),
    descripcion: texto(form, "descripcion"), adjuntos: urls, archivosCantidad: urls.length, autorizacion: form.get("autorizacion") === "on",
    estado: "Enviada", creadoEn: ahora(), actualizadoEn: ahora()
  };
  await setDoc(solicitudRef, solicitud);
  let profesionalesCompatibles = [];
  if (!solicitud.profesionalUid) {
    const aprobados = await porCampo(COLECCIONES.profesionales, "estado", "Aprobado");
    profesionalesCompatibles = aprobados
      .filter((item) => (item.profesiones || []).includes(solicitud.profesion))
      .map((item) => item.uid || item.id);
  }
  await auditar("Solicitud creada", `${solicitudRef.id}: ${solicitud.profesion}`, [user.uid, solicitud.profesionalUid, ...profesionalesCompatibles]);
  return solicitud;
}

async function agregarPortafolio(form) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "profesional") throw new Error("Solo un profesional puede administrar su portafolio.");
  if (form.get("consentimientoPublicacion") !== "on") throw new Error("Confirma la autorización de publicación.");
  const proyectoRef = doc(collection(db, COLECCIONES.portafolios));
  const antes = archivo(form, "antes");
  const despues = archivo(form, "despues");
  const video = archivo(form, "video");
  const procesoSeleccionado = form.getAll("proceso").filter((item) => item instanceof File && item.size);
  if (procesoSeleccionado.length > 8) throw new Error("Puedes adjuntar como máximo 8 fotos del proceso.");
  const proceso = procesoSeleccionado;
  const base = `profesionales-vigna/profesionales/${user.uid}/portafolio/${proyectoRef.id}`;
  const [antesUrl, despuesUrl, videoUrl] = await Promise.all([
    subir(base, antes, { maxMb: 12, tipos: ["image/"] }),
    subir(base, despues, { maxMb: 12, tipos: ["image/"] }),
    subir(base, video, { maxMb: 80, tipos: ["video/"] })
  ]);
  const procesoUrls = [];
  for (const imagen of proceso) procesoUrls.push(await subir(base, imagen, { maxMb: 12, tipos: ["image/"] }));
  const proyecto = {
    id: proyectoRef.id, profesionalUid: user.uid, titulo: texto(form, "titulo"), categoria: texto(form, "categoria"),
    ubicacion: texto(form, "ubicacion"), duracion: texto(form, "duracion"), etiquetas: listaTexto(form.get("etiquetas")),
    reto: texto(form, "reto"), solucion: texto(form, "solucion"), productos: texto(form, "productos"),
    antes: antesUrl, despues: despuesUrl, proceso: procesoUrls, videoUrl, videoNombre: video?.name || "",
    consentimientoPublicacion: true, estado: "Pendiente", observacion: "", creadoEn: ahora(), actualizadoEn: ahora()
  };
  await setDoc(proyectoRef, proyecto);
  await auditar("Proyecto de portafolio agregado", `${user.uid}: ${proyecto.titulo}`, [user.uid]);
  return proyecto;
}

async function moderarPortafolio(proyectoId, estado, observacion = "") {
  const user = exigirUsuario();
  await exigirPermisoAdmin("moderacion");
  if (!["Aprobado", "Observado", "Rechazado", "Oculto"].includes(estado)) throw new Error("Estado de portafolio no permitido.");
  const proyectoRef = doc(db, COLECCIONES.portafolios, proyectoId);
  const snapshot = await getDoc(proyectoRef);
  if (!snapshot.exists()) throw new Error("El proyecto ya no existe.");
  await updateDoc(proyectoRef, { estado, observacion: String(observacion || "").slice(0, 500), revisadoPorUid: user.uid, revisadoEn: ahora(), actualizadoEn: ahora() });
  await auditar("Portafolio moderado", `${proyectoId}: ${estado}`, [snapshot.data().profesionalUid]);
}

async function crearCotizacion(form) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "profesional") throw new Error("Solo un profesional puede cotizar.");
  const solicitudId = texto(form, "solicitudId");
  const solicitudSnapshot = await getDoc(doc(db, COLECCIONES.solicitudes, solicitudId));
  if (!solicitudSnapshot.exists()) throw new Error("La solicitud ya no existe.");
  const solicitud = solicitudSnapshot.data();
  const [perfilSnapshot, identidadSnapshot] = await Promise.all([
    getDoc(doc(db, COLECCIONES.profesionales, user.uid)),
    getDoc(doc(db, COLECCIONES.profesionalesPrivados, user.uid))
  ]);
  const perfil = perfilSnapshot.data() || {};
  const identidad = identidadSnapshot.data() || {};
  const garantiaDias = Number(form.get("garantiaDias") || 0);
  if (!Number.isInteger(garantiaDias) || garantiaDias < 1 || garantiaDias > 3650) {
    throw new Error("Selecciona una vigencia de garantía válida.");
  }
  const cotizacionesProfesional = await porCampo(COLECCIONES.cotizaciones, "profesionalUid", user.uid);
  const anteriores = cotizacionesProfesional.filter((item) => item.solicitudId === solicitudId).sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
  const anterior = anteriores[0] || null;
  const cotizacionRef = doc(collection(db, COLECCIONES.cotizaciones));
  const opcion = (prefijo, nombre) => {
    const materiales = Number(form.get(`${prefijo}Materiales`) || 0);
    const manoObra = Number(form.get(`${prefijo}ManoObra`) || 0);
    const otros = Number(form.get(`${prefijo}Otros`) || 0);
    const precio = Number((materiales + manoObra + otros).toFixed(2));
    if (![materiales, manoObra, otros, precio].every(Number.isFinite) || precio <= 0) {
      throw new Error(`La opción ${nombre} debe tener un desglose válido y un total mayor que cero.`);
    }
    return { nombre, precio, detalle: texto(form, `${prefijo}Detalle`), materiales, manoObra, otros, duracion: texto(form, `${prefijo}Duracion`) };
  };
  const cotizacion = {
    id: cotizacionRef.id, solicitudId, profesionalUid: user.uid, clienteUid: solicitud.clienteUid,
    profesionalNombre: nombreCompleto(perfil), profesionalTipoDocumento: identidad.tipoDocumento || "",
    profesionalDocumento: identidad.documento || "",
    opciones: [opcion("economica", "Económica"), opcion("recomendada", "Recomendada"), opcion("premium", "Premium")],
    garantiaDias, validaHasta: texto(form, "validaHasta"), disponibilidadEstimada: texto(form, "disponibilidadEstimada"),
    responsableMateriales: texto(form, "responsableMateriales"), exclusiones: texto(form, "exclusiones"),
    condiciones: texto(form, "condiciones"), formaPago: texto(form, "formaPago"),
    cotizacionRaizId: anterior?.cotizacionRaizId || anterior?.id || cotizacionRef.id, reemplazaA: anterior?.id || "",
    version: Number(anterior?.version || 0) + 1, estado: "Enviada", creadoEn: ahora(), actualizadoEn: ahora()
  };
  await setDoc(cotizacionRef, cotizacion);
  await auditar("Cotización enviada", `${cotizacionRef.id} para ${solicitudId}`, [user.uid, solicitud.clienteUid]);
  return cotizacion;
}

async function aceptarCotizacion(cotizacionId, opcionIndice) {
  const user = exigirUsuario();
  const clienteSnapshot = await getDoc(doc(db, COLECCIONES.clientes, user.uid));
  if (!clienteSnapshot.exists()) throw new Error("No se encontró el perfil del cliente.");
  const cliente = clienteSnapshot.data();
  const contratoRef = doc(collection(db, COLECCIONES.contratos));
  let profesionalUid = "";
  await runTransaction(db, async (tx) => {
    const cotizacionRef = doc(db, COLECCIONES.cotizaciones, cotizacionId);
    const cotizacionSnapshot = await tx.get(cotizacionRef);
    if (!cotizacionSnapshot.exists()) throw new Error("La cotización ya no existe.");
    const cotizacion = cotizacionSnapshot.data();
    profesionalUid = cotizacion.profesionalUid;
    if (cotizacion.clienteUid !== user.uid) throw new Error("Esta cotización no pertenece a tu cuenta.");
    if (cotizacion.estado === "Aceptada") throw new Error("Esta cotización ya fue aceptada.");
    const solicitudRef = doc(db, COLECCIONES.solicitudes, cotizacion.solicitudId);
    const solicitudSnapshot = await tx.get(solicitudRef);
    const solicitud = solicitudSnapshot.data();
    const opcion = cotizacion.opciones[Number(opcionIndice)];
    if (!opcion) throw new Error("La alternativa elegida no es válida.");
    tx.set(contratoRef, {
      id: contratoRef.id, solicitudId: cotizacion.solicitudId, cotizacionId, profesionalUid: cotizacion.profesionalUid,
      clienteUid: user.uid, opcion: opcion.nombre, total: opcion.precio, detalle: opcion.detalle,
      desglose: { materiales: opcion.materiales || 0, manoObra: opcion.manoObra || 0, otros: opcion.otros || 0 },
      clienteNombre: nombreCompleto(cliente), clienteTipoDocumento: cliente.tipoDocumento || "", clienteDocumento: cliente.documento || "",
      profesionalNombre: cotizacion.profesionalNombre || "", profesionalTipoDocumento: cotizacion.profesionalTipoDocumento || "",
      profesionalDocumento: cotizacion.profesionalDocumento || "",
      garantiaDias: Number(cotizacion.garantiaDias || 0), garantiaInicioEn: "", garantiaVenceEn: "",
      responsableMateriales: cotizacion.responsableMateriales || "Por definir", exclusiones: cotizacion.exclusiones || "",
      cotizacionVersion: Number(cotizacion.version || 1), cotizacionRaizId: cotizacion.cotizacionRaizId || cotizacion.id,
      condiciones: cotizacion.condiciones, formaPago: cotizacion.formaPago || "Según acuerdo documentado entre las partes.",
      version: 1, estado: "Pendiente de firma", archivoFirmado: "", archivoFirmadoUrl: "",
      anexoPlanTrabajoNombre: "", anexoPlanTrabajoRuta: "", anexoPlanTrabajoActualizadoEn: "",
      descripcionSolicitud: solicitud.descripcion || "",
      ubicacion: { departamento: solicitud.departamento, provincia: solicitud.provincia, distrito: solicitud.distrito, direccion: cliente.direccion || "", referencia: cliente.referencia || "", fecha: solicitud.fecha, fechaFin: solicitud.fechaFin || "" },
      restricciones: solicitud.restricciones || "Sin restricciones adicionales declaradas.",
      responsableMaterialesSolicitud: solicitud.responsableMateriales || cotizacion.responsableMateriales || "Por definir",
      creadoEn: ahora(), actualizadoEn: ahora()
    });
    tx.update(cotizacionRef, { estado: "Aceptada", actualizadoEn: ahora() });
    tx.update(solicitudRef, { estado: "Contratada", profesionalUid: cotizacion.profesionalUid, actualizadoEn: ahora() });
  });
  await auditar("Contrato generado", `${contratoRef.id} desde ${cotizacionId}`, [user.uid, profesionalUid]);
  return contratoRef.id;
}

async function registrarContratoFirmado(contratoId, file) {
  const { user, contratoRef, contrato } = await contratoAutorizado(contratoId);
  if (![contrato.clienteUid, contrato.profesionalUid].includes(user.uid)) throw new Error("Solo las partes del contrato pueden registrar el documento firmado.");
  if (!(file instanceof File) || !file.size) throw new Error("Selecciona el documento firmado.");
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const documentoHashSha256 = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  const ruta = await subirPrivado(`profesionales-vigna/contratos/${contratoId}`, file, { maxMb: 15, tipos: ["application/pdf", "image/"] });
  await updateDoc(contratoRef, {
    archivoFirmado: file.name,
    archivoFirmadoRuta: ruta,
    archivoFirmadoUrl: deleteField(),
    documentoHashSha256,
    documentoSubidoPorUid: user.uid,
    confirmacionesFirma: { cliente: user.uid === contrato.clienteUid, profesional: user.uid === contrato.profesionalUid },
    estado: "Pendiente de confirmación",
    actualizadoEn: ahora()
  });
  await auditar("Contrato firmado registrado", `${contratoId}: ${file.name} · SHA-256 ${documentoHashSha256}`, [contrato.clienteUid, contrato.profesionalUid]);
  return ruta;
}

async function confirmarContratoFirmado(contratoId) {
  const user = exigirUsuario();
  const contratoRef = doc(db, COLECCIONES.contratos, contratoId);
  let participantes = [];
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(contratoRef);
    if (!snapshot.exists()) throw new Error("El contrato ya no existe.");
    const contrato = snapshot.data();
    participantes = [contrato.clienteUid, contrato.profesionalUid];
    if (!participantes.includes(user.uid)) throw new Error("Solo las partes del contrato pueden confirmar.");
    if (contrato.estado !== "Pendiente de confirmación") throw new Error("El contrato no está pendiente de confirmación bilateral.");
    if (!contrato.documentoHashSha256 || !contrato.archivoFirmadoRuta) throw new Error("Falta la huella verificable del documento.");
    const confirmaciones = { ...(contrato.confirmacionesFirma || {}) };
    if (user.uid === contrato.clienteUid) confirmaciones.cliente = true;
    if (user.uid === contrato.profesionalUid) confirmaciones.profesional = true;
    tx.update(contratoRef, {
      confirmacionesFirma: confirmaciones,
      estado: confirmaciones.cliente && confirmaciones.profesional ? "Firmado" : "Pendiente de confirmación",
      actualizadoEn: ahora()
    });
  });
  await auditar("Contrato confirmado por una parte", `${contratoId}: ${user.uid}`, participantes);
}

async function registrarAnexoPlanTrabajo(contratoId, file) {
  const { user, contratoRef, contrato } = await contratoAutorizado(contratoId);
  const autorizado = user.uid === contrato.profesionalUid || await esAdmin(user.uid);
  if (!autorizado) throw new Error("Solo el profesional contratado o administración puede adjuntar el plan de trabajo.");
  if (contrato.estado === "Cerrado") throw new Error("El contrato cerrado ya no admite cambios en su plan de trabajo.");
  if (!(file instanceof File) || !file.size || !/\.(xlsx|xls|csv)$/i.test(file.name)) {
    throw new Error("Selecciona una hoja válida en formato XLSX, XLS o CSV.");
  }
  const ruta = await subirPrivado(`profesionales-vigna/contratos/${contratoId}/anexos`, file, {
    maxMb: 10,
    tipos: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/csv"
    ]
  });
  const actualizadoEn = ahora();
  await updateDoc(contratoRef, {
    anexoPlanTrabajoNombre: file.name,
    anexoPlanTrabajoRuta: ruta,
    anexoPlanTrabajoActualizadoEn: actualizadoEn,
    actualizadoEn
  });
  await auditar("Anexo Excel del contrato adjuntado", `${contratoId}: ${file.name}`, [contrato.clienteUid, contrato.profesionalUid]);
  return ruta;
}

async function abrirAnexoPlanTrabajo(contratoId) {
  const { contrato } = await contratoAutorizado(contratoId);
  if (!contrato.anexoPlanTrabajoRuta || !contrato.anexoPlanTrabajoNombre) {
    throw new Error("Este contrato todavía no tiene una hoja de productos y pasos adjunta.");
  }
  return {
    nombre: contrato.anexoPlanTrabajoNombre,
    url: await getDownloadURL(ref(storage, contrato.anexoPlanTrabajoRuta))
  };
}

async function abrirContratoFirmado(contratoId) {
  const { contrato } = await contratoAutorizado(contratoId);
  const ruta = contrato.archivoFirmadoRuta || rutaDesdeUrlStorage(contrato.archivoFirmadoUrl);
  if (!ruta || !contrato.archivoFirmado) throw new Error("Este contrato todavía no tiene un documento firmado.");
  const url = contrato.archivoFirmadoUrl || await getDownloadURL(ref(storage, ruta));
  return {
    nombre: contrato.archivoFirmado,
    url
  };
}

async function enviarMensajeContrato(contratoId, mensaje, file = null) {
  const { user, contrato } = await contratoAutorizado(contratoId);
  const contenido = String(mensaje || "").trim();
  if (contenido.length < 1 || contenido.length > 2000) throw new Error("El mensaje debe tener entre 1 y 2000 caracteres.");
  const mensajeRef = doc(collection(db, COLECCIONES.mensajesContrato));
  let adjunto = null;
  if (file instanceof File && file.size) {
    const ruta = await subirPrivado(`profesionales-vigna/contratos/${contratoId}/mensajes/${mensajeRef.id}`, file, { maxMb: 15, tipos: ["image/", "application/pdf", "video/"] });
    adjunto = { nombre: file.name, ruta, tipo: file.type || "application/octet-stream" };
  }
  const rol = user.uid === contrato.clienteUid ? "cliente" : user.uid === contrato.profesionalUid ? "profesional" : "admin";
  await setDoc(mensajeRef, {
    id: mensajeRef.id, contratoId, solicitudId: contrato.solicitudId, clienteUid: contrato.clienteUid,
    profesionalUid: contrato.profesionalUid, autorUid: user.uid, autorRol: rol, mensaje: contenido,
    adjunto, creadoEn: ahora()
  });
  await auditar("Mensaje contractual enviado", `${contratoId}: ${contenido.slice(0, 120)}`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function abrirAdjuntoMensaje(contratoId, mensajeId) {
  await contratoAutorizado(contratoId);
  const snapshot = await getDoc(doc(db, COLECCIONES.mensajesContrato, mensajeId));
  const mensaje = snapshot.data();
  if (!snapshot.exists() || mensaje.contratoId !== contratoId || !mensaje.adjunto?.ruta) throw new Error("El adjunto ya no está disponible.");
  return { nombre: mensaje.adjunto.nombre, url: await getDownloadURL(ref(storage, mensaje.adjunto.ruta)) };
}

async function solicitarActuacionContrato(contratoId, tipo, motivo) {
  const { user, contrato } = await contratoAutorizado(contratoId);
  const tipos = ["Pausa", "Reanudación", "Cancelación"];
  if (!tipos.includes(tipo)) throw new Error("Actuación contractual no permitida.");
  if (tipo === "Reanudación" && contrato.estado !== "Pausado") throw new Error("Solo puede solicitarse la reanudación de un contrato pausado.");
  if (tipo !== "Reanudación" && !["Firmado", "En ejecución"].includes(contrato.estado)) throw new Error("El estado actual no admite esta solicitud.");
  const detalle = String(motivo || "").trim();
  if (detalle.length < 10 || detalle.length > 1500) throw new Error("Explica el motivo en 10 a 1500 caracteres.");
  const actuacionRef = doc(collection(db, COLECCIONES.actuacionesContrato));
  const solicitanteRol = user.uid === contrato.clienteUid ? "cliente" : user.uid === contrato.profesionalUid ? "profesional" : "admin";
  await setDoc(actuacionRef, {
    id: actuacionRef.id, contratoId, clienteUid: contrato.clienteUid, profesionalUid: contrato.profesionalUid,
    tipo, motivo: detalle, solicitanteUid: user.uid, solicitanteRol, estado: "Solicitada", resolucion: "",
    creadoEn: ahora(), actualizadoEn: ahora()
  });
  await auditar(`${tipo} contractual solicitada`, `${contratoId}: ${detalle.slice(0, 120)}`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function resolverActuacionContrato(actuacionId, decision, resolucion) {
  const user = exigirUsuario();
  await exigirPermisoAdmin("soporte");
  if (!["Aceptada", "Rechazada"].includes(decision)) throw new Error("Decisión no permitida.");
  const detalle = String(resolucion || "").trim();
  if (detalle.length < 10 || detalle.length > 1500) throw new Error("Registra una resolución de 10 a 1500 caracteres.");
  const actuacionRef = doc(db, COLECCIONES.actuacionesContrato, actuacionId);
  const snapshot = await getDoc(actuacionRef);
  if (!snapshot.exists() || snapshot.data().estado !== "Solicitada") throw new Error("La actuación ya no está pendiente.");
  const actuacion = snapshot.data();
  const estadoContrato = actuacion.tipo === "Pausa" ? "Pausado" : actuacion.tipo === "Reanudación" ? "En ejecución" : "Cancelado";
  await runTransaction(db, async (tx) => {
    tx.update(actuacionRef, { estado: decision, resolucion: detalle, resueltoPorUid: user.uid, resueltoEn: ahora(), actualizadoEn: ahora() });
    if (decision === "Aceptada") tx.update(doc(db, COLECCIONES.contratos, actuacion.contratoId), { estado: estadoContrato, actualizadoEn: ahora() });
  });
  await auditar(`${actuacion.tipo} contractual ${decision.toLowerCase()}`, `${actuacion.contratoId}: ${detalle.slice(0, 120)}`, [actuacion.clienteUid, actuacion.profesionalUid]);
}


async function iniciarServicio(contratoId) {
  const { user, contratoRef, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.profesionalUid) throw new Error("Solo el profesional contratado puede iniciar el servicio.");
  if (contrato.estado !== "Firmado") throw new Error("El contrato debe estar firmado antes de iniciar.");
  await updateDoc(contratoRef, {
    estado: "En ejecución",
    iniciadoPorUid: user.uid,
    iniciadoEn: ahora(),
    actualizadoEn: ahora()
  });
  await auditar("Servicio iniciado", contratoId, [contrato.clienteUid, contrato.profesionalUid]);
}

async function finalizarServicio(contratoId, files, nota) {
  const { user, contratoRef, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.profesionalUid) throw new Error("Solo el profesional contratado puede finalizar el servicio.");
  if (contrato.estado !== "En ejecución") throw new Error("El servicio debe estar en ejecución.");
  // Las reglas autorizan estas colecciones por participante. Consultar únicamente
  // por contratoId no permite que Firestore demuestre que todos los resultados
  // pertenecen al usuario autenticado, aunque el contrato sí sea suyo.
  const [hitosProfesional, pagosProfesional, cambiosProfesional] = await Promise.all([
    porCampo(COLECCIONES.hitos, "profesionalUid", user.uid),
    porCampo(COLECCIONES.pagosDeclarados, "profesionalUid", user.uid),
    porCampo(COLECCIONES.ordenesCambio, "profesionalUid", user.uid)
  ]);
  const delContrato = (item) => item.contratoId === contratoId;
  const hitosContrato = hitosProfesional.filter(delContrato);
  const pagosContrato = pagosProfesional.filter(delContrato);
  const cambiosContrato = cambiosProfesional.filter(delContrato);
  if (hitosContrato.some((item) => item.estado !== "Aprobado")) throw new Error("Todos los hitos registrados deben estar aprobados antes de finalizar.");
  if (pagosContrato.some((item) => item.estado === "Declarado")) throw new Error("Confirma o rechaza los pagos declarados antes de finalizar.");
  if (cambiosContrato.some((item) => item.estado === "Propuesta")) throw new Error("Resuelve las órdenes de cambio pendientes antes de finalizar.");
  const evidencias = [...(files || [])].filter((file) => file instanceof File && file.size);
  if (!evidencias.length || evidencias.length > 6) throw new Error("Adjunta entre 1 y 6 evidencias.");
  const informe = String(nota || "").trim();
  if (informe.length < 20) throw new Error("El informe final debe tener al menos 20 caracteres.");
  const subidas = [];
  for (const file of evidencias) {
    const ruta = await subirPrivado(`profesionales-vigna/servicios/${contratoId}/evidencias`, file, { maxMb: 25, tipos: ["image/", "video/"] });
    subidas.push({ nombre: file.name, ruta, tipo: file.type || "application/octet-stream" });
  }
  await updateDoc(contratoRef, {
    estado: "Finalizado",
    evidenciasFinalizacion: subidas,
    notaFinalizacion: informe.slice(0, 1000),
    finalizadoPorUid: user.uid,
    finalizadoEn: ahora(),
    actualizadoEn: ahora()
  });
  await auditar("Servicio finalizado con evidencias", `${contratoId}: ${subidas.length} archivo(s)`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function cerrarServicio(contratoId, calificacion, comentario, aceptacionExpresa = false) {
  const user = exigirUsuario();
  const valor = Number(calificacion);
  const opinion = String(comentario || "").trim();
  if (!Number.isInteger(valor) || valor < 1 || valor > 5) throw new Error("Selecciona una calificación válida.");
  if (opinion.length < 10) throw new Error("El comentario debe tener al menos 10 caracteres.");
  if (aceptacionExpresa !== true) throw new Error("Debes aceptar expresamente el acta de entrega y conformidad.");
  const contratoRef = doc(db, COLECCIONES.contratos, contratoId);
  const resenaRef = doc(db, COLECCIONES.resenas, contratoId);
  let participantes = [];
  let vigenciaGarantia = null;
  await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(contratoRef);
    if (!snapshot.exists()) throw new Error("El contrato ya no existe.");
    const contrato = snapshot.data();
    if (user.uid !== contrato.clienteUid) throw new Error("Solo el cliente del contrato puede confirmar la conformidad.");
    if (contrato.estado !== "Finalizado") throw new Error("El profesional todavía no ha finalizado el servicio.");
    participantes = [contrato.clienteUid, contrato.profesionalUid];
    const cerradoEn = ahora();
    const garantiaDias = Number(contrato.garantiaDias || 0);
    const garantiaVenceEn = garantiaDias > 0
      ? new Date(Date.now() + garantiaDias * 24 * 60 * 60 * 1000).toISOString()
      : "";
    vigenciaGarantia = garantiaDias > 0 ? { garantiaInicioEn: cerradoEn, garantiaVenceEn } : null;
    const actaConformidad = {
      folio: `ACTA-${contratoId}-${Date.parse(cerradoEn)}`,
      version: 1,
      declaracion: "El cliente declara recibido el servicio, revisadas las evidencias y aceptada la entrega conforme.",
      aceptadaPorUid: user.uid,
      aceptadaEn: cerradoEn,
      clienteUid: contrato.clienteUid,
      profesionalUid: contrato.profesionalUid,
      totalContrato: Number(contrato.total || 0),
      evidenciasFinales: Array.isArray(contrato.evidenciasFinalizacion) ? contrato.evidenciasFinalizacion.length : 0
    };
    tx.update(contratoRef, {
      estado: "Cerrado",
      calificacion: valor,
      comentarioCliente: opinion.slice(0, 1000),
      cerradoPorUid: user.uid,
      cerradoEn,
      actaConformidad,
      actualizadoEn: cerradoEn
    });
    tx.set(resenaRef, {
      contratoId,
      clienteUid: contrato.clienteUid,
      profesionalUid: contrato.profesionalUid,
      calificacion: valor,
      comentario: opinion.slice(0, 1000),
      clienteAlias: "Cliente verificado",
      creadoEn: ahora()
    });
  });
  if (vigenciaGarantia) {
    try {
      await updateDoc(contratoRef, { ...vigenciaGarantia, actualizadoEn: ahora() });
    } catch (error) {
      console.warn("El servicio quedó cerrado; la vigencia estructurada se activará cuando se publiquen las reglas Firebase actualizadas.", error);
    }
  }
  await auditar("Servicio confirmado y calificado", `${contratoId}: ${valor}/5`, participantes);
}

async function abrirEvidenciaServicio(contratoId, ruta) {
  const { contrato } = await contratoAutorizado(contratoId);
  const evidencias = Array.isArray(contrato.evidenciasFinalizacion) ? contrato.evidenciasFinalizacion : [];
  const evidencia = evidencias.find((item) => item.ruta === ruta);
  if (!evidencia) throw new Error("La evidencia solicitada no pertenece a este contrato.");
  return { nombre: evidencia.nombre, url: await getDownloadURL(ref(storage, evidencia.ruta)) };
}

async function crearHito(contratoId, titulo, detalle, fechaObjetivo = "") {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.profesionalUid) throw new Error("Solo el profesional contratado puede crear hitos.");
  if (contrato.estado !== "En ejecución") throw new Error("El servicio debe estar en ejecución para crear hitos.");
  const nombre = String(titulo || "").trim();
  const descripcion = String(detalle || "").trim();
  if (nombre.length < 4 || descripcion.length < 10) throw new Error("Describe el hito y su resultado esperado.");
  const hitoRef = doc(collection(db, COLECCIONES.hitos));
  const creadoEn = ahora();
  await setDoc(hitoRef, {
    id: hitoRef.id, contratoId, clienteUid: contrato.clienteUid, profesionalUid: contrato.profesionalUid,
    titulo: nombre.slice(0, 120), detalle: descripcion.slice(0, 1000), fechaObjetivo: String(fechaObjetivo || "").slice(0, 10),
    estado: "Pendiente", evidencias: [], notaProfesional: "", comentarioCliente: "", creadoPorUid: user.uid,
    creadoEn, actualizadoEn: creadoEn
  });
  await auditar("Hito de ejecución creado", `${contratoId}: ${nombre}`, [contrato.clienteUid, contrato.profesionalUid]);
  return hitoRef.id;
}

async function registrarAvanceHito(contratoId, hitoId, files, nota) {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.profesionalUid) throw new Error("Solo el profesional contratado puede registrar avances.");
  if (contrato.estado !== "En ejecución") throw new Error("El servicio debe estar en ejecución.");
  const hitoRef = doc(db, COLECCIONES.hitos, hitoId);
  const snapshot = await getDoc(hitoRef);
  if (!snapshot.exists() || snapshot.data().contratoId !== contratoId) throw new Error("El hito no pertenece a este contrato.");
  if (!["Pendiente", "Observado"].includes(snapshot.data().estado)) throw new Error("Este hito ya fue enviado para revisión.");
  const informe = String(nota || "").trim();
  const evidencias = [...(files || [])].filter((file) => file instanceof File && file.size);
  if (informe.length < 10 || !evidencias.length || evidencias.length > 6) throw new Error("Agrega una nota y entre 1 y 6 evidencias.");
  const subidas = [];
  for (const file of evidencias) {
    const ruta = await subirPrivado(`profesionales-vigna/ejecucion/${contratoId}/hitos/${hitoId}/${user.uid}`, file, { maxMb: 25, tipos: ["image/", "video/", "application/pdf"] });
    subidas.push({ nombre: file.name, ruta, tipo: file.type || "application/octet-stream" });
  }
  await updateDoc(hitoRef, {
    estado: "En revisión", evidencias: subidas, notaProfesional: informe.slice(0, 1000), comentarioCliente: "",
    enviadoPorUid: user.uid, enviadoEn: ahora(), actualizadoEn: ahora()
  });
  await auditar("Hito enviado a revisión", `${contratoId}: ${snapshot.data().titulo}`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function resolverHito(contratoId, hitoId, decision, comentario = "") {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.clienteUid) throw new Error("Solo el cliente puede revisar el hito.");
  if (!["Aprobado", "Observado"].includes(decision)) throw new Error("Decisión de hito no permitida.");
  const hitoRef = doc(db, COLECCIONES.hitos, hitoId);
  const snapshot = await getDoc(hitoRef);
  if (!snapshot.exists() || snapshot.data().contratoId !== contratoId || snapshot.data().estado !== "En revisión") throw new Error("El hito no está disponible para revisión.");
  const respuesta = String(comentario || "").trim();
  if (decision === "Observado" && respuesta.length < 5) throw new Error("Indica qué debe corregirse.");
  await updateDoc(hitoRef, { estado: decision, comentarioCliente: respuesta.slice(0, 1000), revisadoPorUid: user.uid, revisadoEn: ahora(), actualizadoEn: ahora() });
  await auditar(`Hito ${decision.toLowerCase()}`, `${contratoId}: ${snapshot.data().titulo}`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function declararPago(contratoId, datos, file = null) {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.clienteUid) throw new Error("Solo el cliente puede declarar pagos.");
  if (!["En ejecución", "Finalizado"].includes(contrato.estado)) throw new Error("El contrato no admite nuevos pagos declarados.");
  const monto = Number(datos?.monto);
  const metodo = String(datos?.metodo || "").trim();
  if (!Number.isFinite(monto) || monto <= 0 || !metodo) throw new Error("Indica un monto y método de pago válidos.");
  const pagoRef = doc(collection(db, COLECCIONES.pagosDeclarados));
  const creadoEn = ahora();
  await setDoc(pagoRef, {
    id: pagoRef.id, contratoId, clienteUid: contrato.clienteUid, profesionalUid: contrato.profesionalUid,
    monto, metodo: metodo.slice(0, 80), referencia: String(datos?.referencia || "").trim().slice(0, 120),
    fechaPago: String(datos?.fechaPago || "").slice(0, 10), nota: String(datos?.nota || "").trim().slice(0, 500),
    comprobante: null, estado: "Declarado", creadoPorUid: user.uid, creadoEn, actualizadoEn: creadoEn
  });
  if (file instanceof File && file.size) {
    const ruta = await subirPrivado(`profesionales-vigna/ejecucion/${contratoId}/pagos/${pagoRef.id}/${user.uid}`, file, { maxMb: 15, tipos: ["image/", "application/pdf"] });
    await updateDoc(pagoRef, { comprobante: { nombre: file.name, ruta, tipo: file.type || "application/octet-stream" }, actualizadoEn: ahora() });
  }
  await auditar("Pago declarado por el cliente", `${contratoId}: S/ ${monto.toFixed(2)}`, [contrato.clienteUid, contrato.profesionalUid]);
  return pagoRef.id;
}

async function resolverPago(contratoId, pagoId, decision, comentario = "") {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (user.uid !== contrato.profesionalUid) throw new Error("Solo el profesional puede confirmar o rechazar el pago declarado.");
  if (!["Confirmado", "Rechazado"].includes(decision)) throw new Error("Decisión de pago no permitida.");
  const pagoRef = doc(db, COLECCIONES.pagosDeclarados, pagoId);
  const snapshot = await getDoc(pagoRef);
  if (!snapshot.exists() || snapshot.data().contratoId !== contratoId || snapshot.data().estado !== "Declarado") throw new Error("El pago ya no está pendiente.");
  await updateDoc(pagoRef, { estado: decision, comentarioProfesional: String(comentario || "").trim().slice(0, 500), revisadoPorUid: user.uid, revisadoEn: ahora(), actualizadoEn: ahora() });
  await auditar(`Pago ${decision.toLowerCase()}`, `${contratoId}: ${pagoId}`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function proponerOrdenCambio(contratoId, datos) {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (![contrato.clienteUid, contrato.profesionalUid].includes(user.uid)) throw new Error("No participas en este contrato.");
  if (contrato.estado !== "En ejecución") throw new Error("Las órdenes de cambio solo se crean durante la ejecución.");
  const descripcion = String(datos?.descripcion || "").trim();
  const motivo = String(datos?.motivo || "").trim();
  const impactoMonto = Number(datos?.impactoMonto || 0);
  const impactoDias = Number(datos?.impactoDias || 0);
  if (descripcion.length < 10 || motivo.length < 5 || !Number.isFinite(impactoMonto) || !Number.isInteger(impactoDias)) throw new Error("Describe el cambio, su motivo y sus impactos.");
  const ordenRef = doc(collection(db, COLECCIONES.ordenesCambio));
  const creadoEn = ahora();
  await setDoc(ordenRef, {
    id: ordenRef.id, contratoId, clienteUid: contrato.clienteUid, profesionalUid: contrato.profesionalUid,
    descripcion: descripcion.slice(0, 1000), motivo: motivo.slice(0, 500), impactoMonto, impactoDias,
    proponenteUid: user.uid, proponenteRol: user.uid === contrato.clienteUid ? "cliente" : "profesional",
    estado: "Propuesta", respuesta: "", creadoEn, actualizadoEn: creadoEn
  });
  await auditar("Orden de cambio propuesta", `${contratoId}: ${descripcion.slice(0, 80)}`, [contrato.clienteUid, contrato.profesionalUid]);
  return ordenRef.id;
}

async function resolverOrdenCambio(contratoId, ordenId, decision, respuesta = "") {
  const { user, contrato } = await contratoAutorizado(contratoId);
  if (!["Aceptada", "Rechazada"].includes(decision)) throw new Error("Decisión de orden no permitida.");
  const ordenRef = doc(db, COLECCIONES.ordenesCambio, ordenId);
  const snapshot = await getDoc(ordenRef);
  if (!snapshot.exists()) throw new Error("La orden ya no existe.");
  const orden = snapshot.data();
  if (orden.contratoId !== contratoId || orden.estado !== "Propuesta") throw new Error("La orden ya no está pendiente.");
  if (orden.proponenteUid === user.uid || ![contrato.clienteUid, contrato.profesionalUid].includes(user.uid)) throw new Error("La otra parte debe resolver esta orden.");
  await updateDoc(ordenRef, { estado: decision, respuesta: String(respuesta || "").trim().slice(0, 500), resueltoPorUid: user.uid, resueltoEn: ahora(), actualizadoEn: ahora() });
  await auditar(`Orden de cambio ${decision.toLowerCase()}`, `${contratoId}: ${ordenId}`, [contrato.clienteUid, contrato.profesionalUid]);
}

async function abrirEvidenciaEjecucion(contratoId, tipo, registroId, ruta) {
  await contratoAutorizado(contratoId);
  const coleccion = tipo === "hito" ? COLECCIONES.hitos : COLECCIONES.pagosDeclarados;
  const snapshot = await getDoc(doc(db, coleccion, registroId));
  if (!snapshot.exists() || snapshot.data().contratoId !== contratoId) throw new Error("El archivo no pertenece a este contrato.");
  const datos = snapshot.data();
  const archivos = tipo === "hito" ? (datos.evidencias || []) : (datos.comprobante ? [datos.comprobante] : []);
  const evidencia = archivos.find((item) => item.ruta === ruta);
  if (!evidencia) throw new Error("El archivo solicitado no está registrado.");
  return { nombre: evidencia.nombre, url: await getDownloadURL(ref(storage, evidencia.ruta)) };
}

async function cambiarEstadoProfesional(uid, estado) {
  const user = exigirUsuario();
  await exigirPermisoAdmin("moderacion");
  if (!['Aprobado', 'Pendiente', 'Observado', 'Suspendido', 'Rechazado'].includes(estado)) throw new Error("Estado no permitido.");
  if (estado === "Aprobado") {
    const especialidades = await porCampo(COLECCIONES.profesionesProfesional, "profesionalUid", uid);
    if (!especialidades.some((item) => item.estado === "Aprobada")) throw new Error("Aprueba al menos una profesión antes de publicar el perfil.");
  }
  await updateDoc(doc(db, COLECCIONES.profesionales, uid), { estado, revisadoPorUid: user.uid, actualizadoEn: ahora() });
  await auditar("Estado profesional actualizado", `${uid}: ${estado}`, [uid]);
}

async function cambiarEstadoEspecialidad(especialidadId, estado, observacion = "") {
  const user = exigirUsuario();
  await exigirPermisoAdmin("moderacion");
  if (!['Aprobada', 'Pendiente', 'Observada', 'Suspendida', 'Rechazada', 'Vencida'].includes(estado)) throw new Error("Estado de especialidad no permitido.");
  const especialidadRef = doc(db, COLECCIONES.profesionesProfesional, especialidadId);
  const snapshot = await getDoc(especialidadRef);
  if (!snapshot.exists()) throw new Error("La especialidad ya no existe.");
  await updateDoc(especialidadRef, { estado, observacion: String(observacion || "").slice(0, 500), revisadoPorUid: user.uid, revisadoEn: ahora(), actualizadoEn: ahora() });
  await auditar("Especialidad profesional actualizada", `${snapshot.data().profesion}: ${estado}`, [snapshot.data().profesionalUid]);
}

async function crearEspecialidad(datos = {}) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "profesional") throw new Error("Solo el profesional puede registrar una profesión.");
  const profesion = String(datos.profesion || "").trim().slice(0, 120);
  if (profesion.length < 3) throw new Error("Selecciona una profesión válida.");

  const propias = await porCampo(COLECCIONES.profesionesProfesional, "profesionalUid", user.uid);
  if (propias.some((item) => String(item.profesion || "").trim().toLocaleLowerCase("es") === profesion.toLocaleLowerCase("es"))) {
    throw new Error("Esta profesión ya está registrada en tu perfil.");
  }
  if (propias.length >= 10) throw new Error("Puedes registrar hasta 10 profesiones.");

  const perfilRef = doc(db, COLECCIONES.profesionales, user.uid);
  const idSeguro = limpiarNombre(profesion.toLocaleLowerCase("es")).replace(/^[-.]+|[-.]+$/g, "") || "profesion";
  const especialidadRef = doc(db, COLECCIONES.profesionesProfesional, `${user.uid}-${idSeguro}`);
  const principal = propias.length === 0 || datos.principal === true;
  const experiencia = Math.max(0, Math.min(80, Number(datos.experiencia || 0)));
  const descripcion = String(datos.descripcion || "").trim().slice(0, 1500);
  const fecha = ahora();

  await runTransaction(db, async (tx) => {
    const [perfilSnapshot, especialidadSnapshot] = await Promise.all([tx.get(perfilRef), tx.get(especialidadRef)]);
    if (!perfilSnapshot.exists()) throw new Error("No se encontró el perfil profesional.");
    if (especialidadSnapshot.exists()) throw new Error("Esta profesión ya está registrada en tu perfil.");
    const perfil = perfilSnapshot.data();
    const profesiones = [...new Set([...(perfil.profesiones || []), profesion])].slice(0, 10);
    propias.forEach((item) => {
      if (principal && item.principal) tx.update(doc(db, COLECCIONES.profesionesProfesional, item.id), { principal: false, actualizadoEn: fecha });
    });
    tx.set(especialidadRef, {
      id: especialidadRef.id,
      profesionalUid: user.uid,
      profesion,
      principal,
      experiencia,
      descripcion,
      evidencias: [],
      estado: "Pendiente",
      calificacion: 0,
      trabajos: 0,
      creadoEn: fecha,
      actualizadoEn: fecha
    });
    tx.update(perfilRef, {
      profesiones,
      profesionPrincipal: principal ? profesion : (perfil.profesionPrincipal || profesiones[0]),
      actualizadoEn: fecha
    });
  });
  await auditar("Profesión registrada", `${profesion}: pendiente de revisión`, [user.uid]);
}

async function migrarProfesionesLegadas(uid) {
  const user = exigirUsuario();
  await exigirPermisoAdmin("moderacion");
  const perfilRef = doc(db, COLECCIONES.profesionales, uid);
  const perfilSnapshot = await getDoc(perfilRef);
  if (!perfilSnapshot.exists()) throw new Error("No se encontró el perfil profesional.");
  const perfil = perfilSnapshot.data();
  const existentes = await porCampo(COLECCIONES.profesionesProfesional, "profesionalUid", uid);
  const registradas = new Set(existentes.map((item) => String(item.profesion || "").trim().toLocaleLowerCase("es")));
  const faltantes = [...new Set(perfil.profesiones || [])]
    .map((item) => String(item || "").trim().slice(0, 120))
    .filter((item) => item.length >= 3 && !registradas.has(item.toLocaleLowerCase("es")))
    .slice(0, Math.max(0, 10 - existentes.length));
  if (!faltantes.length) throw new Error("Este perfil no tiene profesiones antiguas pendientes de registrar.");
  const fecha = ahora();
  await Promise.all(faltantes.map((profesion) => {
    const idSeguro = limpiarNombre(profesion.toLocaleLowerCase("es")).replace(/^[-.]+|[-.]+$/g, "") || "profesion";
    const especialidadRef = doc(db, COLECCIONES.profesionesProfesional, `${uid}-${idSeguro}`);
    return setDoc(especialidadRef, {
      id: especialidadRef.id,
      profesionalUid: uid,
      profesion,
      principal: profesion === perfil.profesionPrincipal || (!existentes.length && profesion === faltantes[0]),
      experiencia: Math.max(0, Math.min(80, Number(perfil.experiencia || 0))),
      descripcion: "",
      evidencias: [],
      estado: "Pendiente",
      calificacion: 0,
      trabajos: 0,
      creadoEn: fecha,
      actualizadoEn: fecha
    }, { merge: false });
  }));
  await auditar("Profesiones antiguas registradas", `${uid}: ${faltantes.join(", ")}`, [uid, user.uid]);
}

async function actualizarEspecialidad(especialidadId, datos, files = []) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "profesional") throw new Error("Solo el profesional puede actualizar su especialidad.");
  const especialidadRef = doc(db, COLECCIONES.profesionesProfesional, especialidadId);
  const snapshot = await getDoc(especialidadRef);
  if (!snapshot.exists() || snapshot.data().profesionalUid !== user.uid) throw new Error("La especialidad no pertenece a tu cuenta.");
  const existentes = Array.isArray(snapshot.data().evidencias) ? snapshot.data().evidencias : [];
  const adjuntos = [...files].filter((file) => file instanceof File && file.size).slice(0, Math.max(0, 6 - existentes.length));
  const nuevas = [];
  for (const file of adjuntos) {
    const ruta = await subirPrivado(`profesionales-vigna/profesionales/${user.uid}/especialidades/${especialidadId}`, file, { maxMb: 12, tipos: ["image/", "application/pdf"] });
    nuevas.push({ nombre: file.name, ruta, tipo: file.type || "application/octet-stream", creadoEn: ahora() });
  }
  const descripcion = String(datos.descripcion || "").trim();
  const experiencia = Math.max(0, Math.min(80, Number(datos.experiencia || 0)));
  const contenidoCambiado = descripcion !== String(snapshot.data().descripcion || "") ||
    experiencia !== Number(snapshot.data().experiencia || 0) || nuevas.length > 0;
  const fecha = ahora();
  const actualizacion = {
    principal: datos.principal === true,
    experiencia,
    descripcion: descripcion.slice(0, 1500),
    evidencias: [...existentes, ...nuevas],
    actualizadoEn: fecha
  };
  if (contenidoCambiado) actualizacion.estado = "Pendiente";
  const operaciones = [updateDoc(especialidadRef, actualizacion)];
  if (datos.principal === true) {
    const propias = await porCampo(COLECCIONES.profesionesProfesional, "profesionalUid", user.uid);
    propias.filter((item) => item.id !== especialidadId && item.principal).forEach((item) => {
      operaciones.push(updateDoc(doc(db, COLECCIONES.profesionesProfesional, item.id), { principal: false, actualizadoEn: fecha }));
    });
    operaciones.push(updateDoc(doc(db, COLECCIONES.profesionales, user.uid), {
      profesionPrincipal: snapshot.data().profesion,
      actualizadoEn: fecha
    }));
  }
  await Promise.all(operaciones);
  await auditar("Especialidad profesional actualizada", `${snapshot.data().profesion}: ${nuevas.length} evidencia(s) nueva(s)`, [user.uid]);
}

async function abrirEvidenciaEspecialidad(especialidadId, ruta) {
  const user = exigirUsuario();
  const snapshot = await getDoc(doc(db, COLECCIONES.profesionesProfesional, especialidadId));
  if (!snapshot.exists()) throw new Error("La especialidad ya no existe.");
  const especialidad = snapshot.data();
  if (especialidad.profesionalUid !== user.uid && !(await esAdmin(user.uid))) throw new Error("No tienes acceso a esta evidencia.");
  const evidencia = (especialidad.evidencias || []).find((item) => item.ruta === ruta);
  if (!evidencia) throw new Error("La evidencia no está registrada.");
  return { nombre: evidencia.nombre, url: await getDownloadURL(ref(storage, evidencia.ruta)) };
}

const PLANES = Object.freeze({
  Mensual: { precio: 19.90, meses: 1 },
  Semestral: { precio: 99.90, meses: 7 },
  Anual: { precio: 199.90, meses: 14 }
});

const PLANES_API = Object.freeze({ Mensual: "mensual", Semestral: "semestral", Anual: "anual" });

function esPlataformaNativa() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

function obtenerApiPagosUrl() {
  const configurada = String(window.VIGNA_CONFIG?.apiPagosUrl || "").trim();
  if (configurada) return configurada.replace(/\/$/, "");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://localhost:3000";
  return "";
}

async function solicitarPlanProfesional(tipo) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "profesional") throw new Error("Solo un profesional puede solicitar un plan.");
  const configuracion = PLANES[tipo];
  if (!configuracion) throw new Error("Plan profesional no permitido.");
  const plan = {
    uid: user.uid, profesionalUid: user.uid, tipo, precio: configuracion.precio, meses: configuracion.meses,
    estado: "Pendiente de pago", solicitadoEn: ahora(), activadoEn: "", venceEn: "", actualizadoEn: ahora()
  };
  await setDoc(doc(db, COLECCIONES.planesProfesionales, user.uid), plan, { merge: true });
  await auditar("Plan profesional solicitado", `${tipo}: S/ ${configuracion.precio.toFixed(2)}`, [user.uid]);
  return plan;
}

async function iniciarPagoPlanProfesional(tipo) {
  const user = exigirUsuario();
  if (await obtenerRol(user.uid) !== "profesional") throw new Error("Solo un profesional puede adquirir un plan.");
  if (!PLANES_API[tipo]) throw new Error("Plan profesional no permitido.");
  if (esPlataformaNativa()) {
    throw new Error("La compra del plan se habilitará mediante la tienda de tu dispositivo. Tu cuenta y tus planes web seguirán sincronizados.");
  }
  const apiPagosUrl = obtenerApiPagosUrl();
  if (!apiPagosUrl) throw new Error("El servidor de pagos todavía no está configurado.");

  const idToken = await user.getIdToken(true);
  const respuesta = await fetch(`${apiPagosUrl}/crear-pago-plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ planId: PLANES_API[tipo] })
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !datos.init_point) throw new Error(datos.error || "No se pudo iniciar el pago del plan.");
  return datos;
}

async function verificarPagoPlanProfesional(paymentId) {
  const user = exigirUsuario();
  const apiPagosUrl = obtenerApiPagosUrl();
  if (!apiPagosUrl) throw new Error("El servidor de pagos todavía no está configurado.");
  if (!/^\d{1,30}$/.test(String(paymentId || ""))) throw new Error("El identificador del pago no es válido.");
  const idToken = await user.getIdToken(true);
  const respuesta = await fetch(`${apiPagosUrl}/verificar-pago-plan/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok || !datos.aprobado) throw new Error(datos.error || "El pago todavía no figura como aprobado.");
  return datos;
}

async function descargarPdfContrato(contratoId) {
  const user = exigirUsuario();
  const apiPagosUrl = obtenerApiPagosUrl();
  if (!apiPagosUrl) throw new Error("El servidor todavía no está configurado para generar documentos.");
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(String(contratoId || ""))) throw new Error("El contrato no es válido.");
  const idToken = await user.getIdToken(true);
  const respuesta = await fetch(`${apiPagosUrl}/api/profesionales/contratos/${encodeURIComponent(contratoId)}/pdf`, {
    headers: { Authorization: `Bearer ${idToken}` }
  });
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new Error(datos.error || "No se pudo generar el PDF contractual.");
  }
  return { nombre: `contrato-${contratoId}.pdf`, url: URL.createObjectURL(await respuesta.blob()) };
}

async function obtenerPlanProfesionalPropio() {
  const user = exigirUsuario();
  const snapshot = await getDoc(doc(db, COLECCIONES.planesProfesionales, user.uid));
  return snapshot.exists()
    ? normalizarPlanPropio({ ...snapshot.data(), id: snapshot.id }, user.uid)
    : null;
}

async function activarPlanProfesional(uid, tipo = "") {
  const user = exigirUsuario();
  await exigirPermisoAdmin("finanzas");
  const planRef = doc(db, COLECCIONES.planesProfesionales, uid);
  const snapshot = await getDoc(planRef);
  const planActual = snapshot.data() || {};
  const vencimientoActual = Date.parse(planActual.venceEn || "");
  if (planActual.estado === "Activo" && (!Number.isFinite(vencimientoActual) || vencimientoActual > Date.now())) {
    throw new Error("El profesional ya tiene un plan activo.");
  }
  const nombrePlan = tipo || planActual.tipo;
  const configuracion = PLANES[nombrePlan];
  if (!configuracion) throw new Error("El profesional no tiene una solicitud de plan válida.");
  const activadoEn = ahora();
  const vence = new Date();
  vence.setMonth(vence.getMonth() + configuracion.meses);
  const venceEn = vence.toISOString();
  await Promise.all([
    setDoc(planRef, { uid, profesionalUid: uid, tipo: nombrePlan, precio: configuracion.precio, meses: configuracion.meses, estado: "Activo", activadoEn, venceEn, actualizadoEn: activadoEn }, { merge: true }),
    updateDoc(doc(db, COLECCIONES.profesionales, uid), { plan: nombrePlan, planEstado: "Activo", planInicioEn: activadoEn, planVenceEn: venceEn, actualizadoEn: activadoEn })
  ]);
  await auditar("Plan profesional activado", `${uid}: ${nombrePlan} hasta ${venceEn}`, [uid]);
}

const documentos = async (consulta) => (await getDocs(consulta)).docs.map((item) => ({ ...item.data(), id: item.id }));
const todos = (nombre) => documentos(collection(db, nombre));
const porCampo = (nombre, campo, valor) => documentos(query(collection(db, nombre), where(campo, "==", valor)));
const porArray = (nombre, campo, valor) => documentos(query(collection(db, nombre), where(campo, "array-contains", valor)));

async function consultaSecundaria(tarea, descripcion, respaldo = []) {
  try {
    return await tarea();
  } catch (error) {
    console.warn(`No se pudo cargar ${descripcion}; el resto del panel seguirá disponible.`, error);
    return respaldo;
  }
}

async function cargarDatos() {
  const user = auth.currentUser;
  const rol = await obtenerRol(user?.uid);
  const registroUsuario = user ? await getDoc(doc(db, COLECCIONES.usuarios, user.uid)) : null;
  const registroIncompleto = Boolean(user && registroUsuario?.data()?.estadoRegistro !== "completo");
  const adminRol = rol === "admin" ? await obtenerAdminRol(user?.uid) : "";
  let profesionales = await consultaSecundaria(
    () => porCampo(COLECCIONES.profesionales, "estado", "Aprobado"),
    "el catálogo público"
  );
  let clientes = [];
  let solicitudes = [];
  let cotizaciones = [];
  let contratos = [];
  let auditoria = [];
  let resenas = [];
  let hitos = [];
  let pagosDeclarados = [];
  let ordenesCambio = [];
  let especialidades = [];
  let planesProfesionales = [];
  let portafolios = [];
  let mensajesContrato = [];
  let actuacionesContrato = [];
  let solicitudesEliminacion = [];
  try {
    resenas = await todos(COLECCIONES.resenas);
  } catch (error) {
    console.warn("Las reseñas se activarán cuando se publiquen las reglas actualizadas.", error);
  }
  try {
    especialidades = await porCampo(COLECCIONES.profesionesProfesional, "estado", "Aprobada");
  } catch (error) {
    console.warn("Las especialidades independientes se activarán cuando se publiquen las reglas actualizadas.", error);
  }
  try {
    portafolios = await porCampo(COLECCIONES.portafolios, "estado", "Aprobado");
  } catch (error) {
    console.warn("El portafolio moderado se activará cuando se publiquen las reglas actualizadas.", error);
  }
  const anexarProfesional = () => {
    const especialidadesPorUid = new Map();
    especialidades.forEach((item) => {
      const lista = especialidadesPorUid.get(item.profesionalUid) || [];
      lista.push(item);
      especialidadesPorUid.set(item.profesionalUid, lista);
    });
    const planesPorUid = new Map(planesProfesionales.map((item) => [item.profesionalUid || item.uid || item.id, item]));
    const portafoliosPorUid = new Map();
    portafolios.forEach((item) => {
      const lista = portafoliosPorUid.get(item.profesionalUid) || [];
      lista.push(item);
      portafoliosPorUid.set(item.profesionalUid, lista);
    });
    profesionales = profesionales.map((item) => ({
      ...item,
      especialidades: especialidadesPorUid.get(item.uid || item.id) || [],
      planRegistro: planesPorUid.get(item.uid || item.id) || null,
      portafolio: [...new Map([...(portafoliosPorUid.get(item.uid || item.id) || []), ...(item.portafolio || [])].map((proyecto) => [proyecto.id, proyecto])).values()]
    }));
  };
  if (!user) {
    anexarProfesional();
    return { version: 1, profesionales, clientes, solicitudes, cotizaciones, contratos, hitos, pagosDeclarados, ordenesCambio, mensajesContrato, actuacionesContrato, especialidades, planesProfesionales, portafolios, resenas, auditoria, nube: true, rol, adminRol };
  }

  if (rol === "admin") {
    [profesionales, clientes, solicitudes, cotizaciones, contratos, hitos, pagosDeclarados, ordenesCambio, mensajesContrato, actuacionesContrato, especialidades, planesProfesionales, portafolios, auditoria, solicitudesEliminacion] = await Promise.all([
      todos(COLECCIONES.profesionales), todos(COLECCIONES.clientes), todos(COLECCIONES.solicitudes),
      todos(COLECCIONES.cotizaciones), todos(COLECCIONES.contratos), todos(COLECCIONES.hitos),
      todos(COLECCIONES.pagosDeclarados), todos(COLECCIONES.ordenesCambio), todos(COLECCIONES.mensajesContrato), todos(COLECCIONES.actuacionesContrato), todos(COLECCIONES.profesionesProfesional),
      todos(COLECCIONES.planesProfesionales), todos(COLECCIONES.portafolios), todos(COLECCIONES.auditoria), todos(COLECCIONES.solicitudesEliminacion)
    ]);
    const privados = await todos(COLECCIONES.profesionalesPrivados);
    const privadosPorUid = new Map(privados.map((item) => [item.uid || item.id, item]));
    profesionales = profesionales.map((item) => ({
      ...item,
      privado: privadosPorUid.get(item.uid || item.id) || null
    }));
  } else if (rol === "cliente") {
    const [clienteSnapshot, solicitudesCliente, cotizacionesCliente, contratosCliente, hitosCliente, pagosCliente, ordenesCliente, mensajesCliente, actuacionesCliente, auditoriaCliente] = await Promise.all([
      getDoc(doc(db, COLECCIONES.clientes, user.uid)), porCampo(COLECCIONES.solicitudes, "clienteUid", user.uid),
      porCampo(COLECCIONES.cotizaciones, "clienteUid", user.uid), porCampo(COLECCIONES.contratos, "clienteUid", user.uid),
      porCampo(COLECCIONES.hitos, "clienteUid", user.uid), porCampo(COLECCIONES.pagosDeclarados, "clienteUid", user.uid),
      porCampo(COLECCIONES.ordenesCambio, "clienteUid", user.uid),
      porCampo(COLECCIONES.mensajesContrato, "clienteUid", user.uid),
      porCampo(COLECCIONES.actuacionesContrato, "clienteUid", user.uid),
      porArray(COLECCIONES.auditoria, "participantes", user.uid)
    ]);
    clientes = clienteSnapshot.exists() ? [{ id: clienteSnapshot.id, ...clienteSnapshot.data() }] : [];
    solicitudes = solicitudesCliente;
    cotizaciones = cotizacionesCliente;
    contratos = contratosCliente;
    hitos = hitosCliente;
    pagosDeclarados = pagosCliente;
    ordenesCambio = ordenesCliente;
    mensajesContrato = mensajesCliente;
    actuacionesContrato = actuacionesCliente;
    auditoria = auditoriaCliente;
  } else if (rol === "profesional") {
    const perfil = await getDoc(doc(db, COLECCIONES.profesionales, user.uid));
    if (!perfil.exists()) {
      anexarProfesional();
      const adaptarIncompleto = (items) => items.map((item) => ({ ...item, clienteId: item.clienteUid || item.clienteId, profesionalId: item.profesionalUid || item.profesionalId, actor: item.actorEmail || item.actorUid || "Sistema" }));
      return {
        version: 1, usuarioUid: user.uid, registroIncompleto: true, profesionales: adaptarIncompleto(profesionales), clientes: [], solicitudes: [], cotizaciones: [], contratos: [], hitos: [],
        pagosDeclarados: [], ordenesCambio: [], mensajesContrato: [], actuacionesContrato: [], especialidades: [], planesProfesionales: [],
        portafolios: adaptarIncompleto(portafolios), resenas: adaptarIncompleto(resenas), auditoria: [], solicitudesEliminacion: [], nube: true, rol, adminRol
      };
    }
    if (registroIncompleto) {
      await consultaSecundaria(() => setDoc(doc(db, COLECCIONES.usuarios, user.uid), {
        uid: user.uid,
        rol: "profesional",
        correo: user.email || registroUsuario?.data()?.correo || "",
        estadoRegistro: "completo"
      }, { merge: true }), "la reparación del marcador de registro", null);
    }
    const perfilDatos = normalizarPerfilPropio({ id: perfil.id, data: perfil.data() }, user.uid);
    if (!perfilDatos) throw new Error("El perfil profesional no corresponde a la sesión autenticada.");
    profesionales = [
      perfilDatos,
      ...profesionales.filter((item) => item.id !== perfil.id && item.uid !== user.uid)
    ];
    const [especialidadesPropias, planSnapshot, portafolioPropio] = await Promise.all([
      consultaSecundaria(() => porCampo(COLECCIONES.profesionesProfesional, "profesionalUid", user.uid), "las profesiones propias"),
      consultaSecundaria(() => getDoc(doc(db, COLECCIONES.planesProfesionales, user.uid)), "el plan propio", null),
      consultaSecundaria(() => porCampo(COLECCIONES.portafolios, "profesionalUid", user.uid), "el portafolio propio")
    ]);
    const planPropio = planSnapshot?.exists()
      ? normalizarPlanPropio({ ...planSnapshot.data(), id: planSnapshot.id }, user.uid)
      : null;
    especialidades = [...new Map([...especialidades, ...especialidadesPropias].map((item) => [item.id, item])).values()];
    planesProfesionales = planPropio ? [planPropio] : [];
    portafolios = [...new Map([...portafolios, ...portafolioPropio].map((item) => [item.id, item])).values()];
    const asignadas = await consultaSecundaria(() => porCampo(COLECCIONES.solicitudes, "profesionalUid", user.uid), "las solicitudes asignadas");
    const compatibles = [];
    for (const profesion of (perfilDatos.profesiones || []).slice(0, 10)) {
      compatibles.push(...await consultaSecundaria(() => porCampo(COLECCIONES.solicitudes, "profesion", profesion), `las solicitudes de ${profesion}`));
    }
    [cotizaciones, contratos, hitos, pagosDeclarados, ordenesCambio, mensajesContrato, actuacionesContrato, auditoria] = await Promise.all([
      consultaSecundaria(() => porCampo(COLECCIONES.cotizaciones, "profesionalUid", user.uid), "las cotizaciones propias"),
      consultaSecundaria(() => porCampo(COLECCIONES.contratos, "profesionalUid", user.uid), "los contratos propios"),
      consultaSecundaria(() => porCampo(COLECCIONES.hitos, "profesionalUid", user.uid), "los hitos propios"),
      consultaSecundaria(() => porCampo(COLECCIONES.pagosDeclarados, "profesionalUid", user.uid), "los pagos declarados propios"),
      consultaSecundaria(() => porCampo(COLECCIONES.ordenesCambio, "profesionalUid", user.uid), "las órdenes de cambio propias"),
      consultaSecundaria(() => porCampo(COLECCIONES.mensajesContrato, "profesionalUid", user.uid), "los mensajes propios"),
      consultaSecundaria(() => porCampo(COLECCIONES.actuacionesContrato, "profesionalUid", user.uid), "las actuaciones propias"),
      consultaSecundaria(() => porArray(COLECCIONES.auditoria, "participantes", user.uid), "la auditoría propia")
    ]);
    solicitudes = [...new Map([...asignadas, ...compatibles].map((item) => [item.id, item])).values()];
  }
  anexarProfesional();
  const adaptar = (items) => items.map((item) => ({ ...item, clienteId: item.clienteUid || item.clienteId, profesionalId: item.profesionalUid || item.profesionalId, actor: item.actorEmail || item.actorUid || "Sistema" }));
  return { version: 1, usuarioUid: user.uid, profesionales: adaptar(profesionales), clientes: adaptar(clientes), solicitudes: adaptar(solicitudes), cotizaciones: adaptar(cotizaciones), contratos: adaptar(contratos), hitos: adaptar(hitos), pagosDeclarados: adaptar(pagosDeclarados), ordenesCambio: adaptar(ordenesCambio), mensajesContrato: adaptar(mensajesContrato), actuacionesContrato: adaptar(actuacionesContrato), especialidades: adaptar(especialidades), planesProfesionales: adaptar(planesProfesionales), portafolios: adaptar(portafolios), resenas: adaptar(resenas), auditoria: adaptar(auditoria), solicitudesEliminacion: adaptar(solicitudesEliminacion), nube: true, rol, adminRol };
}

const observarSesion = (callback) => onAuthStateChanged(auth, callback);

async function observarActividad(callback, onError = console.error) {
  const user = exigirUsuario();
  const rol = await obtenerRol(user.uid);
  const consulta = rol === "admin"
    ? collection(db, COLECCIONES.auditoria)
    : query(collection(db, COLECCIONES.auditoria), where("participantes", "array-contains", user.uid));
  return onSnapshot(consulta, (snapshot) => {
    const actividad = snapshot.docs.map((item) => {
      const datos = item.data();
      return { id: item.id, ...datos, actor: datos.actorEmail || datos.actorUid || "Sistema" };
    });
    callback(actividad);
  }, onError);
}

export const ProfesionalesFirebase = Object.freeze({
  COLECCIONES,
  registrarProfesional,
  registrarCliente,
  iniciarSesion,
  recuperarPassword,
  cerrarSesion,
  obtenerSolicitudEliminacion,
  solicitarEliminacionCuenta,
  actualizarSolicitudEliminacion,
  obtenerRol,
  esAdmin,
  obtenerAdminRol,
  crearSolicitud,
  agregarPortafolio,
  moderarPortafolio,
  crearCotizacion,
  aceptarCotizacion,
  registrarContratoFirmado,
  confirmarContratoFirmado,
  abrirContratoFirmado,
  enviarMensajeContrato,
  abrirAdjuntoMensaje,
  solicitarActuacionContrato,
  resolverActuacionContrato,
  registrarAnexoPlanTrabajo,
  abrirAnexoPlanTrabajo,
  iniciarServicio,
  finalizarServicio,
  cerrarServicio,
  abrirEvidenciaServicio,
  crearHito,
  registrarAvanceHito,
  resolverHito,
  declararPago,
  resolverPago,
  proponerOrdenCambio,
  resolverOrdenCambio,
  abrirEvidenciaEjecucion,
  cambiarEstadoProfesional,
  cambiarEstadoEspecialidad,
  crearEspecialidad,
  migrarProfesionesLegadas,
  actualizarEspecialidad,
  abrirEvidenciaEspecialidad,
  solicitarPlanProfesional,
  iniciarPagoPlanProfesional,
  verificarPagoPlanProfesional,
  descargarPdfContrato,
  obtenerPlanProfesionalPropio,
  esPlataformaNativa,
  activarPlanProfesional,
  cargarDatos,
  observarActividad,
  observarSesion,
  obtenerRevisionNotificaciones,
  guardarRevisionNotificaciones,
  usuarioActual: () => auth.currentUser,
  nombreCompleto
});
