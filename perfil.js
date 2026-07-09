async function cargarPerfilPublico() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const contenedor = document.getElementById("perfilVigna");

  if (!id) {
    contenedor.innerHTML = "<p>No se encontró el perfil.</p>";
    return;
  }

  const consultaPlomeros = await getDocs(collection(db, "plomeros"));
  const consultaTrabajos = await getDocs(collection(db, "trabajos"));
  const consultaComentarios = await getDocs(collection(db, "comentarios"));

  let p = null;

  consultaPlomeros.forEach((docu) => {
    if (docu.id === id) {
      p = {
        idFirebase: docu.id,
        ...docu.data()
      };
    }
  });

  if (!p) {
    contenedor.innerHTML = "<p>Este perfil no existe.</p>";
    return;
  }

  let trabajosHtml = "<h3>Trabajos realizados</h3>";
  let tieneTrabajos = false;

  consultaTrabajos.forEach((docu) => {
    const t = docu.data();

    if (
  String(t.plomeroId || "").trim() === String(id).trim() ||
  String(t.uid || "").trim() === String(p.uid || "").trim()
) {
      tieneTrabajos = true;

      trabajosHtml += `
        <div class="trabajo-box">
          <h4>${t.titulo || "Trabajo realizado"}</h4>
          <p>${t.descripcion || ""}</p>

          <div class="trabajo-fotos">
            <div>
              <p>Antes</p>
              <img src="${t.fotoAntes}" class="foto-trabajo">
            </div>

            <div>
              <p>Después</p>
              <img src="${t.fotoDespues}" class="foto-trabajo">
            </div>
          </div>
        </div>
      `;
    }
  });

  if (!tieneTrabajos) {
    trabajosHtml += "<p>Este VIGNA aún no tiene trabajos publicados.</p>";
  }

  let comentariosHtml = "<h3>Comentarios de clientes</h3>";
  let tieneComentarios = false;

  consultaComentarios.forEach((docu) => {
    const c = docu.data();

    if (String(c.plomeroId || "").trim() === String(id).trim()) {
      tieneComentarios = true;

      comentariosHtml += `
        <div class="comentario-box">
          ⭐ ${c.estrellas}
          <p>${c.comentario}</p>
          <small>${c.fecha || ""}</small>
        </div>
      `;
    }
  });

  if (!tieneComentarios) {
    comentariosHtml += "<p>Sin comentarios todavía.</p>";
  }

  contenedor.innerHTML = `
    <section class="perfil-vigna">
      <img
        src="${p.foto && p.foto !== "sin foto" ? p.foto : "images/avatar-default.png"}"
        class="foto-plomero"
        onerror="this.src='images/avatar-default.png'"
      >

      <h2>${p.nombre}</h2>

      <p><strong>Especialidad:</strong> ${p.especialidad || "Servicio general"}</p>
      <p><strong>Zona:</strong> ${p.zona || p.distrito || "No registrada"}</p>
      <p><strong>Disponibilidad:</strong> ${p.disponibilidad || "Disponible"}</p>
      <p><strong>Nivel:</strong> ${p.nivel || 1}</p>
      <p><strong>Calificación:</strong> ⭐ ${Number(p.calificacion || 5).toFixed(1)}</p>
      <p><strong>Servicios realizados:</strong> ${p.trabajos || 0}</p>

      ${trabajosHtml}

      ${comentariosHtml}

      <a class="btn-servicio" href="https://wa.me/51${p.whatsapp || ""}" target="_blank">
        Contactar por WhatsApp
      </a>

      <br><br>

      <button onclick="window.location.href='plomeros.html'">
        Volver al ranking
      </button>
    </section>
  `;
}

document.addEventListener("DOMContentLoaded", cargarPerfilPublico);