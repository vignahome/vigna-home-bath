console.log("SERVIDOR NUEVO VIGNA 123");
let ubicaciones = {};

fetch("data/ubigeo-peru.json")
  .then((respuesta) => respuesta.json())
  .then((datos) => {
    ubicaciones = datos;
    console.log("Ubigeo Perú cargado correctamente");
  })
  .catch((error) => {
    console.error("Error cargando ubigeo:", error);
  });

function cargarProvincias() {
  const departamento = document.getElementById("departamento").value;
  const provinciaSelect = document.getElementById("provincia");
  const distritoSelect = document.getElementById("distrito");

  provinciaSelect.innerHTML = `<option value="">Selecciona provincia</option>`;
  distritoSelect.innerHTML = `<option value="">Selecciona distrito</option>`;

  if (!ubicaciones[departamento]) return;

  Object.keys(ubicaciones[departamento]).forEach((provincia) => {
    provinciaSelect.innerHTML += `
      <option value="${provincia}">${provincia}</option>
    `;
  });
}

function cargarDistritos() {
  const departamento = document.getElementById("departamento").value;
  const provincia = document.getElementById("provincia").value;
  const distritoSelect = document.getElementById("distrito");

  distritoSelect.innerHTML = `<option value="">Selecciona distrito</option>`;

  if (!ubicaciones[departamento] || !ubicaciones[departamento][provincia]) return;

  ubicaciones[departamento][provincia].forEach((distrito) => {
    distritoSelect.innerHTML += `
      <option value="${distrito}">${distrito}</option>
    `;
  });
}

let trabajosVigna = [];
let comentariosVigna = [];
let plomeros = JSON.parse(localStorage.getItem("plomeros")) || [

  {
    nombre: "Carlos Ramírez",
    distrito: "Surco",
    whatsapp: "999999999",
    nivel: 3,
    estado: "Aprobado",
    puntos: 850,
    trabajos: 24,
    calificacion: 5,
    totalCalificaciones: 1,
    especialidad: "Instalaciones",
    zona: "Surco",
    foto: "https://via.placeholder.com/150"
  },
  {
    nombre: "Miguel Torres",
    distrito: "Miraflores",
    whatsapp: "999999999",
    nivel: 2,
    estado: "Aprobado",
    puntos: 520,
    trabajos: 12,
    calificacion: 4,
    totalCalificaciones: 1,
    especialidad: "Fugas",
    zona: "Miraflores",
    foto: "https://via.placeholder.com/150"
  }
];

function guardarPlomeros() {
  localStorage.setItem("plomeros", JSON.stringify(plomeros));
}

async function cargarPlomerosFirebase() {
  const consultaPlomeros = await getDocs(collection(db, "plomeros"));
  const consultaTrabajos = await getDocs(collection(db, "trabajos"));
  const consultaComentarios = await getDocs(collection(db, "comentarios"));

  plomeros = [];
  trabajosVigna = [];
  comentariosVigna = [];

  consultaPlomeros.forEach((documento) => {
    plomeros.push({
      idFirebase: documento.id,
      ...documento.data()
    });
  });

  consultaTrabajos.forEach((documento) => {
    trabajosVigna.push({
      idFirebase: documento.id,
      ...documento.data()
    });
  });

  consultaComentarios.forEach((documento) => {
    comentariosVigna.push({
      idFirebase: documento.id,
      ...documento.data()
    });
  });

  mostrarPlomeros();
  mostrarAdmin();

  console.log("Datos VIGNA cargados correctamente");
}

function planEstaVigente(fechaVencimiento) {
  if (!fechaVencimiento) return false;

  const partes = fechaVencimiento.split("/");
  const fechaFinal = new Date(partes[2], partes[1] - 1, partes[0]);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return fechaFinal >= hoy;
}

function calcularDiasRestantes(fechaVencimiento) {
  if (!fechaVencimiento) return 0;

  const partes = fechaVencimiento.split("/");
  const fechaFinal = new Date(partes[2], partes[1] - 1, partes[0]);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diferencia = fechaFinal.getTime() - hoy.getTime();

  return Math.max(0, Math.ceil(diferencia / (1000 * 60 * 60 * 24)));
}

