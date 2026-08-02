import { db, auth, storage } from "./firebase.js";
import { collection, addDoc, getDocs, getDoc, updateDoc, doc, query, where } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-storage.js";

const ESTADOS = ["Abierto", "Respondido", "En revisión", "Resuelto", "Cerrado"];
let usuario = null;
let rol = "publico";
let reclamos = [];
let contratos = [];

function escapar(valor) {
  return String(valor == null ? "" : valor).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c];
  });
}
function fecha() { return new Date().toISOString(); }
function aviso(texto) { window.alert(texto); }
async function obtenerRol(uid) {
  if (!uid) return "publico";
  if ((await getDoc(doc(db, "admins", uid))).exists()) return "admin";
  const u = await getDoc(doc(db, "pv_usuarios", uid));
  return u.exists() ? (u.data().rol || "publico") : "publico";
}
async function listaConsulta(nombre, campo, valor) {
  const s = await getDocs(query(collection(db, nombre), where(campo, "==", valor)));
  return s.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
}
async function cargar() {
  if (!usuario) return;
  if (rol === "admin") {
    const a = await getDocs(collection(db, "pv_reclamos"));
    const c = await getDocs(collection(db, "pv_contratos"));
    reclamos = a.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
    contratos = c.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
  } else {
    const campo = rol === "cliente" ? "clienteUid" : "profesionalUid";
    reclamos = await listaConsulta("pv_reclamos", campo, usuario.uid);
    contratos = await listaConsulta("pv_contratos", campo, usuario.uid);
  }
  renderizar();
}
function crearInterfaz() {
  if (document.getElementById("pvGarantiasBoton")) return;
  const boton = document.createElement("button");
  boton.id = "pvGarantiasBoton";
  boton.type = "button";
  boton.className = "mvp-button mvp-button-primary pv-garantias-flotante";
  boton.textContent = "Garantías y reclamos";
  boton.hidden = true;
  boton.addEventListener("click", abrir);
  document.body.appendChild(boton);

  const capa = document.createElement("div");
  capa.id = "pvGarantiasModal";
  capa.className = "mvp-modal";
  capa.hidden = true;
  capa.innerHTML = '<div class="mvp-modal-card pv-garantias-card" role="dialog" aria-modal="true" aria-labelledby="pvGarantiasTitulo"><button class="mvp-modal-close" id="pvGarantiasCerrar" type="button" aria-label="Cerrar">×</button><div id="pvGarantiasContenido"></div></div>';
  document.body.appendChild(capa);
  document.getElementById("pvGarantiasCerrar").addEventListener("click", cerrar);
  capa.addEventListener("click", function (e) { if (e.target === capa) cerrar(); });

  const estilo = document.createElement("style");
  estilo.textContent = '.pv-garantias-flotante{position:fixed;right:18px;bottom:18px;z-index:80}.pv-garantias-card{max-width:980px;max-height:88vh;overflow:auto}.pv-reclamo-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pv-reclamo-lista{display:grid;gap:12px;margin-top:18px}.pv-reclamo-item{border:1px solid #4b4b4b;border-radius:14px;padding:16px;background:#121212}.pv-reclamo-meta{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.pv-reclamo-estado{color:#f0c84b}.pv-reclamo-historial{border-left:2px solid #bd8b08;padding-left:12px;margin-top:12px}.pv-reclamo-acciones{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.pv-reclamo-acciones button{width:auto}.pv-garantias-card textarea{min-height:90px}@media(max-width:700px){.pv-reclamo-grid{grid-template-columns:1fr}.pv-garantias-flotante{left:12px;right:12px;width:calc(100% - 24px)}}';
  document.head.appendChild(estilo);
}
async function abrir() {
  document.getElementById("pvGarantiasModal").hidden = false;
  document.body.classList.add("modal-open");
  await cargar();
}
function cerrar() {
  document.getElementById("pvGarantiasModal").hidden = true;
  document.body.classList.remove("modal-open");
}
function formularioNuevo() {
  const cerrados = contratos.filter(function (c) { return c.estado === "Cerrado"; });
  if (rol !== "cliente") return "";
  const opciones = cerrados.map(function (c) {
    return '<option value="' + escapar(c.id) + '">' + escapar(c.id + " · " + (c.profesion || c.opcion || "Servicio")) + '</option>';
  }).join("");
  if (!opciones) return '<p>No tienes contratos cerrados disponibles para abrir un reclamo.</p>';
  return '<section class="mvp-panel"><h3>Abrir garantía, reclamo o incidencia</h3><form id="pvReclamoForm"><div class="pv-reclamo-grid"><label>Contrato<select name="contratoId" required><option value="">Selecciona un contrato</option>' + opciones + '</select></label><label>Categoría<select name="categoria" required><option value="Defecto">Defecto</option><option value="Trabajo incompleto">Trabajo incompleto</option><option value="Daño">Daño</option><option value="Incumplimiento">Incumplimiento</option><option value="Otro">Otro</option></select></label></div><label>Descripción<textarea name="descripcion" required minlength="20" placeholder="Describe claramente qué ocurrió, cuándo lo detectaste y qué parte del servicio está afectada."></textarea></label><label>Solución solicitada<textarea name="solucionSolicitada" required placeholder="Ej. corrección sin costo, visita técnica o reposición."></textarea></label><label>Pruebas privadas (hasta 6 imágenes, videos o PDF)<input name="archivos" type="file" multiple accept="image/*,video/*,application/pdf"></label><button class="mvp-button mvp-button-primary" type="submit">Registrar reclamo</button></form></section>';
}
function historialHTML(items) {
  return (items || []).map(function (h) {
    return '<div><strong>' + escapar(h.accion) + '</strong> · ' + escapar(h.rol || "") + '<br><small>' + escapar(h.fecha || "") + (h.detalle ? " · " + escapar(h.detalle) : "") + '</small></div>';
  }).join("");
}
function archivosHTML(items) {
  return (items || []).map(function (a, i) {
    return '<button class="mvp-button" data-archivo="' + escapar(a.ruta) + '" type="button">Abrir archivo ' + (i + 1) + ': ' + escapar(a.nombre) + '</button>';
  }).join("");
}
function accionesHTML(r) {
  if (rol === "profesional" && ["Abierto", "En revisión"].includes(r.estado)) {
    return '<form class="pvRespuestaForm" data-id="' + escapar(r.id) + '"><label>Respuesta profesional<textarea name="respuesta" required minlength="10"></textarea></label><label>Evidencias privadas<input name="archivos" type="file" multiple accept="image/*,video/*,application/pdf"></label><button class="mvp-button mvp-button-primary" type="submit">Responder reclamo</button></form>';
  }
  if (rol === "admin" && r.estado !== "Cerrado") {
    return '<form class="pvResolucionForm" data-id="' + escapar(r.id) + '"><label>Resolución administrativa<textarea name="resolucion" required minlength="10"></textarea></label><div class="pv-reclamo-acciones"><button class="mvp-button" name="accion" value="revision" type="submit">Pasar a revisión</button><button class="mvp-button mvp-button-primary" name="accion" value="resolver" type="submit">Resolver</button><button class="mvp-button" name="accion" value="cerrar" type="submit">Cerrar expediente</button></div></form>';
  }
  if (rol === "cliente" && r.estado === "Resuelto") {
    return '<button class="mvp-button mvp-button-primary pvCerrarReclamo" data-id="' + escapar(r.id) + '" type="button">Aceptar solución y cerrar</button>';
  }
  return "";
}
function reclamoHTML(r) {
  return '<article class="pv-reclamo-item"><div class="pv-reclamo-meta"><strong>' + escapar(r.categoria) + '</strong><span class="pv-reclamo-estado">' + escapar(r.estado) + '</span><small>Contrato ' + escapar(r.contratoId) + '</small></div><p>' + escapar(r.descripcion) + '</p><p><strong>Solución solicitada:</strong> ' + escapar(r.solucionSolicitada) + '</p>' + (r.respuestaProfesional ? '<p><strong>Respuesta profesional:</strong> ' + escapar(r.respuestaProfesional) + '</p>' : '') + (r.resolucionAdmin ? '<p><strong>Resolución:</strong> ' + escapar(r.resolucionAdmin) + '</p>' : '') + '<div class="pv-reclamo-acciones">' + archivosHTML([].concat(r.archivosCliente || [], r.archivosProfesional || [])) + '</div><div class="pv-reclamo-historial">' + historialHTML(r.historial) + '</div>' + accionesHTML(r) + '</article>';
}
function renderizar() {
  const zona = document.getElementById("pvGarantiasContenido");
  zona.innerHTML = '<p class="mvp-eyebrow">PROTECCIÓN DEL SERVICIO</p><h2 id="pvGarantiasTitulo">Garantías, reclamos e incidencias</h2><p>Todo expediente queda vinculado al contrato, sus evidencias y la actuación de cada participante.</p>' + formularioNuevo() + '<section><h3>Expedientes</h3><div class="pv-reclamo-lista">' + (reclamos.length ? reclamos.map(reclamoHTML).join("") : '<div class="mvp-empty">Todavía no existen reclamos.</div>') + '</div></section>';
  enlazar();
}
function validarArchivos(files) {
  const lista = Array.from(files || []);
  if (lista.length > 6) throw new Error("Solo puedes adjuntar hasta 6 archivos.");
  lista.forEach(function (f) {
    if (f.size > 25 * 1024 * 1024) throw new Error("Cada archivo debe pesar como máximo 25 MB.");
    if (!/^(image\/|video\/|application\/pdf$)/.test(f.type)) throw new Error("Solo se permiten imágenes, videos o PDF.");
  });
  return lista;
}
async function subirArchivos(reclamoId, files) {
  const lista = validarArchivos(files);
  const salidas = [];
  for (const f of lista) {
    const limpio = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const ruta = "profesionales-vigna/reclamos/" + reclamoId + "/" + usuario.uid + "/" + Date.now() + "-" + limpio;
    await uploadBytes(ref(storage, ruta), f, { contentType: f.type });
    salidas.push({ ruta: ruta, nombre: f.name, tipo: f.type, tamano: f.size });
  }
  return salidas;
}
function entrada(accion, detalle) {
  return { accion: accion, actorUid: usuario.uid, rol: rol, fecha: fecha(), detalle: detalle || "" };
}
async function crearReclamo(form) {
  const data = new FormData(form);
  const contrato = contratos.find(function (c) { return c.id === data.get("contratoId"); });
  if (!contrato || contrato.estado !== "Cerrado" || contrato.clienteUid !== usuario.uid) throw new Error("El contrato cerrado no es válido.");
  const base = {
    contratoId: contrato.id, solicitudId: contrato.solicitudId || "", cotizacionId: contrato.cotizacionId || "",
    clienteUid: usuario.uid, profesionalUid: contrato.profesionalUid, categoria: data.get("categoria"),
    descripcion: String(data.get("descripcion") || "").trim(), solucionSolicitada: String(data.get("solucionSolicitada") || "").trim(),
    estado: "Abierto", archivosCliente: [], archivosProfesional: [], respuestaProfesional: "", resolucionAdmin: "",
    historial: [entrada("Reclamo abierto")], creadoEn: fecha(), actualizadoEn: fecha()
  };
  const creado = await addDoc(collection(db, "pv_reclamos"), base);
  const archivos = await subirArchivos(creado.id, form.elements.archivos.files);
  if (archivos.length) await updateDoc(doc(db, "pv_reclamos", creado.id), { archivosCliente: archivos, actualizadoEn: fecha() });
  aviso("Reclamo registrado de forma privada.");
  await cargar();
}
async function responder(form) {
  const id = form.dataset.id;
  const actual = reclamos.find(function (r) { return r.id === id; });
  const archivos = await subirArchivos(id, form.elements.archivos.files);
  await updateDoc(doc(db, "pv_reclamos", id), {
    respuestaProfesional: form.elements.respuesta.value.trim(), archivosProfesional: archivos,
    estado: "Respondido", actualizadoEn: fecha(), historial: (actual.historial || []).concat([entrada("Respuesta profesional registrada")])
  });
  aviso("Respuesta guardada.");
  await cargar();
}
async function resolver(form, accion) {
  const id = form.dataset.id;
  const actual = reclamos.find(function (r) { return r.id === id; });
  const estados = { revision: "En revisión", resolver: "Resuelto", cerrar: "Cerrado" };
  const nuevo = estados[accion];
  await updateDoc(doc(db, "pv_reclamos", id), {
    resolucionAdmin: form.elements.resolucion.value.trim(), estado: nuevo, actualizadoEn: fecha(),
    historial: (actual.historial || []).concat([entrada(nuevo === "En revisión" ? "Revisión administrativa iniciada" : nuevo === "Resuelto" ? "Resolución administrativa emitida" : "Expediente cerrado por administración")])
  });
  aviso("Expediente actualizado.");
  await cargar();
}
async function cerrarCliente(id) {
  const actual = reclamos.find(function (r) { return r.id === id; });
  await updateDoc(doc(db, "pv_reclamos", id), { estado: "Cerrado", actualizadoEn: fecha(), historial: (actual.historial || []).concat([entrada("Solución aceptada y expediente cerrado")]) });
  aviso("Reclamo cerrado.");
  await cargar();
}
async function abrirArchivo(ruta) {
  const url = await getDownloadURL(ref(storage, ruta));
  window.open(url, "_blank", "noopener");
}
function enlazar() {
  const nuevo = document.getElementById("pvReclamoForm");
  if (nuevo) nuevo.addEventListener("submit", async function (e) { e.preventDefault(); try { await crearReclamo(e.currentTarget); } catch (x) { aviso(x.message || String(x)); } });
  document.querySelectorAll(".pvRespuestaForm").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); try { await responder(e.currentTarget); } catch (x) { aviso(x.message || String(x)); } }); });
  document.querySelectorAll(".pvResolucionForm").forEach(function (f) { f.addEventListener("submit", async function (e) { e.preventDefault(); try { await resolver(e.currentTarget, e.submitter.value); } catch (x) { aviso(x.message || String(x)); } }); });
  document.querySelectorAll(".pvCerrarReclamo").forEach(function (b) { b.addEventListener("click", async function () { try { await cerrarCliente(b.dataset.id); } catch (x) { aviso(x.message || String(x)); } }); });
  document.querySelectorAll("[data-archivo]").forEach(function (b) { b.addEventListener("click", async function () { try { await abrirArchivo(b.dataset.archivo); } catch (x) { aviso(x.message || String(x)); } }); });
}
crearInterfaz();
onAuthStateChanged(auth, async function (u) {
  usuario = u;
  rol = await obtenerRol(u && u.uid);
  document.getElementById("pvGarantiasBoton").hidden = !u || !["cliente", "profesional", "admin"].includes(rol);
});
