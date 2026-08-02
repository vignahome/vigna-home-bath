import { db, auth, storage } from "./firebase.js";
import {
  addDoc,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
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
  auditoria: "pv_auditoria"
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
  await auditar("Solicitud creada", `${solicitudRef.id}: ${solicitud.profesion}`, [user.uid, solicitud.profesionalUid]);
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
    condiciones: texto(form, "condiciones"), version: 1, estado: "Enviada", creadoEn: ahora(), actualizadoEn: ahora()
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
  await runTransaction(db, async (tx) => {
    const cotizacionRef = doc(db, COLECCIONES.cotizaciones, cotizacionId);
    const cotizacionSnapshot = await tx.get(cotizacionRef);
    if (!cotizacionSnapshot.exists()) throw new Error("La cotización ya no existe.");
    const cotizacion = cotizacionSnapshot.data();
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
      condiciones: cotizacion.condiciones, version: 1, estado: "Pendiente de firma", archivoFirmado: "", archivoFirmadoUrl: "",
      descripcionSolicitud: solicitud.descripcion || "", ubicacion: { departamento: solicitud.departamento, provincia: solicitud.provincia, distrito: solicitud.distrito, fecha: solicitud.fecha },
      creadoEn: ahora(), actualizadoEn: ahora()
    });
    tx.update(cotizacionRef, { estado: "Aceptada", actualizadoEn: ahora() });
    tx.update(solicitudRef, { estado: "Contratada", profesionalUid: cotizacion.profesionalUid, actualizadoEn: ahora() });
  });
  await auditar("Contrato generado", `${contratoRef.id} desde ${cotizacionId}`, [user.uid]);
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
  if (!user) return { version: 1, profesionales, clientes, solicitudes, cotizaciones, contratos, auditoria, nube: true, rol };

  if (rol === "admin") {
    [profesionales, clientes, solicitudes, cotizaciones, contratos, auditoria] = await Promise.all([
      todos(COLECCIONES.profesionales), todos(COLECCIONES.clientes), todos(COLECCIONES.solicitudes),
      todos(COLECCIONES.cotizaciones), todos(COLECCIONES.contratos), todos(COLECCIONES.auditoria)
    ]);
    const privados = await todos(COLECCIONES.profesionalesPrivados);
    const privadosPorUid = new Map(privados.map((item) => [item.uid || item.id, item]));
    profesionales = profesionales.map((item) => ({
      ...item,
      privado: privadosPorUid.get(item.uid || item.id) || null
    }));
  } else if (rol === "cliente") {
    const [clienteSnapshot, solicitudesCliente, cotizacionesCliente, contratosCliente, auditoriaCliente] = await Promise.all([
      getDoc(doc(db, COLECCIONES.clientes, user.uid)), porCampo(COLECCIONES.solicitudes, "clienteUid", user.uid),
      porCampo(COLECCIONES.cotizaciones, "clienteUid", user.uid), porCampo(COLECCIONES.contratos, "clienteUid", user.uid),
      porArray(COLECCIONES.auditoria, "participantes", user.uid)
    ]);
    clientes = clienteSnapshot.exists() ? [{ id: clienteSnapshot.id, ...clienteSnapshot.data() }] : [];
    solicitudes = solicitudesCliente;
    cotizaciones = cotizacionesCliente;
    contratos = contratosCliente;
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
    [cotizaciones, contratos, auditoria] = await Promise.all([
      porCampo(COLECCIONES.cotizaciones, "profesionalUid", user.uid), porCampo(COLECCIONES.contratos, "profesionalUid", user.uid),
      porArray(COLECCIONES.auditoria, "participantes", user.uid)
    ]);
    solicitudes = [...new Map([...asignadas, ...compatibles].map((item) => [item.id, item])).values()];
  }
  const adaptar = (items) => items.map((item) => ({ ...item, clienteId: item.clienteUid || item.clienteId, profesionalId: item.profesionalUid || item.profesionalId, actor: item.actorEmail || item.actorUid || "Sistema" }));
  return { version: 1, profesionales: adaptar(profesionales), clientes: adaptar(clientes), solicitudes: adaptar(solicitudes), cotizaciones: adaptar(cotizaciones), contratos: adaptar(contratos), auditoria: adaptar(auditoria), nube: true, rol };
}

const observarSesion = (callback) => onAuthStateChanged(auth, callback);

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
  cambiarEstadoProfesional,
  cargarDatos,
  observarSesion,
  usuarioActual: () => auth.currentUser,
  nombreCompleto
});