function mostrarInsignia(verificacion, fechaVencimiento) {
  if (verificacion === "Plan Activo" && planEstaVigente(fechaVencimiento)) {
    return "🛡️ Plan Activo";
  }

  if (verificacion === "Plan Activo" && !planEstaVigente(fechaVencimiento)) {
    return "🔴 Plan Vencido";
  }

  return "🟡 Sin plan activo";
}

function mostrarPlomeros() {
  const contenedor = document.getElementById("listaPlomeros");
  const topContenedor = document.getElementById("topVignaMes");

if(topContenedor){
    topContenedor.innerHTML = "";
}
  contenedor.innerHTML = "";

  const filtroDistrito = document.getElementById("buscarDistrito")?.value.toLowerCase() || "";
  const filtroEspecialidad = document.getElementById("buscarEspecialidad")?.value.toLowerCase() || "";
  const filtroNivel = document.getElementById("buscarNivel")?.value || "";

  const aprobados = plomeros
    .map((p, index) => ({ ...p, indexOriginal: index }))
    .filter((p) => {
      const distrito = (p.zona || p.distrito || "").toLowerCase();
      const especialidad = (p.especialidad || "").toLowerCase();

      return (
        p.estado === "Aprobado" &&
        p.verificacion === "Plan Activo" &&
        planEstaVigente(p.fechaVencimiento) &&
        distrito.includes(filtroDistrito) &&
        especialidad.includes(filtroEspecialidad) &&
        (filtroNivel === "" || Number(p.nivel) === Number(filtroNivel))
      );
    })
    .sort((a, b) => {
      return (
        (b.calificacion || 0) - (a.calificacion || 0) ||
        (b.trabajos || 0) - (a.trabajos || 0) ||
        (b.nivel || 0) - (a.nivel || 0) ||
        (b.puntos || 0) - (a.puntos || 0)
      );
    });

  if (aprobados.length === 0) {
    contenedor.innerHTML = `
      <div class="plomero-card">
        <h3>No se encontraron VIGNAS</h3>
        <p>Prueba con otro distrito, especialidad o nivel.</p>
      </div>
    `;
    return;
  }

  let html = "";

  aprobados.forEach((p, posicion) => {
  const posicionRanking = posicion + 1;

  let insigniaImg = "";

  if (posicionRanking === 1) {
    insigniaImg = "images/insignias/top1.png";
  } else if (posicionRanking === 2) {
    insigniaImg = "images/insignias/top2.png";
  } else if (posicionRanking === 3) {
    insigniaImg = "images/insignias/top3.png";
  } else if (posicionRanking <= 10) {
    insigniaImg = "images/insignias/top10.png";
  } else if (posicionRanking <= 50) {
    insigniaImg = "images/insignias/top50.png";
  } else if (posicionRanking <= 100) {
    insigniaImg = "images/insignias/top100.png";
  }

  if(posicionRanking <= 3 && topContenedor){

topContenedor.innerHTML += `
<div class="top-card">
  <img src="${insigniaImg}" class="top-insignia">
  <img src="${p.foto}" class="top-avatar">

  <h3>${p.nombre}</h3>
  <button onclick="verDetalleProfesional(${p.indexOriginal})">
  👤 Ver ficha completa
</button>

  <p>⭐ ${Number(p.calificacion || 0).toFixed(1)}</p>

  <p>${p.especialidad}</p>
</div>
`;

}

    html += `
      <div class="plomero-card">

  <div class="card-top-vigna">
    <img
      src="${p.foto && p.foto !== "sin foto" ? p.foto : "images/avatar-default.png"}"
      class="foto-plomero"
      onerror="this.src='images/avatar-default.png'"
    >

    <img
      src="${insigniaImg}"
      class="insignia-vigna"
      alt="Insignia VIGNA"
    >
  </div>

  <h3>${p.nombre}</h3>

  <p class="puesto-ranking">Puesto #${posicionRanking}</p>

  <small>ID VIGNA: ${p.idFirebase}</small>

  <p>${p.especialidad || "Servicio general"}</p>
  <p>Zona: ${p.zona || p.distrito}</p>
  <p>📅 Disponibilidad: ${p.disponibilidad || "Disponible"}</p>
  <p><strong>Estado:</strong> ${p.estado}</p>
  <div class="verificacion-vigna">
  <p>✅ DNI verificado</p>
  <p>✅ WhatsApp verificado</p>
  <p>✅ Profesional aprobado por VIGNA</p>
</div>
  <p><strong>Estado:</strong> ${mostrarInsignia(p.verificacion, p.fechaVencimiento)}</p>
  <p><strong>Plan:</strong> ${p.plan || "No registrado"}</p>
  <p><strong>Vence:</strong> ${p.fechaVencimiento || "No registrado"}</p>
  <p>⏳ Días restantes: ${calcularDiasRestantes(p.fechaVencimiento)}</p>

  <p class="nivel">🏆 Nivel ${p.nivel}</p>
  <p>${p.puntos || 0} puntos</p>
  <p>🔧 Servicios realizados: ${p.trabajos || 0}</p>

  <p class="estrellas">
    ⭐ ${Number(p.calificacion || 5).toFixed(1)}
    (${p.totalCalificaciones || 1} calificaciones)
  </p>

  <button onclick="window.location.href='perfil.html?id=${p.idFirebase}'">
    Ver perfil
  </button>

        <button class="btn-servicio" onclick="solicitarServicio(${p.indexOriginal})">
          Solicitar servicio
        </button>
      </div>
    `;
  });

  contenedor.innerHTML = html;

}

