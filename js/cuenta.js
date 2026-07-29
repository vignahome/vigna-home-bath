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
let pedidosCache = []; // cache de pedidos cargados para abrir detalle sin reconsultar

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

    // Guardar en cache para uso cuando se abra el detalle
    pedidosCache = pedidos;

    lista.innerHTML = pedidos.length ? pedidos.map((pedido) => `
      <article class="cliente-pedido" data-pedido-id="${escapar(pedido.id)}">
        <div class="cliente-pedido-cabecera">
          <h3>${escapar(pedido.pedidoId || pedido.id)}</h3>
          <span class="estado">${escapar(pedido.estado || "pendiente")}</span>
          <strong>S/ ${Number(pedido.total || 0).toFixed(2)}</strong>
        </div>
        <small>${escapar(pedido.fecha ? new Date(pedido.fecha).toLocaleString("es-PE") : (pedido.creadoEnMs ? new Date(Number(pedido.creadoEnMs)).toLocaleString("es-PE") : "Fecha pendiente"))}</small>
        <ul class="cliente-items">${(Array.isArray(pedido.items) ? pedido.items : []).map((item) => `
          <li><span>${escapar(item.nombre || item.title || item.titulo)} × ${Number(item.cantidad || 1)}</span><span>S/ ${Number(item.subtotal || item.precio * (item.cantidad || 1) || 0).toFixed(2)}</span></li>`).join("")}</ul>
        <div style="margin-top:12px;display:flex;gap:10px;justify-content:flex-end">
          <button class="ver-detalle" data-id="${escapar(pedido.id)}">Ver detalle / comprobante</button>
        </div>
      </article>`).join("") : '<p class="cuenta-vacio">Todavía no tienes pedidos. Tu próxima compra aparecerá aquí.</p>';

    // delegado de eventos para botones Ver detalle
    lista.querySelectorAll('.ver-detalle').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const id = btn.dataset.id;
        abrirDetallePedido(id);
      });
    });
  } catch (error) {
    lista.innerHTML = '<p class="cuenta-vacio">No se pudo cargar el historial. Revisa la configuración de acceso.</p>';
    console.error(error);
  }
}

// Funciones para mostrar modal de detalle
function seleccionarValor(obj, keys) {
  for (const k of keys) {
    if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] != null) return obj[k];
  }
  return undefined;
}

function formatoMoneda(valor) {
  const n = Number(valor || 0);
  return `S/ ${n.toFixed(2)}`;
}

function limpiarModal() {
  document.getElementById('pedidoModalCodigo').textContent = '#-';
  document.getElementById('pedidoModalFecha').textContent = '';
  document.getElementById('pedidoModalPagoEstado').textContent = '-';
  document.getElementById('pedidoModalEntregaEstado').textContent = '-';
  document.getElementById('pedidoModalItems').innerHTML = '';
  document.getElementById('pedidoModalTotal').textContent = 'S/ 0.00';
  document.getElementById('pedidoModalNombre').textContent = '-';
  document.getElementById('pedidoModalEmail').textContent = '-';
  document.getElementById('pedidoModalTelefono').textContent = '-';
  document.getElementById('pedidoModalDireccion').textContent = '-';
  document.getElementById('pedidoModalPagoId').textContent = '-';
}

