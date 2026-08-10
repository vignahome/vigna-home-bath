import { db, auth, storage } from "./firebase.js";
import {
  addDoc,
  arrayUnion,
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
  profesionales: "pv_profesionales",
  profesionalesPrivados: "pv_profesionales_privados",
  clientes: "pv_clientes",
  solicitudes: "pv_solicitudes",
  cotizaciones: "pv_cotizaciones",
  contratos: "pv_contratos",
  hitos: "pv_hitos",
  pagosDeclarados: "pv_pagos_declarados",
  ordenesCambio: "pv_ordenes_cambio",
  resenas: "pv_resenas",
  auditoria: "pv_auditoria",
  preferenciasNotificaciones: "pv_preferencias_notificaciones"
});

const ahora = () => new Date().toISOString();
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
  return (await getDoc(doc(db, "admins", uid))).exists();
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
  const credencial = await createUserWithEmailAndPassword(auth, correo, password);
  const uid = credencial.user.uid;
  await setDoc(doc(db, COLECCIONES.usuarios, uid), {
    uid, rol: "profesional", correo, estadoRegistro: "incompleto", creadoEn: ahora()
  });

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
  const publico = {
    uid, nombres, apellidos, correo, whatsapp: texto(form, "whatsapp"), modalidad: texto(form, "modalidad"),
    departamento: texto(form, "departamento"), provincia: texto(form, "provincia"), distrito: texto(form, "distrito"),
    profesiones, profesionPrincipal: texto(form, "profesionPrincipal"), experiencia: Number(form.get("experiencia") || 0),
    coberturaTipo: texto(form, "coberturaTipo"), coberturaDetalle: texto(form, "coberturaDetalle"),
    distancia: texto(form, "distancia"), recargo: texto(form, "recargo"), descripcion: texto(form, "descripcion"),
    estado: "Pendiente", plan: "Sin plan", calificacion: 0, trabajos: 0,
    fotoIniciales: `${nombres[0] || ""}${apellidos[0] || ""}`.toUpperCase(), documentosDeclarados: [frenteUrl, reversoUrl, selfieUrl].filter(Boolean).length,
    portafolio: [], creadoEn: ahora(), actualizadoEn: ahora()
  };
  const privado = {
    uid, fechaNacimiento: texto(form, "fechaNacimiento"), tipoDocumento: texto(form, "tipoDocumento"),
    documento: texto(form, "documento"), paisEmisor: texto(form, "paisEmisor"), direccionPrivada: texto(form, "direccion"),
    referencia: texto(form, "referencia"), documentos: { frenteUrl, reversoUrl, selfieUrl }, actualizadoEn: ahora()
  };
  await Promise.all([
    setDoc(doc(db, COLECCIONES.profesionales, uid), publico),
    setDoc(doc(db, COLECCIONES.profesionalesPrivados, uid), privado),
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

async function cerrarSesion() {
  await signOut(auth);
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
  const solicitudRef = doc(collection(db, COLECCIONES.solicitudes));
  const urls = [];
  for (const item of adjuntos) {
    urls.push(await subir(`profesionales-vigna/solicitudes/${user.uid}/${solicitudRef.id}`, item, { maxMb: 25, tipos: ["image/", "video/", "application/pdf"] }));
  }
  const solicitud = {
    id: solicitudRef.id, clienteUid: user.uid, profesionalUid: texto(form, "profesionalId"), profesion: texto(form, "profesion"),
    departamento: texto(form, "departamento"), provincia: texto(form, "provincia"), distrito: texto(form, "distrito"),
    presupuesto: texto(form, "presupuesto"), fecha: texto(form, "fecha"), urgencia: texto(form, "urgencia"),
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
  const antes = archivo(form, "antes");
  const despues = archivo(form, "despues");
  const video = archivo(form, "video");
  const base = `profesionales-vigna/profesionales/${user.uid}/portafolio`;
  const [antesUrl, despuesUrl, videoUrl] = await Promise.all([
    subir(base, antes, { maxMb: 12, tipos: ["image/"] }),
    subir(base, despues, { maxMb: 12, tipos: ["image/"] }),
    subir(base, video, { maxMb: 80, tipos: ["video/"] })
  ]);
  const proyecto = { id: crypto.randomUUID(), titulo: texto(form, "titulo"), descripcion: texto(form, "descripcion"), antes: antesUrl, despues: despuesUrl, videoUrl, videoNombre: video?.name || "", creadoEn: ahora(), estado: "Pendiente" };
  await updateDoc(doc(db, COLECCIONES.profesionales, user.uid), { portafolio: arrayUnion(proyecto), actualizadoEn: ahora() });
  await auditar("Proyecto de portafolio agregado", `${user.uid}: ${proyecto.titulo}`, [user.uid]);
  return proyecto;
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
  const cotizacionRef = doc(collection(db, COLECCIONES.cotizaciones));
  const cotizacion = {
    id: cotizacionRef.id, solicitudId, profesionalUid: user.uid, clienteUid: solicitud.clienteUid,
    profesionalNombre: nombreCompleto(perfil), profesionalTipoDocumento: identidad.tipoDocumento || "",
    profesionalDocumento: identidad.documento || "",
    opciones: [
      { nombre: "Económica", precio: Number(form.get("economicaPrecio") || 0), detalle: texto(form, "economicaDetalle") },
      { nombre: "Recomendada", precio: Number(form.get("recomendadaPrecio") || 0), detalle: texto(form, "recomendadaDetalle") },
      { nombre: "Premium", precio: Number(form.get("premiumPrecio") || 0), detalle: texto(form, "premiumDetalle") }
    ],
    garantiaDias, condiciones: texto(form, "condiciones"), version: 1, estado: "Enviada", creadoEn: ahora(), actualizadoEn: ahora()
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
      clienteNombre: nombreCompleto(cliente), clienteTipoDocumento: cliente.tipoDocumento || "", clienteDocumento: cliente.documento || "",
      profesionalNombre: cotizacion.profesionalNombre || "", profesionalTipoDocumento: cotizacion.profesionalTipoDocumento || "",
      profesionalDocumento: cotizacion.profesionalDocumento || "",
      garantiaDias: Number(cotizacion.garantiaDias || 0), garantiaInicioEn: "", garantiaVenceEn: "",
      condiciones: cotizacion.condiciones, version: 1, estado: "Pendiente de firma", archivoFirmado: "", archivoFirmadoUrl: "",
      anexoPlanTrabajoNombre: "", anexoPlanTrabajoRuta: "", anexoPlanTrabajoActualizadoEn: "",
      descripcionSolicitud: solicitud.descripcion || "", ubicacion: { departamento: solicitud.departamento, provincia: solicitud.provincia, distrito: solicitud.distrito, fecha: solicitud.fecha },
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
  const ruta = await subirPrivado(`profesionales-vigna/contratos/${contratoId}`, file, { maxMb: 15, tipos: ["application/pdf", "image/"] });
  await updateDoc(contratoRef, {
    archivoFirmado: file.name,
    archivoFirmadoRuta: ruta,
    archivoFirmadoUrl: deleteField(),
    firmadoPorUid: user.uid,
    estado: "Firmado",
    actualizadoEn: ahora()
  });
  await auditar("Contrato firmado registrado", `${contratoId}: ${file.name}`, [contrato.clienteUid, contrato.profesionalUid]);
  return ruta;
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
  const [hitosContrato, pagosContrato, cambiosContrato] = await Promise.all([
    porCampo(COLECCIONES.hitos, "contratoId", contratoId),
    porCampo(COLECCIONES.pagosDeclarados, "contratoId", contratoId),
    porCampo(COLECCIONES.ordenesCambio, "contratoId", contratoId)
  ]);
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

async function cerrarServicio(contratoId, calificacion, comentario) {
  const user = exigirUsuario();
  const valor = Number(calificacion);
  const opinion = String(comentario || "").trim();
  if (!Number.isInteger(valor) || valor < 1 || valor > 5) throw new Error("Selecciona una calificación válida.");
  if (opinion.length < 10) throw new Error("El comentario debe tener al menos 10 caracteres.");
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
    tx.update(contratoRef, {
      estado: "Cerrado",
      calificacion: valor,
      comentarioCliente: opinion.slice(0, 1000),
      cerradoPorUid: user.uid,
      cerradoEn,
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
  if (!(await esAdmin(user.uid))) throw new Error("Se requiere autorización administrativa.");
  if (!['Aprobado', 'Pendiente', 'Rechazado'].includes(estado)) throw new Error("Estado no permitido.");
  await updateDoc(doc(db, COLECCIONES.profesionales, uid), { estado, revisadoPorUid: user.uid, actualizadoEn: ahora() });
  await auditar("Estado profesional actualizado", `${uid}: ${estado}`, [uid]);
}

const documentos = async (consulta) => (await getDocs(consulta)).docs.map((item) => ({ id: item.id, ...item.data() }));
const todos = (nombre) => documentos(collection(db, nombre));
const porCampo = (nombre, campo, valor) => documentos(query(collection(db, nombre), where(campo, "==", valor)));
const porArray = (nombre, campo, valor) => documentos(query(collection(db, nombre), where(campo, "array-contains", valor)));

async function cargarDatos() {
  const user = auth.currentUser;
  const rol = await obtenerRol(user?.uid);
  let profesionales = await porCampo(COLECCIONES.profesionales, "estado", "Aprobado");
  let clientes = [];
  let solicitudes = [];
  let cotizaciones = [];
  let contratos = [];
  let auditoria = [];
  let resenas = [];
  let hitos = [];
  let pagosDeclarados = [];
  let ordenesCambio = [];
  try {
    resenas = await todos(COLECCIONES.resenas);
  } catch (error) {
    console.warn("Las reseñas se activarán cuando se publiquen las reglas actualizadas.", error);
  }
  if (!user) return { version: 1, profesionales, clientes, solicitudes, cotizaciones, contratos, hitos, pagosDeclarados, ordenesCambio, resenas, auditoria, nube: true, rol };

  if (rol === "admin") {
    [profesionales, clientes, solicitudes, cotizaciones, contratos, hitos, pagosDeclarados, ordenesCambio, auditoria] = await Promise.all([
      todos(COLECCIONES.profesionales), todos(COLECCIONES.clientes), todos(COLECCIONES.solicitudes),
      todos(COLECCIONES.cotizaciones), todos(COLECCIONES.contratos), todos(COLECCIONES.hitos),
      todos(COLECCIONES.pagosDeclarados), todos(COLECCIONES.ordenesCambio), todos(COLECCIONES.auditoria)
    ]);
    const privados = await todos(COLECCIONES.profesionalesPrivados);
    const privadosPorUid = new Map(privados.map((item) => [item.uid || item.id, item]));
    profesionales = profesionales.map((item) => ({
      ...item,
      privado: privadosPorUid.get(item.uid || item.id) || null
    }));
  } else if (rol === "cliente") {
    const [clienteSnapshot, solicitudesCliente, cotizacionesCliente, contratosCliente, hitosCliente, pagosCliente, ordenesCliente, auditoriaCliente] = await Promise.all([
      getDoc(doc(db, COLECCIONES.clientes, user.uid)), porCampo(COLECCIONES.solicitudes, "clienteUid", user.uid),
      porCampo(COLECCIONES.cotizaciones, "clienteUid", user.uid), porCampo(COLECCIONES.contratos, "clienteUid", user.uid),
      porCampo(COLECCIONES.hitos, "clienteUid", user.uid), porCampo(COLECCIONES.pagosDeclarados, "clienteUid", user.uid),
      porCampo(COLECCIONES.ordenesCambio, "clienteUid", user.uid),
      porArray(COLECCIONES.auditoria, "participantes", user.uid)
    ]);
    clientes = clienteSnapshot.exists() ? [{ id: clienteSnapshot.id, ...clienteSnapshot.data() }] : [];
    solicitudes = solicitudesCliente;
    cotizaciones = cotizacionesCliente;
    contratos = contratosCliente;
    hitos = hitosCliente;
    pagosDeclarados = pagosCliente;
    ordenesCambio = ordenesCliente;
    auditoria = auditoriaCliente;
  } else if (rol === "profesional") {
    const perfil = await getDoc(doc(db, COLECCIONES.profesionales, user.uid));
    if (perfil.exists() && !profesionales.some((item) => item.id === user.uid)) profesionales.unshift({ id: perfil.id, ...perfil.data() });
    const perfilDatos = perfil.data() || {};
    const asignadas = await porCampo(COLECCIONES.solicitudes, "profesionalUid", user.uid);
    const compatibles = [];
    for (const profesion of (perfilDatos.profesiones || []).slice(0, 10)) {
      compatibles.push(...await porCampo(COLECCIONES.solicitudes, "profesion", profesion));
    }
    [cotizaciones, contratos, hitos, pagosDeclarados, ordenesCambio, auditoria] = await Promise.all([
      porCampo(COLECCIONES.cotizaciones, "profesionalUid", user.uid), porCampo(COLECCIONES.contratos, "profesionalUid", user.uid),
      porCampo(COLECCIONES.hitos, "profesionalUid", user.uid), porCampo(COLECCIONES.pagosDeclarados, "profesionalUid", user.uid),
      porCampo(COLECCIONES.ordenesCambio, "profesionalUid", user.uid),
      porArray(COLECCIONES.auditoria, "participantes", user.uid)
    ]);
    solicitudes = [...new Map([...asignadas, ...compatibles].map((item) => [item.id, item])).values()];
  }
  const adaptar = (items) => items.map((item) => ({ ...item, clienteId: item.clienteUid || item.clienteId, profesionalId: item.profesionalUid || item.profesionalId, actor: item.actorEmail || item.actorUid || "Sistema" }));
  return { version: 1, profesionales: adaptar(profesionales), clientes: adaptar(clientes), solicitudes: adaptar(solicitudes), cotizaciones: adaptar(cotizaciones), contratos: adaptar(contratos), hitos: adaptar(hitos), pagosDeclarados: adaptar(pagosDeclarados), ordenesCambio: adaptar(ordenesCambio), resenas: adaptar(resenas), auditoria: adaptar(auditoria), nube: true, rol };
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
  cerrarSesion,
  obtenerRol,
  esAdmin,
  crearSolicitud,
  agregarPortafolio,
  crearCotizacion,
  aceptarCotizacion,
  registrarContratoFirmado,
  abrirContratoFirmado,
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
  cargarDatos,
  observarActividad,
  observarSesion,
  obtenerRevisionNotificaciones,
  guardarRevisionNotificaciones,
  usuarioActual: () => auth.currentUser,
  nombreCompleto
});