function mostrarAdmin() {
  const pendientes = document.getElementById("listaAdminPendientes");
  const aprobados = document.getElementById("listaAdminAprobados");
  const rechazados = document.getElementById("listaAdminRechazados");

  if (!pendientes || !aprobados || !rechazados) return;

  pendientes.innerHTML = "";
  aprobados.innerHTML = "";
  rechazados.innerHTML = "";

  plomeros.forEach((p, index) => {
    const tarjeta = `
      <div class="plomero-card">
        <img
          src="${p.foto && p.foto !== 'https://via.placeholder.com/150'
            ? p.foto
            : 'images/avatar-default.png'}"
          class="foto-plomero"
          onerror="this.src='images/avatar-default.png'"
        >

        <h3>${p.nombre}</h3>

        <button onclick="verDetalleProfesional(${index})">
  👤 Ver ficha completa
</button>

        <p>${p.especialidad || "Plomería general"}</p>
        <p>Zona: ${p.zona || p.distrito || "No registrada"}</p>
        <p><strong>Estado:</strong> ${p.estado || "Pendiente"}</p>
        <p><strong>Disponibilidad:</strong> ${p.disponibilidad || "Disponible"}</p>
        <p><strong>Estado del plan:</strong> ${p.verificacion || "Pendiente"}</p>
        <p><strong>Plan:</strong> ${p.plan || "No registrado"}</p>
        <p><strong>Vence:</strong> ${p.fechaVencimiento || "No registrado"}</p>
        <p><strong>DNI:</strong> ${p.dni || "No registrado"}</p>
        <p><strong>Empresa:</strong> ${p.empresa || "Independiente"}</p>
        <p><strong>Colegiatura:</strong> ${p.colegiatura || "No aplica"}</p>

        <p class="nivel">🏆 Nivel ${p.nivel || 1}</p>
        <p>${p.puntos || 0} puntos</p>
        <p>🔧 Servicios realizados: ${p.trabajos || 0}</p>

        <div class="documentos-admin">
          ${p.foto ? `<a href="${p.foto}" target="_blank">📸 Ver foto</a>` : ""}
          ${p.fotoDni ? `<a href="${p.fotoDni}" target="_blank">🪪 Ver DNI</a>` : ""}
          ${p.certificado ? `<a href="${p.certificado}" target="_blank">📄 Ver certificado</a>` : ""}
        </div>

        <button onclick="aprobarPlomero(${index})">
          ✅ Aprobar
        </button>

        <button onclick="rechazarPlomero(${index})">
          ❌ Rechazar
        </button>

        <button onclick="suspenderPlomero(${index})">
  🚫 Suspender
</button>

        <button onclick="cambiarVerificacion(${index}, 'Plan Activo')">
          🛡️ Plan Activo
        </button>

        <button onclick="cambiarVerificacion(${index}, 'Pendiente')">
          🟡 Sin plan activo
        </button>
      </div>
    `;

    if (p.estado === "Aprobado") {
      aprobados.innerHTML += tarjeta;
    } else if (p.estado === "Rechazado") {
      rechazados.innerHTML += tarjeta;
    } else {
      pendientes.innerHTML += tarjeta;
    }
  });

  if (!pendientes.innerHTML) {
    pendientes.innerHTML = "<p>No hay profesionales pendientes.</p>";
  }

  if (!aprobados.innerHTML) {
    aprobados.innerHTML = "<p>No hay profesionales aprobados.</p>";
  }

  if (!rechazados.innerHTML) {
    rechazados.innerHTML = "<p>No hay profesionales rechazados.</p>";
  }
}

