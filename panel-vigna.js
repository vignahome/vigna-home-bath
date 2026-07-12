let usuarioActual = null;
let perfilActualId = null;
let perfilActual = null;

let listenerSolicitudes = null;

function cargarPanelVigna() {
  onAuthStateChanged(auth, async (user) => {
    const contenedor = document.getElementById("datosUsuario");

    if (!user) {
      alert("Debes iniciar sesión.");
      window.location.href = "login-vigna.html";
      return;
    }

    usuarioActual = user;

    contenedor.innerHTML = `
      <p><strong>Correo:</strong> ${user.email}</p>
      <p><strong>ID:</strong> ${user.uid}</p>
      <p>Sesión activa correctamente.</p>
    `;

    await cargarPerfilDelUsuario();
  });
}

async function cargarPerfilDelUsuario() {
  const consulta = await getDocs(
    query(
      collection(db, "plomeros"),
      where("uid", "==", usuarioActual.uid)
    )
  );

  if (consulta.empty) {
    alert("No se encontró perfil profesional. Créalo desde el registro.");
    return;
  }

  consulta.forEach((documento) => {
    perfilActualId = documento.id;
    perfilActual = documento.data();
  });

  document.getElementById("telefonoPerfil").value = perfilActual.whatsapp || "";
  document.getElementById("especialidadPerfil").value = perfilActual.especialidad || "";
  document.getElementById("departamentoPerfil").value = perfilActual.departamento || "";
  document.getElementById("provinciaPerfil").value = perfilActual.provincia || "";
  document.getElementById("distritoPerfil").value = perfilActual.distrito || "";
  document.getElementById("descripcionPerfil").value = perfilActual.descripcion || "";

    if (perfilActual.foto) {
    document.getElementById("fotoVista").src = perfilActual.foto;
  }

  await cargarSolicitudesVigna();
  await cargarSolicitudesDisponibles();
  escucharSolicitudesVigna();
}

async function guardarPerfil() {
  if (!usuarioActual || !perfilActualId) {
    alert("No se encontró el perfil para actualizar.");
    return;
  }

  const whatsapp = document.getElementById("telefonoPerfil").value.trim();
  const especialidad = document.getElementById("especialidadPerfil").value.trim();
  const departamento = document.getElementById("departamentoPerfil").value.trim();
  const provincia = document.getElementById("provinciaPerfil").value.trim();
  const distrito = document.getElementById("distritoPerfil").value.trim();
  const descripcion = document.getElementById("descripcionPerfil").value.trim();
  const fotoInput = document.getElementById("fotoPerfil");

  let fotoURL = perfilActual.foto || "images/avatar-default.png";

  try {
    if (fotoInput.files.length > 0) {
      const archivo = fotoInput.files[0];

      const rutaFoto = ref(
        storage,
        `perfiles/${usuarioActual.uid}/${Date.now()}-${archivo.name}`
      );

      await uploadBytes(rutaFoto, archivo);
      fotoURL = await getDownloadURL(rutaFoto);
    }

    await updateDoc(doc(db, "plomeros", perfilActualId), {
      whatsapp,
      especialidad,
      departamento,
      provincia,
      distrito,
      zona: `${departamento} - ${provincia} - ${distrito}`,
      descripcion,
      foto: fotoURL
    });

    document.getElementById("fotoVista").src = fotoURL;

    alert("Perfil actualizado correctamente.");

    await cargarPerfilDelUsuario();

  } catch (error) {
    console.error(error);
    alert("Error actualizando perfil: " + error.message);
  }
}

