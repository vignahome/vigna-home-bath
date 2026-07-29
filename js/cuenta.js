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

function obtenerEstadoPedido(pedido) {
  const estado = seleccionarValor(pedido, ['estado', 'estadoPedido', 'pedidoEstado']) || pedido.estado || '';
  return String(estado || '').toLowerCase();
}

function renderSeguimientoPedido(pedido) {
  const estadoPedido = obtenerEstadoPedido(pedido);
  const completadoPago = ['pagado', 'preparando', 'enviado', 'entregado'].includes(estadoPedido) || pedido.pagado === true;
  const completadoPreparando = ['preparando', 'enviado', 'entregado'].includes(estadoPedido);
  const completadoEnviado = ['enviado', 'entregado'].includes(estadoPedido);
  const completadoEntregado = estadoPedido === 'entregado';
  const pasos = [
    { label: 'Pago confirmado', completo: completadoPago },
    { label: 'Preparando pedido', completo: completadoPreparando },
    { label: 'Pedido enviado', completo: completadoEnviado },
    { label: 'Pedido entregado', completo: completadoEntregado }
  ];
  const container = document.getElementById('pedidoModalTracking');
  if (!container) return;
  container.innerHTML = pasos.map((paso) => `
    <div class="seguimiento-paso${paso.completo ? ' completado' : ''}">
      <span class="paso-nombre">${escapar(paso.label)}</span>
      <span class="paso-estado">${paso.completo ? 'Completado' : 'Pendiente'}</span>
    </div>
  `).join('');
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
  document.getElementById('pedidoModalTracking').innerHTML = '';
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
  renderSeguimientoPedido(pedido);

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

function crearHtmlComprobanteHTML(contenidoHtml) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Comprobante de pedido</title>
<style>
  @page { size: A4 portrait; margin: 16mm; }
  html, body { margin: 0; padding: 0; font-family: 'Montserrat', sans-serif; color: #000; background: #fff; }
  body { min-height: 100vh; }
  .pedido-modal-contenido { width: 100%; max-width: 100%; padding: 16px; box-sizing: border-box; border: none; box-shadow: none; background: #fff; color: #000; }
  .pedido-modal-cabecera { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .pedido-modal-cabecera .oro, .pedido-modal-cabecera h2, .pedido-modal-cabecera small { color: #000; }
  .pedido-modal-tracking { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
  .seguimiento-paso { padding: 10px; border: 1px solid #bbb; border-radius: 10px; background: #f9f9f9; color: #000; display: flex; flex-direction: column; gap: 6px; }
  .seguimiento-paso.completado { border-color: #b68913; background: #fff6dc; }
  .seguimiento-paso .paso-estado { color: #555; font-size: 0.9rem; }
  .pedido-estados { display: flex; flex-wrap: wrap; gap: 18px; color: #000; margin-bottom: 14px; }
  .pedido-items-wrapper { overflow: visible; }
  .pedido-items { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10pt; }
  .pedido-items th, .pedido-items td { padding: 8px; border: 1px solid #ccc; word-break: break-word; }
  .pedido-items th { background: #f0f0f0; color: #000; text-align: left; }
  .pedido-items td:nth-child(1) { width: 45%; }
  .pedido-items td:nth-child(2), .pedido-items td:nth-child(3), .pedido-items td:nth-child(4) { width: 18%; text-align: right; }
  .pedido-total { margin-top: 10px; text-align: right; font-weight: 700; font-size: 11pt; }
  .pedido-entrega { margin-top: 16px; padding: 10px; border: 1px solid #ccc; border-radius: 10px; background: #f9f9f9; }
  .pedido-entrega h3 { margin: 0 0 8px; }
  .pedido-entrega div { margin-bottom: 6px; }
  .pedido-modal-acciones { display: none !important; }
  .pedido-modal-overlay { display: none !important; }
  @media print {
    body { margin: 0; }
    .pedido-modal-tracking { grid-template-columns: 1fr; }
    .pedido-modal-contenido { page-break-inside: avoid; }
    .pedido-items tr { page-break-inside: avoid; }
  }
  @media (max-width: 840px) {
    .pedido-modal-tracking { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>${contenidoHtml}</body>
</html>`;
}

function imprimirComprobante() {
  const contenidoModal = document.querySelector('.pedido-modal-contenido');
  if (!contenidoModal) return;
  const clon = contenidoModal.cloneNode(true);
  const acciones = clon.querySelector('.pedido-modal-acciones');
  if (acciones) acciones.remove();

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) {
    mostrarMensaje('No se pudo abrir la ventana de impresión. Revisa el bloqueador de ventanas.');
    return;
  }

  const html = crearHtmlComprobanteHTML(clon.outerHTML);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = () => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  };
}

// Listeners para botones del modal (delegados globales)
document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'cerrarPedidoModal') cerrarModal();
  if (e.target && e.target.id === 'imprimirPedido') {
    e.preventDefault();
    imprimirComprobante();
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