async function aprobarPlomero(index) {
  const plomero = plomeros[index];

  if (!plomero.idFirebase) {
    alert("Este plomero no tiene ID de Firebase.");
    return;
  }

  await updateDoc(doc(db, "plomeros", plomero.idFirebase), {
    estado: "Aprobado"
  });

  alert("Plomero aprobado correctamente.");

  cargarPlomerosFirebase();
}

async function rechazarPlomero(index) {
  const plomero = plomeros[index];

  if (!plomero.idFirebase) {
    alert("Este plomero no tiene ID de Firebase.");
    return;
  }

  await updateDoc(doc(db, "plomeros", plomero.idFirebase), {
    estado: "Rechazado"
  });

  alert("Plomero rechazado correctamente.");

  cargarPlomerosFirebase();
}

async function suspenderPlomero(index) {
  const plomero = plomeros[index];

  if (!plomero.idFirebase) {
    alert("Este profesional no tiene ID de Firebase.");
    return;
  }

  await updateDoc(doc(db, "plomeros", plomero.idFirebase), {
    estado: "Suspendido",
    verificacion: "Pendiente"
  });

  alert("Profesional suspendido correctamente.");

  cargarPlomerosFirebase();
}

async function cambiarVerificacion(index, nuevoEstado) {
  const plomero = plomeros[index];

  if (!plomero.idFirebase) {
    alert("Este profesional no tiene ID de Firebase.");
    return;
  }

  const fechaVencimiento = new Date();
  fechaVencimiento.setMonth(fechaVencimiento.getMonth() + 1);

  if (nuevoEstado === "Plan Activo") {
    await updateDoc(doc(db, "plomeros", plomero.idFirebase), {
      estado: "Aprobado",
      verificacion: "Plan Activo",
      plan: "Activado manualmente",
      fechaVencimiento: fechaVencimiento.toLocaleDateString()
    });
  } else {
    await updateDoc(doc(db, "plomeros", plomero.idFirebase), {
      verificacion: "Pendiente",
      plan: "",
      fechaVencimiento: ""
    });
  }

  alert("Verificación actualizada correctamente.");

  await cargarPlomerosFirebase();
}

async function solicitarServicio(index) {
  const plomero = plomeros[index];

  const nombreCliente = prompt("Ingresa tu nombre:");
  if (!nombreCliente) return;

  const whatsappCliente = prompt("Ingresa tu WhatsApp:");
  if (!whatsappCliente) return;

  const descripcion = prompt("Describe el servicio que necesitas:");
  if (!descripcion) return;

  const solicitud = {
    plomeroId: plomero.idFirebase,
    plomeroNombre: plomero.nombre,
    plomeroWhatsapp: plomero.whatsapp || "",
    clienteNombre: nombreCliente,
    clienteWhatsapp: whatsappCliente,
    descripcion: descripcion,
    distrito: plomero.distrito || "",
    zona: plomero.zona || "",
    estado: "Pendiente",
    fecha: new Date().toLocaleDateString()
  };

  await addDoc(collection(db, "solicitudes"), solicitud);

const mensaje = `
Hola ${plomero.nombre}, tienes una nueva solicitud de servicio en VIGNA.

Cliente: ${nombreCliente}
WhatsApp: ${whatsappCliente}

Servicio solicitado:
${descripcion}

Zona:
${plomero.zona || plomero.distrito}

Por favor responde al cliente lo antes posible.
`;

const urlWhatsapp =
  "https://wa.me/51" +
  (plomero.whatsapp || "") +
  "?text=" +
  encodeURIComponent(mensaje);

window.open(urlWhatsapp, "_blank");

alert("Solicitud enviada correctamente. Se abrirá WhatsApp para contactar al profesional.");
}

