function mostrarPlomeros() {
  const contenedor = document.getElementById("listaPlomeros");
  contenedor.innerHTML = "";

  const filtroDistrito =
    document.getElementById("buscarDistrito")?.value.toLowerCase() || "";

  const filtroEspecialidad =
    document.getElementById("buscarEspecialidad")?.value.toLowerCase() || "";

  const filtroNivel =
    document.getElementById("buscarNivel")?.value || "";

  const aprobados = plomeros
    .map((p, index) => ({ ...p, indexOriginal: index }))
    .filter((p) => {
      const distrito = (p.zona || p.distrito || "").toLowerCase();
      const especialidad = (p.especialidad || "").toLowerCase();

      return (
        p.estado === "Aprobado" &&
        distrito.includes(filtroDistrito) &&
        especialidad.includes(filtroEspecialidad) &&
        (filtroNivel === "" ||
          Number(p.nivel) === Number(filtroNivel))
      );
    })
    .sort((a, b) => {
      if (b.nivel !== a.nivel) {
        return b.nivel - a.nivel;
      }

      if (b.puntos !== a.puntos) {
        return b.puntos - a.puntos;
      }

      return (b.calificacion || 0) - (a.calificacion || 0);
    });

  if (aprobados.length === 0) {
    contenedor.innerHTML = `
      <div class="plomero-card">
        <h3>No se encontraron plomeros</h3>
        <p>Prueba con otro distrito, especialidad o nivel.</p>
      </div>
    `;
    return;
  }

  aprobados.forEach((p, posicion) => {

    let medalla = "";

    if (posicion === 0) {
      medalla = "🥇";
    } else if (posicion === 1) {
      medalla = "🥈";
    } else if (posicion === 2) {
      medalla = "🥉";
    }

    contenedor.innerHTML += `
      <div class="plomero-card">

        <img
          src="${p.foto || 'https://via.placeholder.com/150'}"
          class="foto-plomero"
        >

        <h3>${medalla} ${p.nombre}</h3>

        <p>${p.especialidad || "Plomería general"}</p>

        <p>Zona: ${p.zona || p.distrito}</p>

        <p><strong>Estado:</strong> ${p.estado}</p>

        <p class="nivel">
          🏆 Nivel ${p.nivel}
        </p>

        <p>${p.puntos} puntos</p>

        <p>
          🔧 Servicios realizados:
          ${p.trabajos}
        </p>

        <p class="estrellas">
          ⭐ ${Number(p.calificacion || 5).toFixed(1)}
          (${p.totalCalificaciones || 1} calificaciones)
        </p>

        <button
          class="btn-calificar"
          onclick="calificarPlomero(${p.indexOriginal})"
        >
          ⭐ Calificar
        </button>

        <button
          class="btn-servicio"
          onclick="contactarPlomero('${p.whatsapp || ""}','${p.nombre}')"
        >
          Solicitar servicio
        </button>

      </div>
    `;
  });
}

function ingresarAdmin() {

  const clave =
    document.getElementById("claveAdmin").value;

  if (clave === "vigna2026") {

    document.querySelector(".admin").style.display = "block";

    alert("Bienvenido Administrador");

  } else {

    alert("Contraseña incorrecta");

  }
}

document.addEventListener("DOMContentLoaded", () => {

  const panelAdmin =
    document.querySelector(".admin");

  if (panelAdmin) {
    panelAdmin.style.display = "none";
  }

});