function abrirModal() {
  const modal = document.getElementById('pedidoModal');
  modal.hidden = false; modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  const modal = document.getElementById('pedidoModal');
  modal.hidden = true; modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function abrirDetallePedido(id) {
  const pedido = pedidosCache.find(p => String(p.id) === String(id) || String(p.pedidoId) === String(id));
  if (!pedido) return mostrarMensaje('No se encontró el pedido.');

  limpiarModal();
  // Código y fecha
  document.getElementById('pedidoModalCodigo').textContent = String(pedido.pedidoId || pedido.id || '');
  const fechaVal = seleccionarValor(pedido, ['fecha', 'fechaPedido', 'creadoEn', 'creadoEnMs']);
  let fechaTexto = '';
  if (fechaVal) {
    let d = fechaVal;
    if (typeof d === 'number') d = new Date(Number(d));
    else if (typeof d === 'string' && !isNaN(Number(d))) d = new Date(Number(d));
    else d = new Date(d);
    fechaTexto = isNaN(d.getTime()) ? String(fechaVal) : d.toLocaleString('es-PE');
  }
  document.getElementById('pedidoModalFecha').textContent = fechaTexto || 'Fecha pendiente';

  // Estados de pago y entrega: soportar varios nombres posibles  
  const pagoEstado = seleccionarValor(pedido, ['pagoEstado','estadoPago','paymentStatus','pago','estadoPagoId']) || seleccionarValor(pedido.pago, ['status','estado','payment_status']) || pedido.estadoPago || pedido.paymentStatus;
  const entregaEstado = seleccionarValor(pedido, ['entregaEstado','estadoEntrega','deliveryStatus','estado']) || seleccionarValor(pedido.envio, ['estado','status']) || pedido.estado || 'pendiente';
  document.getElementById('pedidoModalPagoEstado').textContent = String(pagoEstado || (pedido.pagado ? 'pagado' : 'pendiente'));
  document.getElementById('pedidoModalEntregaEstado').textContent = String(entregaEstado || 'pendiente');

  // Items: normalizar nombre, cantidad, precio unitario y subtotal  
  const items = Array.isArray(pedido.items) ? pedido.items : (Array.isArray(pedido.productos) ? pedido.productos : []);
  const tbody = document.getElementById('pedidoModalItems');
  let calcTotal = Number(pedido.total || pedido.totalPagado || pedido.monto || 0);
  if (!calcTotal) calcTotal = 0;
  items.forEach((it) => {
    const nombre = seleccionarValor(it, ['nombre','title','titulo']) || 'Producto';
    const cantidad = Number(seleccionarValor(it, ['cantidad','qty','cantidadUnit']) || 1);
    let precioUnit = seleccionarValor(it, ['precio','precioUnitario','unitPrice','price']) || seleccionarValor(it, ['valor']) || 0;
    precioUnit = Number(precioUnit || 0);
    let subtotal = seleccionarValor(it, ['subtotal','subTotal','importe']) || it.subtotal || (precioUnit * cantidad);
    subtotal = Number(subtotal || precioUnit * cantidad || 0);
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapar(nombre)}</td><td>${cantidad}</td><td>${formatoMoneda(precioUnit)}</td><td>${formatoMoneda(subtotal)}</td>`;
    tbody.appendChild(tr);
  });

  // Total pagado: soportar múltiples nombres
  const totalValor = seleccionarValor(pedido, ['total','totalPagado','monto','amount','paidAmount']) || calcTotal;
  document.getElementById('pedidoModalTotal').textContent = formatoMoneda(totalValor);

  // Datos comprador / entrega: aceptar diferentes caminos
  const comprador = pedido.comprador || pedido.cliente || pedido.customer || {};
  const nombreComprador = seleccionarValor(comprador, ['nombre','name','nombreCompleto']) || seleccionarValor(pedido, ['nombreCliente','clienteNombre']) || '';
  const emailComprador = seleccionarValor(comprador, ['email','correo']) || seleccionarValor(pedido, ['email']) || '';
  const telefonoComprador = seleccionarValor(comprador, ['telefono','celular','phone']) || '';
  const direccionComprador = seleccionarValor(comprador, ['direccion','direccionEntrega','address']) || seleccionarValor(pedido, ['direccion','direccionEntrega']) || '';
  document.getElementById('pedidoModalNombre').textContent = nombreComprador || '-';
  document.getElementById('pedidoModalEmail').textContent = emailComprador || '-';
  document.getElementById('pedidoModalTelefono').textContent = telefonoComprador || '-';
  document.getElementById('pedidoModalDireccion').textContent = direccionComprador || '-';

  // Identificador de pago (Mercado Pago u otros)
  const pagoId = seleccionarValor(pedido, ['pagoId','paymentId','mercadoPagoId','mp_id','mpPaymentId']) || seleccionarValor(pedido.pago || {}, ['id','external_reference','payment_id','paymentId']) || seleccionarValor(pedido, ['idPago','id_pago']);
  document.getElementById('pedidoModalPagoId').textContent = pagoId ? String(pagoId) : '-';

  // Abrir modal
  abrirModal();
}

// Listeners para botones del modal (delegados globales)
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'cerrarPedidoModal') cerrarModal();
  if (e.target && e.target.id === 'imprimirPedido') {
    // Preparar impresión: window.print() y CSS @media print se encarga de mostrar solo el modal
    window.print();
  }
  // cerrar si hace click en overlay
  if (e.target && e.target.classList && e.target.classList.contains('pedido-modal-overlay')) cerrarModal();
});

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