async function cargarSolicitudes() {
  const contenedor = document.getElementById("listaSolicitudes");

  if (!contenedor) {
    alert("No existe el contenedor listaSolicitudes en el HTML.");
    return;
  }

  contenedor.innerHTML = "<p>Cargando solicitudes...</p>";

  const consulta = await getDocs(collection(db, "solicitudes"));

  if (consulta.empty) {
    contenedor.innerHTML = `
      <div class="plomero-card">
        <h3>No hay solicitudes todavía</h3>
        <p>Primero crea una solicitud desde el botón Solicitar servicio.</p>
      </div>
    `;
    return;
  }

  contenedor.innerHTML = "";

  consulta.forEach((documento) => {
    const s = documento.data();

    contenedor.innerHTML += `
      <div class="plomero-card">
        <h3>Solicitud de servicio</h3>

        <p><strong>Cliente:</strong> ${s.clienteNombre}</p>
        <p><strong>WhatsApp cliente:</strong> ${s.clienteWhatsapp}</p>
        <p><strong>Profesional:</strong> ${s.plomeroNombre}</p>
        <p><strong>WhatsApp profesional:</strong> ${s.plomeroWhatsapp}</p>
        <p><strong>Descripción:</strong> ${s.descripcion}</p>
        <p><strong>Zona:</strong> ${s.zona}</p>
        <p><strong>Estado:</strong> ${s.estado}</p>
        <p><strong>Fecha:</strong> ${s.fecha}</p>

        <a href="https://wa.me/51${s.clienteWhatsapp}" target="_blank">
          Contactar cliente
        </a>

        <a href="https://wa.me/51${s.plomeroWhatsapp}" target="_blank">
          Contactar profesional
        </a>

        <button onclick="marcarServicioRealizado('${documento.id}','${s.plomeroId}')">
          ✅ Marcar como realizado
        </button>
      </div>
    `;
  });
}

async function marcarServicioRealizado(solicitudId, plomeroId) {

  const plomero = plomeros.find(
    p => p.idFirebase === plomeroId
  );

  if (!plomero) {
    alert("No se encontró el profesional.");
    return;
  }

  await updateDoc(
    doc(db, "solicitudes", solicitudId),
    {
      estado: "Realizado"
    }
  );

  await updateDoc(
    doc(db, "plomeros", plomeroId),
    {
      puntos: (plomero.puntos || 0) + 100,
      trabajos: (plomero.trabajos || 0) + 1
    }
  );

  alert("Servicio completado correctamente.");

  cargarPlomerosFirebase();
  cargarSolicitudes();
}

async function calificarPlomero(index) {

  const plomero = plomeros[index];

  const estrellas = prompt("Califica de 1 a 5 estrellas");

  if (!estrellas) return;

  const valor = Number(estrellas);

  if (valor < 1 || valor > 5) {
    alert("Debe ser un valor entre 1 y 5");
    return;
  }

  const comentario = prompt(
    "Escribe un comentario sobre el servicio:"
  );

  if (!comentario) return;

  const totalActual =
    Number(plomero.totalCalificaciones || 0);

  const promedioActual =
    Number(plomero.calificacion || 0);

  const nuevoPromedio =
    ((promedioActual * totalActual) + valor) /
    (totalActual + 1);

  await updateDoc(
    doc(db, "plomeros", plomero.idFirebase),
    {
      calificacion: nuevoPromedio,
      totalCalificaciones: totalActual + 1
    }
  );

  await addDoc(
    collection(db, "comentarios"),
    {
      plomeroId: plomero.idFirebase,
      plomeroNombre: plomero.nombre,
      estrellas: valor,
      comentario: comentario,
      fecha: new Date().toLocaleDateString()
    }
  );

  alert("Gracias por tu calificación y comentario.");

  cargarPlomerosFirebase();
}

async function ingresarAdmin() {

    const correo = prompt("Correo del administrador");

    if (!correo) return;

    const password = document.getElementById("claveAdmin").value;

    try {

        const credencial = await signInWithEmailAndPassword(
            auth,
            correo,
            password
        );

        const adminDoc = await getDoc(
            doc(db, "admins", credencial.user.uid)
        );

        if (!adminDoc.exists()) {
            alert("No tienes permisos de administrador.");
            await signOut(auth);
            return;
        }

        const datos = adminDoc.data();

        if (!datos.activo) {
            alert("Administrador deshabilitado.");
            await signOut(auth);
            return;
        }

        document.querySelector(".admin").style.display = "block";

        await cargarDashboardAdmin();

        alert("Bienvenido Administrador");

    } catch (error) {

        console.log(error);

        alert("Correo o contraseña incorrectos.");

    }

}