async function subirTrabajoVigna() {
  if (!usuarioActual || !perfilActualId) {
    alert("Debes iniciar sesión.");
    return;
  }

  const titulo = document.getElementById("trabajoTitulo").value.trim();
  const descripcion = document.getElementById("trabajoDescripcion").value.trim();
  const fotoAntesInput = document.getElementById("fotoAntes");
  const fotoDespuesInput = document.getElementById("fotoDespues");

  if (!titulo || !descripcion) {
    alert("Completa título y descripción.");
    return;
  }

  if (!fotoAntesInput.files[0] || !fotoDespuesInput.files[0]) {
    alert("Selecciona foto antes y foto después.");
    return;
  }

  try {
    const archivoAntes = fotoAntesInput.files[0];
    const archivoDespues = fotoDespuesInput.files[0];

    const rutaAntes = ref(
      storage,
      `trabajos/${perfilActualId}/antes-${Date.now()}-${archivoAntes.name}`
    );

    const rutaDespues = ref(
      storage,
      `trabajos/${perfilActualId}/despues-${Date.now()}-${archivoDespues.name}`
    );

    await uploadBytes(rutaAntes, archivoAntes);
    await uploadBytes(rutaDespues, archivoDespues);

    const urlAntes = await getDownloadURL(rutaAntes);
    const urlDespues = await getDownloadURL(rutaDespues);

    await addDoc(collection(db, "trabajos"), {
      plomeroId: perfilActualId,
      uid: usuarioActual.uid,
      titulo,
      descripcion,
      fotoAntes: urlAntes,
      fotoDespues: urlDespues,
      fecha: new Date().toLocaleDateString()
    });

    alert("Trabajo subido correctamente.");

    document.getElementById("trabajoTitulo").value = "";
    document.getElementById("trabajoDescripcion").value = "";
    fotoAntesInput.value = "";
    fotoDespuesInput.value = "";

  } catch (error) {
    console.error(error);
    alert("Error subiendo trabajo: " + error.message);
  }
}

function escucharSolicitudesVigna() {

  if (listenerSolicitudes) {
    listenerSolicitudes();
  }

  const consulta = collection(db, "solicitudes");

  listenerSolicitudes = onSnapshot(consulta, () => {

    cargarSolicitudesVigna();
    cargarSolicitudesDisponibles();

  });

}

async function cargarSolicitudesVigna() {
  const contenedor = document.getElementById("listaSolicitudesVigna");

  if (!contenedor || !perfilActualId) return;

  const consulta = await getDocs(
    query(
      collection(db, "solicitudes"),
      where("plomeroId", "==", perfilActualId)
    )
  );

  let html = "";
  let cantidad = 0;

  consulta.forEach((documento) => {
    const s = documento.data();

    cantidad++;

    html += `
      <div class="plomero-card">
        <h3>${s.clienteNombre}</h3>

        <p><strong>WhatsApp:</strong> ${s.clienteWhatsapp}</p>
        <p><strong>Servicio:</strong> ${s.descripcion}</p>
        <p><strong>Estado:</strong> ${s.estado}</p>
        <p><strong>Fecha:</strong> ${s.fecha}</p>

        <a href="https://wa.me/51${s.clienteWhatsapp}" target="_blank" class="btn-servicio">
          Contactar cliente
        </a>

        <button onclick="actualizarEstadoSolicitud('${documento.id}', 'En proceso')">
          Marcar en proceso
        </button>

        <button onclick="actualizarEstadoSolicitud('${documento.id}', 'Finalizado')">
          Marcar finalizado
        </button>

        <button onclick="actualizarEstadoSolicitud('${documento.id}', 'Cancelado')">
          Cancelar solicitud
        </button>
      </div>
    `;
  });

  if (cantidad === 0) {
    html = "<p>Todavía no tienes solicitudes.</p>";
  }

  contenedor.innerHTML = html;
}

