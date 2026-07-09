let clienteActual = null;
let datosClienteActual = null;
let listenerNotificacionesCliente = null;

function cargarPanelCliente() {
  onAuthStateChanged(auth, async (user) => {
    const contenedor = document.getElementById("datosCliente");

    if (!user) {
      alert("Debes iniciar sesión.");
      window.location.href = "login-cliente.html";
      return;
    }

    clienteActual = user;

    await cargarDatosCliente();

    contenedor.innerHTML = `
      <p><strong>Nombre:</strong> ${datosClienteActual.nombre || "Cliente VIGNA"}</p>
      <p><strong>Correo:</strong> ${user.email}</p>
      <p><strong>WhatsApp:</strong> ${datosClienteActual.whatsapp || ""}</p>
      <p><strong>Distrito:</strong> ${datosClienteActual.distrito || ""}</p>
    `;

    await cargarSolicitudesCliente();
    escucharSolicitudesCliente();
    escucharNotificacionesCliente();
  });
}

async function cargarDatosCliente() {
  const consulta = await getDocs(
    query(
      collection(db, "usuarios"),
      where("uid", "==", clienteActual.uid)
    )
  );

  consulta.forEach((documento) => {
    datosClienteActual = documento.data();
  });

  if (!datosClienteActual) {
    datosClienteActual = {
      nombre: "",
      whatsapp: "",
      distrito: ""
    };
  }
}

function escucharSolicitudesCliente() {
  const contenedor = document.getElementById("listaSolicitudesCliente");

  if (!contenedor || !datosClienteActual) return;

  const consulta = collection(db, "solicitudes");

  onSnapshot(consulta, () => {
    cargarSolicitudesCliente();
  });
}

function escucharNotificacionesCliente() {
  const contenedor = document.getElementById("notificacionesCliente");

  if (!contenedor || !clienteActual) return;

  if (listenerNotificacionesCliente) {
    listenerNotificacionesCliente();
  }

  const consulta = query(
    collection(db, "notificaciones"),
    where("usuarioId", "==", clienteActual.uid)
  );

  listenerNotificacionesCliente = onSnapshot(consulta, (snapshot) => {
    let html = "";
    let cantidad = 0;

    const notificaciones = [];

snapshot.forEach((documento) => {
  notificaciones.push({
    id: documento.id,
    ...documento.data()
  });
});

notificaciones.sort((a, b) => {
  return Number(b.timestamp || 0) - Number(a.timestamp || 0);
});

notificaciones.forEach((n) => {
  cantidad++;

  html += `
    <div class="comentario-box">
      <strong>${n.titulo || "Notificación"}</strong>
      <p>${n.mensaje || ""}</p>
      <small>${n.fecha || ""}</small>
    </div>
  `;
});

    if (cantidad === 0) {
      html = "<p>No tienes notificaciones nuevas.</p>";
    }

    contenedor.innerHTML = html;
  });
}

async function cargarSolicitudesCliente() {
  const contenedor = document.getElementById("listaSolicitudesCliente");

  const consulta = await getDocs(collection(db, "solicitudes"));

  let html = "";
  let cantidad = 0;

  consulta.forEach((documento) => {
    const s = documento.data();

    if (
      String(s.clienteWhatsapp || "").trim() ===
      String(datosClienteActual.whatsapp || "").trim()
    ) {
      cantidad++;

      html += `
        <div class="plomero-card">
          <h3>${s.plomeroNombre || s.especialidad || "Solicitud pendiente"}</h3>

          <p><strong>Servicio:</strong> ${s.descripcion}</p>
          <p><strong>Zona:</strong> ${s.zona || s.distrito || ""}</p>
          <p><strong>Estado:</strong> ${s.estado}</p>
          <p><strong>Fecha:</strong> ${s.fecha}</p>

          ${
  s.plomeroWhatsapp
    ? `
      <a
        href="https://wa.me/51${s.plomeroWhatsapp}"
        target="_blank"
        class="btn-servicio">
        Contactar profesional
      </a>
    `
    : `<p><strong>Profesional:</strong> Aún no asignado</p>`
}

          ${
  s.estado === "Finalizado" && !s.calificado
    ? `
      <button onclick="calificarServicio('${documento.id}', '${s.plomeroId}', '${s.plomeroNombre}')">
        Calificar servicio
      </button>
    `
    : ""
}
        </div>
      `;
    }
  });

  if (cantidad === 0) {
    html = "<p>Aún no tienes solicitudes registradas.</p>";
  }

  contenedor.innerHTML = html;
}