async function suscribirseProfesional(plan, precio, meses) {
  const plomeroId = localStorage.getItem("vignaPendientePago");

  if (!plomeroId) {
    alert("Primero debes llenar y enviar la postulación VIGNA antes de pagar.");
    return;
  }

  try {
    const respuesta = await fetch("http://localhost:3000/crear-pago", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        plan,
        precio,
        meses,
        verificacion: "Plan Activo",
        plomeroId
      })
    });

    const data = await respuesta.json();

    console.log("RESPUESTA DEL SERVIDOR:", data);

    if (data.init_point) {
      window.location.href = data.init_point;
    } else {
      alert("No se pudo crear el pago. Revisa la terminal de server.js.");
    }

  } catch (error) {
    console.error("ERROR FETCH:", error);
    alert("No conecta con el servidor de pagos.");
  }
}

async function revisarPagoMercadoPago() {
  const params = new URLSearchParams(window.location.search);

  const pago = params.get("pago");
  const status = params.get("status");
  const collectionStatus = params.get("collection_status");

  const plan = params.get("plan") || "VIGNA Profesional";
  const meses = Number(params.get("meses")) || 1;
  const verificacion = params.get("verificacion") || "Plan Activo";
  const plomeroId = params.get("plomeroId") || localStorage.getItem("vignaPendientePago");

  const pagoAprobado =
    pago === "aprobado" ||
    status === "approved" ||
    collectionStatus === "approved";

  if (!pagoAprobado || !plomeroId) return;

  const fechaInicio = new Date();
  const fechaVencimiento = new Date();
  fechaVencimiento.setMonth(fechaVencimiento.getMonth() + meses);

  const suscripcion = {
    plomeroId,
    plan,
    meses,
    verificacion,
    estado: "Activo",
    fechaInicio: fechaInicio.toLocaleDateString(),
    fechaVencimiento: fechaVencimiento.toLocaleDateString(),
    origen: "Mercado Pago"
  };

  localStorage.setItem("suscripcionProfesional", JSON.stringify(suscripcion));

  await addDoc(collection(db, "suscripciones"), suscripcion);

  await updateDoc(doc(db, "plomeros", plomeroId), {
    estado: "Aprobado",
    verificacion: "Plan Activo",
    plan: plan,
    fechaVencimiento: suscripcion.fechaVencimiento
  });

  localStorage.removeItem("vignaPendientePago");

  alert("Pago aprobado. El VIGNA ya aparece automáticamente en el ranking.");

  window.history.replaceState({}, document.title, "plomeros.html");

  await cargarPlomerosFirebase();
  mostrarEstadoSuscripcion();
}

function mostrarEstadoSuscripcion() {
  const estado = document.getElementById("estadoSuscripcion");

  if (!estado) return;

  const suscripcion = JSON.parse(localStorage.getItem("suscripcionProfesional"));

  if (!suscripcion) {
    estado.innerHTML = `
      <p>No tienes un plan profesional activo.</p>
    `;
    return;
  }

  estado.innerHTML = `
    <h3>Plan profesional activo</h3>
    <p>Plan: <strong>${suscripcion.plan}</strong></p>
    <p>Estado profesional: <strong>${suscripcion.verificacion}</strong></p>
    <p>Duración: <strong>${suscripcion.meses} meses</strong></p>
<p>Fecha de activación: ${suscripcion.fechaInicio}</p>
<p>Vence el: <strong>${suscripcion.fechaVencimiento}</strong></p>

    <button onclick="cancelarSuscripcion()">
      Cancelar plan
    </button>
  `;
}

function cancelarSuscripcion() {
  localStorage.removeItem("suscripcionProfesional");

  mostrarEstadoSuscripcion();
  mostrarPlomeros();

  alert("Plan profesional cancelado.");
}

document.addEventListener("DOMContentLoaded", () => {
  const panelAdmin = document.querySelector(".admin");

  if (panelAdmin) {
    panelAdmin.style.display = "none";
  }

    revisarPagoMercadoPago();

  cargarPlomerosFirebase();
  mostrarEstadoSuscripcion();
});

const departamentoSelect = document.getElementById("departamento");
const provinciaSelect = document.getElementById("provincia");

if (departamentoSelect) {
  departamentoSelect.addEventListener("change", cargarProvincias);
}