async function actualizarEstadoSolicitud(solicitudId, nuevoEstado) {
  try {
    await updateDoc(doc(db, "solicitudes", solicitudId), {
      estado: nuevoEstado
    });

    alert("Solicitud actualizada a: " + nuevoEstado);

    await cargarSolicitudesVigna();

  } catch (error) {
    console.error(error);
    alert("Error actualizando solicitud: " + error.message);
  }
}
async function cargarSolicitudesDisponibles() {
  const contenedor = document.getElementById("listaSolicitudesDisponibles");

  if (!contenedor || !perfilActual) return;

  const consulta = await getDocs(
    query(
      collection(db, "solicitudes"),
      where("estado", "==", "Pendiente")
    )
  );

  let html = "";
  let cantidad = 0;

  consulta.forEach((documento) => {
    const s = documento.data();

    const mismaEspecialidad =
      String(s.especialidad || "").trim().toLowerCase() ===
      String(perfilActual.especialidad || "").trim().toLowerCase();

    if (mismaEspecialidad) {
      cantidad++;

      html += `
        <div class="plomero-card">
          <h3>${s.especialidad || "Solicitud de servicio"}</h3>

          <p><strong>Cliente:</strong> ${s.clienteNombre || "Cliente VIGNA"}</p>
          <p><strong>Distrito:</strong> ${s.distrito || s.zona || ""}</p>
          <p><strong>Servicio:</strong> ${s.descripcion || ""}</p>
          <p><strong>Estado:</strong> ${s.estado}</p>
          <p><strong>Fecha:</strong> ${s.fecha || ""}</p>

          <button onclick="aceptarSolicitudDisponible('${documento.id}')">
            Aceptar trabajo
          </button>
        </div>
      `;
    }
  });

  if (cantidad === 0) {
    html = "<p>No hay solicitudes disponibles para tu especialidad.</p>";
  }

  contenedor.innerHTML = html;
}

function obtenerApiPagosUrl() {
  const urlConfigurada = String(window.VIGNA_CONFIG?.apiPagosUrl || "").trim();
  if (urlConfigurada) return urlConfigurada.replace(/\/$/, "");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://localhost:3000";
  return "";
}

async function suscribirseProfesionalPanel(planId) {
  if (!perfilActualId) {
    alert("No se encontró tu perfil profesional.");
    return;
  }

  const apiPagosUrl = obtenerApiPagosUrl();
  if (!apiPagosUrl) {
    alert("El pago en línea está temporalmente en configuración.");
    return;
  }

  try {
    const respuesta = await fetch(`${apiPagosUrl}/crear-pago`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        planId,
        plomeroId: perfilActualId
      })
    });

    const data = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok || !data.init_point) throw new Error(data.error || "No se pudo crear el pago.");
    window.location.href = data.init_point;

  } catch (error) {
    console.error("ERROR FETCH:", error);
    alert(error.message || "No conecta con el servidor de pagos.");
  }
}

async function aceptarSolicitudDisponible(solicitudId) {
  if (!perfilActual || !perfilActualId || !usuarioActual) {
    alert("No se encontró tu perfil profesional.");
    return;
  }

  try {
    await updateDoc(doc(db, "solicitudes", solicitudId), {
      estado: "Aceptado",
      plomeroId: perfilActualId,
      plomeroNombre: perfilActual.nombre || "",
      plomeroWhatsapp: perfilActual.whatsapp || "",
      fechaAceptacion: new Date().toLocaleDateString()
    });

    const solicitudDoc = await getDoc(doc(db, "solicitudes", solicitudId));
const solicitud = solicitudDoc.data();

await addDoc(collection(db, "notificaciones"), {
  usuarioId: solicitud.clienteId,
  titulo: "Solicitud aceptada",
  mensaje: `Tu solicitud fue aceptada por ${perfilActual.nombre || "un profesional VIGNA"}.`,
  tipo: "cliente",
  leida: false,
  fecha: new Date().toLocaleString(),
  timestamp: Date.now()
});

    alert("Trabajo aceptado correctamente.");

    await cargarSolicitudesDisponibles();
    await cargarSolicitudesVigna();

  } catch (error) {
    console.error(error);
    alert("Error aceptando solicitud: " + error.message);
  }
}

async function cerrarSesionVigna() {
  await signOut(auth);
  alert("Sesión cerrada.");
  window.location.href = "login-vigna.html";
}

window.guardarPerfil = guardarPerfil;
window.cerrarSesionVigna = cerrarSesionVigna;
window.subirTrabajoVigna = subirTrabajoVigna;
window.actualizarEstadoSolicitud = actualizarEstadoSolicitud;
window.aceptarSolicitudDisponible = aceptarSolicitudDisponible;
window.suscribirseProfesionalPanel = suscribirseProfesionalPanel;

document.addEventListener("DOMContentLoaded", cargarPanelVigna);