async function calificarServicio(solicitudId, plomeroId, plomeroNombre) {
  const estrellas = prompt("Califica de 1 a 5 estrellas:");

  if (!estrellas) return;

  const valor = Number(estrellas);

  if (valor < 1 || valor > 5) {
    alert("La calificación debe ser entre 1 y 5.");
    return;
  }

  const comentario = prompt("Escribe un comentario sobre el servicio:");

  if (!comentario) return;

  const consulta = await getDocs(collection(db, "plomeros"));

  let plomeroActual = null;

  consulta.forEach((documento) => {
    if (documento.id === plomeroId) {
      plomeroActual = {
        idFirebase: documento.id,
        ...documento.data()
      };
    }
  });

  if (!plomeroActual) {
    alert("No se encontró el profesional.");
    return;
  }

  const totalActual = Number(plomeroActual.totalCalificaciones || 0);
  const promedioActual = Number(plomeroActual.calificacion || 0);

  const nuevoPromedio =
    ((promedioActual * totalActual) + valor) / (totalActual + 1);

  await addDoc(collection(db, "comentarios"), {
    solicitudId,
    plomeroId,
    plomeroNombre,
    clienteId: clienteActual.uid,
    clienteNombre: datosClienteActual.nombre,
    estrellas: valor,
    comentario,
    fecha: new Date().toLocaleDateString()
  });

  await updateDoc(doc(db, "plomeros", plomeroId), {
    calificacion: nuevoPromedio,
    totalCalificaciones: totalActual + 1
  });

  await updateDoc(doc(db, "solicitudes", solicitudId), {
    calificado: true
  });

  alert("Gracias por calificar el servicio.");

  await cargarSolicitudesCliente();
}

async function cerrarSesionCliente() {
  await signOut(auth);
  alert("Sesión cerrada.");
  window.location.href = "login-cliente.html";
}
async function crearSolicitudCliente() {
  if (!clienteActual || !datosClienteActual) {
    alert("Debes iniciar sesión como cliente.");
    return;
  }

  const especialidad = document.getElementById("especialidadSolicitud").value;
  const distrito = document.getElementById("distritoSolicitud").value.trim();
  const descripcion = document.getElementById("descripcionSolicitud").value.trim();

  if (!especialidad || !distrito || !descripcion) {
    alert("Completa especialidad, distrito y descripción.");
    return;
  }

  try {
    await addDoc(collection(db, "solicitudes"), {
      clienteId: clienteActual.uid,
      clienteNombre: datosClienteActual.nombre || "",
      clienteWhatsapp: datosClienteActual.whatsapp || "",
      clienteCorreo: clienteActual.email,
      especialidad,
      distrito,
      zona: distrito,
      descripcion,
      estado: "Pendiente",
      fecha: new Date().toLocaleDateString(),
      origen: "Panel cliente"
    });

    alert("Solicitud publicada correctamente.");

    document.getElementById("especialidadSolicitud").value = "";
    document.getElementById("distritoSolicitud").value = "";
    document.getElementById("descripcionSolicitud").value = "";

    await cargarSolicitudesCliente();

  } catch (error) {
    console.error(error);
    alert("Error creando solicitud: " + error.message);
  }
}

window.cerrarSesionCliente = cerrarSesionCliente;
window.crearSolicitudCliente = crearSolicitudCliente;
window.calificarServicio = calificarServicio;

document.addEventListener("DOMContentLoaded", cargarPanelCliente);