if (provinciaSelect) {
  provinciaSelect.addEventListener("change", cargarDistritos);
}

window.cargarProvincias = cargarProvincias;
window.cargarDistritos = cargarDistritos;
window.cambiarVerificacion = cambiarVerificacion;
window.ingresarAdmin = ingresarAdmin;
window.solicitarServicio = solicitarServicio;
window.cargarSolicitudes = cargarSolicitudes;
window.marcarServicioRealizado = marcarServicioRealizado;
window.calificarPlomero = calificarPlomero;
window.suscribirseProfesional = suscribirseProfesional;

function verPerfilVigna(id) {
  const p = plomeros.find(v => v.idFirebase === id);
  const contenedor = document.getElementById("perfilVigna");

  if (!p || !contenedor) return;

  const trabajos = trabajosVigna.filter(t =>
    String(t.plomeroId || "").trim() === String(id).trim()
  );

  let trabajosHtml = "<h3>Trabajos realizados</h3>";

  if (trabajos.length === 0) {
    trabajosHtml += "<p>Este VIGNA aún no tiene trabajos publicados.</p>";
  } else {
    trabajos.forEach(t => {
      trabajosHtml += `
        <div class="trabajo-box">
          <h4>${t.titulo || "Trabajo realizado"}</h4>
          <p>${t.descripcion || ""}</p>
          <div class="trabajo-fotos">
            <img src="${t.fotoAntes}" class="foto-trabajo">
            <img src="${t.fotoDespues}" class="foto-trabajo">
          </div>
        </div>
      `;
    });
  }

  contenedor.innerHTML = `
    <section class="perfil-vigna">
      <h2>Perfil de ${p.nombre}</h2>
      <img src="${p.foto && p.foto !== "sin foto" ? p.foto : "images/avatar-default.png"}" class="foto-plomero">

      <p><strong>Especialidad:</strong> ${p.especialidad}</p>
      <p><strong>Zona:</strong> ${p.zona || p.distrito}</p>
      <p><strong>Nivel:</strong> ${p.nivel}</p>
      <p><strong>Calificación:</strong> ⭐ ${Number(p.calificacion || 5).toFixed(1)}</p>

      ${trabajosHtml}

<h3>Comentarios de clientes</h3>
${renderComentarios(id)}

<button class="btn-servicio" onclick="solicitarServicio(${plomeros.indexOf(p)})">
        Solicitar servicio
      </button>
    </section>
  `;

  contenedor.scrollIntoView({ behavior: "smooth" });
}

function renderComentarios(plomeroId) {
  const comentarios = comentariosVigna.filter(
    c => String(c.plomeroId) === String(plomeroId)
  );

  if (comentarios.length === 0) {
    return "<p>Sin comentarios todavía.</p>";
  }

  let html = "";

  comentarios.forEach(c => {
    html += `
      <div class="comentario-box">
        ⭐ ${c.estrellas}
        <p>${c.comentario}</p>
        <small>${c.fecha}</small>
      </div>
    `;
  });

  return html;
}

function mostrarSolo(tipo) {
  const pendientes = document.getElementById("listaAdminPendientes");
  const aprobados = document.getElementById("listaAdminAprobados");
  const rechazados = document.getElementById("listaAdminRechazados");

  const tituloPendientes = pendientes.previousElementSibling;
  const tituloAprobados = aprobados.previousElementSibling;
  const tituloRechazados = rechazados.previousElementSibling;

  pendientes.style.display = "grid";
  aprobados.style.display = "grid";
  rechazados.style.display = "grid";

  tituloPendientes.style.display = "block";
  tituloAprobados.style.display = "block";
  tituloRechazados.style.display = "block";

  if (tipo === "pendientes") {
    aprobados.style.display = "none";
    rechazados.style.display = "none";

    tituloAprobados.style.display = "none";
    tituloRechazados.style.display = "none";
  }

  if (tipo === "aprobados") {
    pendientes.style.display = "none";
    rechazados.style.display = "none";

    tituloPendientes.style.display = "none";
    tituloRechazados.style.display = "none";
  }

  if (tipo === "rechazados") {
    pendientes.style.display = "none";
    aprobados.style.display = "none";

    tituloPendientes.style.display = "none";
    tituloAprobados.style.display = "none";
  }
}

