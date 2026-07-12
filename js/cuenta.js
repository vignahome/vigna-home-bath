import {
  db,
  auth,
  collection,
  getDocs,
  getDoc,
  setDoc,
  doc,
  query,
  where,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "../firebase.js";

let usuarioActual = null;

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function mostrarEstado(texto) {
  document.getElementById("cuentaEstado").textContent = texto;
}

function mostrarMensaje(texto) {
  const mensaje = document.getElementById("cuentaMensaje");
  mensaje.textContent = texto;
  mensaje.hidden = false;
  clearTimeout(mostrarMensaje.temporizador);
  mostrarMensaje.temporizador = setTimeout(() => { mensaje.hidden = true; }, 3200);
}

async function obtenerPerfil(user) {
  const perfil = await getDoc(doc(db, "clientes", user.uid));
  return perfil.exists() ? perfil.data() : { nombre: user.displayName || "Cliente VIGNA", email: user.email, telefono: "" };
}

async function cargarPedidos(user) {
  const lista = document.getElementById("clienteListaPedidos");

  try {
    const consulta = query(collection(db, "pedidos"), where("comprador.email", "==", String(user.email || "").toLowerCase()));
    const snapshot = await getDocs(consulta);
    const pedidos = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }))
      .sort((a, b) => Number(b.creadoEnMs || 0) - Number(a.creadoEnMs || 0));

    const completados = pedidos.filter((pedido) => ["pagado", "preparando", "enviado", "entregado"].includes(pedido.estado));
    const enCamino = pedidos.filter((pedido) => ["preparando", "enviado"].includes(pedido.estado));
    const total = completados.reduce((suma, pedido) => suma + Number(pedido.total || 0), 0);

    document.getElementById("clientePedidos").textContent = String(pedidos.length);
    document.getElementById("clienteEnCamino").textContent = String(enCamino.length);
    document.getElementById("clienteCompras").textContent = `S/ ${total.toFixed(2)}`;

    lista.innerHTML = pedidos.length ? pedidos.map((pedido) => `
      <article class="cliente-pedido">
        <div class="cliente-pedido-cabecera">
          <h3>${escapar(pedido.pedidoId || pedido.id)}</h3>
          <span class="estado">${escapar(pedido.estado || "pendiente")}</span>
          <strong>S/ ${Number(pedido.total || 0).toFixed(2)}</strong>
        </div>
        <small>${escapar(pedido.fecha ? new Date(pedido.fecha).toLocaleString("es-PE") : "Fecha pendiente")}</small>
        <ul class="cliente-items">${(Array.isArray(pedido.items) ? pedido.items : []).map((item) => `
          <li><span>${escapar(item.nombre)} × ${Number(item.cantidad || 1)}</span><span>S/ ${Number(item.subtotal || 0).toFixed(2)}</span></li>`).join("")}</ul>
      </article>`).join("") : '<p class="cuenta-vacio">Todavía no tienes pedidos. Tu próxima compra aparecerá aquí.</p>';
  } catch (error) {
    lista.innerHTML = '<p class="cuenta-vacio">No se pudo cargar el historial. Revisa la configuración de acceso.</p>';
    console.error(error);
  }
}

async function abrirPanel(user) {
  usuarioActual = user;
  const perfil = await obtenerPerfil(user);
  localStorage.setItem("vignaCliente", JSON.stringify({ nombre: perfil.nombre || "", email: user.email || "", telefono: perfil.telefono || "" }));
  document.getElementById("cuentaAcceso").hidden = true;
  document.getElementById("cuentaPanel").hidden = false;
  document.getElementById("clienteNombre").textContent = perfil.nombre || "Cliente VIGNA";
  document.getElementById("clienteEmail").textContent = user.email || "";
  await cargarPedidos(user);
}

document.getElementById("formLogin")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarEstado("");
  try {
    await signInWithEmailAndPassword(auth, document.getElementById("loginEmail").value.trim(), document.getElementById("loginPassword").value);
  } catch (_error) {
    mostrarEstado("Correo o contraseña incorrectos.");
  }
});

document.getElementById("formRegistro")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarEstado("");
  const nombre = document.getElementById("registroNombre").value.trim();
  const email = document.getElementById("registroEmail").value.trim().toLowerCase();
  const telefono = document.getElementById("registroTelefono").value.replace(/[^0-9+]/g, "");

  try {
    const credencial = await createUserWithEmailAndPassword(auth, email, document.getElementById("registroPassword").value);
    await setDoc(doc(db, "clientes", credencial.user.uid), {
      uid: credencial.user.uid,
      nombre,
      email,
      telefono,
      creadoEnMs: Date.now()
    });
    mostrarMensaje("Cuenta creada correctamente.");
    await abrirPanel(credencial.user);
  } catch (error) {
    mostrarEstado(error.code === "auth/email-already-in-use" ? "Ese correo ya tiene una cuenta." : "No se pudo crear la cuenta.");
  }
});

document.getElementById("cerrarCuenta")?.addEventListener("click", async () => {
  await signOut(auth);
  localStorage.removeItem("vignaCliente");
  window.location.reload();
});

onAuthStateChanged(auth, async (user) => {
  if (user) await abrirPanel(user);
  else {
    usuarioActual = null;
    document.getElementById("cuentaAcceso").hidden = false;
    document.getElementById("cuentaPanel").hidden = true;
  }
});