function verDetalleProfesional(index) {
  const p = plomeros[index];
  const contenedor = document.getElementById("detalleProfesional");

  if (!p || !contenedor) return;

  contenedor.innerHTML = `
    <div class="detalle-card-admin">

      <div class="detalle-header-admin">
        <img
          src="${p.foto && p.foto !== "sin foto" ? p.foto : "images/avatar-default.png"}"
          class="foto-detalle-admin"
          onerror="this.src='images/avatar-default.png'"
        >

        <div>
          <h2>${p.nombre}</h2>
          <p>⭐ ${Number(p.calificacion || 0).toFixed(1)} calificación</p>
          <p>🏆 Nivel ${p.nivel || 1}</p>
          <p>🛡️ ${p.verificacion || "Pendiente"}</p>
        </div>
      </div>

      <div class="detalle-grid-admin">
        <p><strong>Correo:</strong> ${p.correo || "No registrado"}</p>
        <p><strong>WhatsApp:</strong> ${p.whatsapp || "No registrado"}</p>
        <p><strong>Especialidad:</strong> ${p.especialidad || "No registrada"}</p>
        <p><strong>Zona:</strong> ${p.zona || p.distrito || "No registrada"}</p>
        <p><strong>Estado:</strong> ${p.estado || "Pendiente"}</p>
        <p><strong>Plan:</strong> ${p.plan || "No registrado"}</p>
        <p><strong>Vence:</strong> ${p.fechaVencimiento || "No registrado"}</p>
        <p><strong>Días restantes:</strong> ${calcularDiasRestantes(p.fechaVencimiento)}</p>
        <p><strong>Puntos:</strong> ${p.puntos || 0}</p>
        <p><strong>Trabajos:</strong> ${p.trabajos || 0}</p>
        <p><strong>DNI:</strong> ${p.dni || "No registrado"}</p>
        <p><strong>Empresa:</strong> ${p.empresa || "Independiente"}</p>
        <p><strong>Colegiatura:</strong> ${p.colegiatura || "No aplica"}</p>
      </div>

      <div class="documentos-admin">
        ${p.foto ? `<a href="${p.foto}" target="_blank">📸 Ver foto</a>` : ""}
        ${p.fotoDni ? `<a href="${p.fotoDni}" target="_blank">🪪 Ver DNI</a>` : ""}
        ${p.certificado ? `<a href="${p.certificado}" target="_blank">📄 Ver certificado</a>` : ""}
      </div>

      <div class="acciones-admin">
        <button onclick="aprobarPlomero(${index})">✅ Aprobar</button>
        <button onclick="rechazarPlomero(${index})">❌ Rechazar</button>
        <button onclick="suspenderPlomero(${index})">🚫 Suspender</button>
        <button onclick="cambiarVerificacion(${index}, 'Plan Activo')">🛡️ Activar plan</button>
        <button onclick="cambiarVerificacion(${index}, 'Pendiente')">🟡 Quitar plan</button>
      </div>

    </div>
  `;

  contenedor.scrollIntoView({ behavior: "smooth" });
}

async function cargarDashboardAdmin() {
  const consultaPlomeros = await getDocs(collection(db, "plomeros"));
  const consultaUsuarios = await getDocs(collection(db, "usuarios"));
  const consultaSolicitudes = await getDocs(collection(db, "solicitudes"));

  let totalClientes = 0;
  let trabajosFinalizados = 0;

  consultaUsuarios.forEach((documento) => {
    const usuario = documento.data();

    if (usuario.tipo === "cliente") {
      totalClientes++;
    }
  });

  consultaSolicitudes.forEach((documento) => {
    const solicitud = documento.data();

    if (solicitud.estado === "Finalizado") {
      trabajosFinalizados++;
    }
  });

  document.getElementById("totalProfesionales").textContent = consultaPlomeros.size;
  document.getElementById("totalClientes").textContent = totalClientes;
  document.getElementById("totalSolicitudes").textContent = consultaSolicitudes.size;
  document.getElementById("trabajosFinalizados").textContent = trabajosFinalizados;
}

window.mostrarSolo = mostrarSolo;
window.verPerfilVigna = verPerfilVigna;
window.aprobarPlomero = aprobarPlomero;
window.rechazarPlomero = rechazarPlomero;
window.suspenderPlomero = suspenderPlomero;
window.verDetalleProfesional = verDetalleProfesional;
window.cargarDashboardAdmin = cargarDashboardAdmin;