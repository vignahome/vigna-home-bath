import {
  db,
  auth,
  collection,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  doc,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "../firebase.js";

const FUENTES_CATALOGO = [
  ["Grifería de cocina", "data/griferias.csv"],
  ["Grifería de baños", "data/grifos.csv"],
  ["Espejos LED", "data/espejos.csv"],
  ["Muebles de baño", "data/muebles.csv"],
  ["Duchas", "data/duchas.csv"],
  ["Combos", "data/combos.csv"],
  ["Accesorios", "data/accesorios.csv"]
];

let pedidos = [];
let inventario = [];
let catalogoLocal = [];
let movimientosInventario = [];

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obtenerEstadoPedido(pedido) {
  const estado = pedido.estado || pedido.estadoPedido || pedido.pedidoEstado || pedido.estadoPago || "";
  return String(estado || "").toLowerCase();
}

function traducirEstadoPago(estado) {
  const clave = String(estado || "").toLowerCase();
  const traducciones = {
    pendiente: "Pendiente",
    pagado: "Pagado",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
    cancelado: "Cancelado",
    preparando: "En preparación",
    enviado: "Enviado",
    entregado: "Entregado"
  };
  return traducciones[clave] || estado || "Pendiente";
}

function obtenerDireccionCompleta(pedido) {
  const comprador = pedido.comprador || pedido.cliente || pedido.customer || {};
  const partes = [
    comprador.direccion || comprador.direccionEntrega || comprador.address || pedido.direccion || pedido.direccionEntrega || "",
    comprador.distrito || comprador.district || comprador.city || "",
    comprador.provincia || comprador.state || "",
    comprador.departamento || comprador.region || comprador.region || "",
    comprador.pais || comprador.country || ""
  ].map((parte) => String(parte || "").trim()).filter(Boolean);
  return partes.join(", ") || "-";
}

function obtenerTelefonoPedido(pedido) {
  const comprador = pedido.comprador || pedido.cliente || pedido.customer || {};
  return String(comprador.telefono || comprador.celular || comprador.phone || pedido.telefono || pedido.celular || "").trim();
}

function obtenerEmailPedido(pedido) {
  const comprador = pedido.comprador || pedido.cliente || pedido.customer || {};
  return String(comprador.email || comprador.correo || pedido.email || "").trim();
}

function obtenerNombrePedido(pedido) {
  const comprador = pedido.comprador || pedido.cliente || pedido.customer || {};
  return String(comprador.nombre || comprador.name || comprador.nombreCompleto || pedido.nombreCliente || pedido.clienteNombre || "Cliente VIGNA").trim();
}

function obtenerMpId(pedido) {
  return String(pedido.pagoId || pedido.paymentId || pedido.mp_id || pedido.mpPaymentId || pedido.payment_id || pedido.pago?.id || pedido.idPago || "").trim();
}

function obtenerProductosPedido(pedido) {
  return Array.isArray(pedido.items) ? pedido.items : Array.isArray(pedido.productos) ? pedido.productos : [];
}

function mostrarModalPedido(pedido) {
  const modal = document.getElementById("pedidoModal");
  document.getElementById("pedidoModalCodigo").textContent = `#${escapar(pedido.pedidoId || pedido.id || "")}`;

  const fecha = pedido.creadoEnMs ? new Date(Number(pedido.creadoEnMs)) : new Date(pedido.fecha || pedido.creadoEn || "");
  document.getElementById("pedidoModalFecha").textContent = isNaN(fecha.getTime()) ? "Fecha pendiente" : fecha.toLocaleString("es-PE");

  document.getElementById("pedidoModalNombre").textContent = escapar(obtenerNombrePedido(pedido));
  document.getElementById("pedidoModalEmail").textContent = escapar(obtenerEmailPedido(pedido));
  document.getElementById("pedidoModalTelefono").textContent = escapar(obtenerTelefonoPedido(pedido));
  document.getElementById("pedidoModalDireccion").textContent = escapar(obtenerDireccionCompleta(pedido));
  document.getElementById("pedidoModalMPId").textContent = escapar(obtenerMpId(pedido)) || "-";

  const pagoEstado = pedido.estadoPago || pedido.pago?.estado || pedido.pago?.status || pedido.paymentStatus || pedido.estado || "pendiente";
  document.getElementById("pedidoModalPagoEstado").textContent = escapar(traducirEstadoPago(pagoEstado));

  const tbody = document.getElementById("pedidoModalItems");
  tbody.innerHTML = "";
  let total = Number(pedido.total || pedido.totalPagado || pedido.monto || pedido.amount || 0);
  obtenerProductosPedido(pedido).forEach((item) => {
    const nombre = escapar(item.nombre || item.title || item.titulo || item.sku || "Producto");
    const cantidad = Number(item.cantidad || item.qty || item.cantidadUnit || 1);
    const precioUnit = Number(item.precio || item.precioUnitario || item.unitPrice || item.price || item.valor || 0);
    const subtotal = Number(item.subtotal || item.subTotal || item.importe || precioUnit * cantidad || 0);
    const fila = document.createElement("tr");
    fila.innerHTML = `<td>${nombre}</td><td>${cantidad}</td><td>S/ ${precioUnit.toFixed(2)}</td><td>S/ ${subtotal.toFixed(2)}</td>`;
    tbody.appendChild(fila);
    if (!total) total += subtotal;
  });

  document.getElementById("pedidoModalTotal").textContent = `S/ ${Number(total).toFixed(2)}`;

  const container = document.getElementById("pedidoModalTracking");
  const estado = obtenerEstadoPedido(pedido);
  const pasoPago = ["pagado", "preparando", "enviado", "entregado"].includes(estado) || pedido.pagado === true;
  const pasoPreparando = ["preparando", "enviado", "entregado"].includes(estado);
  const pasoEnviado = ["enviado", "entregado"].includes(estado);
  const pasoEntregado = estado === "entregado";
  container.innerHTML = [
    { label: "Pago confirmado", completo: pasoPago },
    { label: "Preparando pedido", completo: pasoPreparando },
    { label: "Pedido enviado", completo: pasoEnviado },
    { label: "Pedido entregado", completo: pasoEntregado }
  ].map((paso) => `
    <div class="seguimiento-paso${paso.completo ? " completado" : ""}">
      <span class="paso-nombre">${escapar(paso.label)}</span>
      <span class="paso-estado">${paso.completo ? "Completado" : "Pendiente"}</span>
    </div>`).join("");

  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  modal.dataset.pedidoId = pedido.id || pedido.pedidoId || "";
}

function cerrarModalPedido() {
  const modal = document.getElementById("pedidoModal");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function generarWhatsappLink(pedido) {
  const telefono = obtenerTelefonoPedido(pedido).replace(/[^0-9+]/g, "");
  if (!telefono) return "";
  const texto = encodeURIComponent(`Hola ${obtenerNombrePedido(pedido)}, te escribo desde VIGNA para hablar sobre tu pedido ${pedido.pedidoId || pedido.id || ""}.`);
  return `https://wa.me/${telefono.replace(/^\+/, "")}??text=${texto}`.replace("??", "?");
}

function abrirWhatsappPedido() {
  const modal = document.getElementById("pedidoModal");
  const pedidoId = modal.dataset.pedidoId;
  const pedido = pedidos.find((item) => String(item.id) === String(pedidoId) || String(item.pedidoId) === String(pedidoId));
  if (!pedido) return mostrarMensaje("No se encontró el pedido para WhatsApp.");
  const link = generarWhatsappLink(pedido);
  if (!link) return mostrarMensaje("Teléfono del cliente no disponible.");
  window.open(link, "_blank");
}

function crearHtmlPedidoImpresion(contenido) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Pedido ${escapar(contenido.pedidoId || "")}</title>
<style>
  body{margin:0;padding:16px;font-family:'Montserrat',sans-serif;color:#000;background:#fff;}
  .pedido-modal-contenido{max-width:100%;border:none;box-shadow:none;color:#000;}
  .pedido-modal-cabecera{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;}
  .pedido-modal-cabecera .oro{color:#000;font-size:0.92rem;}
  .pedido-modal-cabecera h2{margin:4px 0 0;font-size:1.25rem;font-weight:700;}
  .pedido-modal-cabecera small{color:#333;}
  .pedido-modal-tracking{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:16px 0;}
  .seguimiento-paso{padding:10px;border:1px solid #bbb;border-radius:10px;background:#f7f7f7;}
  .seguimiento-paso.completado{border-color:#b68913;background:#fff3d7;}
  .seguimiento-paso .paso-nombre{font-weight:700;}
  .pedido-estados{display:flex;flex-wrap:wrap;gap:18px;margin-bottom:14px;color:#000;}
  .pedido-items{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt;}
  .pedido-items th,.pedido-items td{padding:8px;border:1px solid #ccc;word-break:break-word;}
  .pedido-items th{background:#f0f0f0;text-align:left;}
  .pedido-items td:nth-child(2),.pedido-items td:nth-child(3),.pedido-items td:nth-child(4){text-align:right;}
  .pedido-total{margin-top:10px;text-align:right;font-weight:700;}
  .pedido-entrega{margin-top:16px;padding:10px;border:1px solid #ccc;border-radius:10px;background:#f7f7f7;}
  .pedido-entrega h3{margin-top:0;}
  @page{size:A4 portrait;margin:16mm;}
</style>
</head>
<body>${contenido}</body>
</html>`;
}

function imprimirPedidoModal() {
  const contenido = document.querySelector("#pedidoModal .pedido-modal-contenido");
  if (!contenido) return;
  const clon = contenido.cloneNode(true);
  clon.querySelector('.pedido-modal-acciones')?.remove();
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return mostrarMensaje('No se pudo abrir la ventana de impresión.');
  printWindow.document.write(crearHtmlPedidoImpresion(clon.outerHTML));
  printWindow.document.close();
  printWindow.focus();
  printWindow.onload = () => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  };
}

function mostrarMensaje(texto, error = false) {
  const mensaje = document.getElementById("adminMensaje");
  mensaje.textContent = texto;
  mensaje.className = `admin-mensaje${error ? " error" : ""}`;
  mensaje.hidden = false;
  clearTimeout(mostrarMensaje.temporizador);
  mostrarMensaje.temporizador = setTimeout(() => { mensaje.hidden = true; }, 3500);
}

async function comprobarAdministrador(user) {
  if (!user) return false;
  const admin = await getDoc(doc(db, "admins", user.uid));
  return admin.exists();
}

function abrirAplicacion(user) {
  document.getElementById("adminAcceso").hidden = true;
  document.getElementById("adminApp").hidden = false;
  document.getElementById("adminUsuario").textContent = user.email || "Administrador";
  cargarPanel();
}

async function cargarPanel() {
  await Promise.all([cargarPedidos(), cargarInventario(), cargarCatalogoLocal(), cargarMovimientosInventario()]);
  actualizarMetricas();
  renderizarPedidos();
  renderizarInventario();
  renderizarMovimientosInventario();
}

async function cargarMovimientosInventario() {
  try {
    const respuesta = await fetch("/movimientos-inventario");
    const datos = await respuesta.json();
    movimientosInventario = Array.isArray(datos.movimientos) ? datos.movimientos : [];
  } catch (error) {
    movimientosInventario = [];
    console.error("No se pudieron cargar los movimientos de inventario.", error);
  }
}

function renderizarMovimientosInventario() {
  const contenedor = document.getElementById("tablaMovimientosInventario");
  if (!contenedor) return;
  if (!movimientosInventario.length) {
    contenedor.innerHTML = '<p class="admin-vacio">No hay movimientos registrados.</p>';
    return;
  }

  contenedor.innerHTML = `
    <table class="admin-tabla">
      <thead>
        <tr><th>Fecha</th><th>Tipo</th><th>Producto</th><th>SKU</th><th>Cantidad</th><th>Stock anterior</th><th>Stock nuevo</th><th>Pedido</th></tr>
      </thead>
      <tbody>${movimientosInventario.map((movimiento) => {
        const fecha = new Date(Number(movimiento.creadoEnMs || movimiento.fecha || 0));
        return `
          <tr>
            <td>${escapar(isNaN(fecha.getTime()) ? "—" : fecha.toLocaleString("es-PE"))}</td>
            <td>${escapar(movimiento.tipo || "—")}</td>
            <td>${escapar(movimiento.producto || "—")}</td>
            <td>${escapar(movimiento.sku || "—")}</td>
            <td>${Number(movimiento.cantidad || 0)}</td>
            <td>${Number(movimiento.stockAnterior || 0)}</td>
            <td>${Number(movimiento.stockNuevo || 0)}</td>
            <td>${escapar(movimiento.pedidoId || "—")}</td>
          </tr>`;
      }).join("")}</tbody>
    </table>`;
}

async function cargarPedidos() {
  try {
    const snapshot = await getDocs(collection(db, "pedidos"));
    pedidos = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
    pedidos.sort((a, b) => Number(b.creadoEnMs || 0) - Number(a.creadoEnMs || 0));
  } catch (error) {
    pedidos = [];
    mostrarMensaje("No se pudieron cargar los pedidos. Revisa las reglas de Firebase.", true);
    console.error(error);
  }
}

async function cargarInventario() {
  try {
    const snapshot = await getDocs(collection(db, "inventario"));
    inventario = snapshot.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
  } catch (error) {
    inventario = [];
    mostrarMensaje("No se pudo cargar el inventario.", true);
    console.error(error);
  }
}

async function cargarCatalogoLocal() {
  if (catalogoLocal.length) return catalogoLocal;
  const productos = [];

  for (const [categoria, archivo] of FUENTES_CATALOGO) {
    const respuesta = await fetch(archivo);
    if (!respuesta.ok) continue;
    const texto = (await respuesta.text()).replace(/^\uFEFF/, "");
    texto.trim().split(/\r?\n/).slice(1).forEach((fila) => {
      const datos = fila.split(";");
      const id = datos[0]?.trim();
      const nombre = datos[1]?.trim();
      const precio = Number(datos[2]?.trim());
      if (!id || !nombre || !Number.isFinite(precio)) return;
      const clave = archivo.split("/").pop().replace(".csv", "");
      productos.push({ sku: `${clave}:${id}`, id, archivo, categoria, nombre, precio });
    });
  }

  catalogoLocal = productos;
  return productos;
}

function actualizarMetricas() {
  const aprobados = pedidos.filter((pedido) => ["pagado", "preparando", "enviado", "entregado"].includes(pedido.estado));
  const ventas = aprobados.reduce((total, pedido) => total + Number(pedido.total || 0), 0);
  const stockBajo = inventario.filter((item) => Number(item.stock || 0) <= Number(item.stockMinimo ?? 2)).length;

  document.getElementById("metricaVentas").textContent = `S/ ${ventas.toFixed(2)}`;
  document.getElementById("metricaPedidos").textContent = String(pedidos.length);
  document.getElementById("metricaTicket").textContent = `S/ ${(aprobados.length ? ventas / aprobados.length : 0).toFixed(2)}`;
  document.getElementById("metricaStockBajo").textContent = String(stockBajo);
  renderizarEstadisticas(aprobados);
}

function renderizarEstadisticas(aprobados) {
  const grafico = document.getElementById("graficoVentas");
  const top = document.getElementById("productosMasVendidos");
  const meses = [];
  const ahora = new Date();

  for (let offset = 5; offset >= 0; offset--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - offset, 1);
    meses.push({
      clave: `${fecha.getFullYear()}-${fecha.getMonth()}`,
      etiqueta: fecha.toLocaleDateString("es-PE", { month: "short" }),
      total: 0
    });
  }

  aprobados.forEach((pedido) => {
    const fecha = pedido.creadoEnMs ? new Date(Number(pedido.creadoEnMs)) : new Date(pedido.fecha || 0);
    const mes = meses.find((item) => item.clave === `${fecha.getFullYear()}-${fecha.getMonth()}`);
    if (mes) mes.total += Number(pedido.total || 0);
  });

  const maximo = Math.max(1, ...meses.map((mes) => mes.total));
  grafico.innerHTML = meses.map((mes) => `
    <div class="grafico-columna">
      <strong>S/ ${mes.total.toFixed(0)}</strong>
      <i class="grafico-barra" style="height:${Math.max(3, (mes.total / maximo) * 170)}px"></i>
      <span>${escapar(mes.etiqueta)}</span>
    </div>`).join("");

  const cantidades = new Map();

  aprobados.forEach((pedido) => {
    (Array.isArray(pedido.items) ? pedido.items : []).forEach((item) => {
      const clave = item.sku || item.nombre || "Producto";
      const actual = cantidades.get(clave) || { nombre: item.nombre || clave, cantidad: 0 };
      actual.cantidad += Number(item.cantidad || 0);
      cantidades.set(clave, actual);
    });
  });

  const productos = Array.from(cantidades.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  const mayor = Math.max(1, ...productos.map((item) => item.cantidad));

  top.innerHTML = productos.length ? productos.map((item) => `
    <div class="producto-top">
      <strong>${escapar(item.nombre)}</strong><span>${item.cantidad} un.</span>
      <div class="producto-top-barra"><i style="width:${(item.cantidad / mayor) * 100}%"></i></div>
    </div>`).join("") : '<p class="admin-vacio">Las ventas aprobadas aparecerán aquí.</p>';
}

function tablaPedidos(lista) {
  if (!lista.length) return '<p class="admin-vacio">Todavía no existen pedidos registrados.</p>';

  return `
    <table class="admin-tabla">
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Fecha</th></tr></thead>
      <tbody>${lista.map((pedido) => `
        <tr data-abrir-pedido="${escapar(pedido.id)}" class="pedido-fila" title="Ver detalle del pedido">
          <td><strong>${escapar(pedido.pedidoId || pedido.id)}</strong></td>
          <td>${escapar(pedido.comprador?.nombre || pedido.compradorNombre || "Cliente")}</td>
          <td>S/ ${Number(pedido.total || 0).toFixed(2)}</td>
          <td><span class="estado-chip">${escapar(pedido.estadoPago || "pendiente")}</span></td>
          <td>
            <select class="cambiar-estado-pedido" data-id="${escapar(pedido.id)}">
              ${["pendiente","pagado","preparando","enviado","entregado","cancelado"].map((estado) => `<option value="${estado}" ${pedido.estado === estado ? "selected" : ""}>${estado}</option>`).join("")}
            </select>
          </td>
          <td>${escapar(pedido.fecha || "—")}</td>
        </tr>`).join("")}
      </tbody>
    </table>`;
}

function renderizarPedidos() {
  const filtro = document.getElementById("filtroEstadoPedido")?.value || "";
  const filtrados = filtro ? pedidos.filter((pedido) => pedido.estado === filtro) : pedidos;
  document.getElementById("tablaPedidos").innerHTML = tablaPedidos(filtrados);
  document.getElementById("pedidosRecientes").innerHTML = tablaPedidos(pedidos.slice(0, 5));
}

function renderizarInventario() {
  const texto = (document.getElementById("buscarInventario")?.value || "").toLowerCase().trim();
  const mapa = new Map(inventario.map((item) => [item.sku || item.id, item]));
  const productos = catalogoLocal.filter((producto) => `${producto.nombre} ${producto.sku} ${producto.categoria}`.toLowerCase().includes(texto));

  if (!productos.length) {
    document.getElementById("tablaInventario").innerHTML = '<p class="admin-vacio">No se encontraron productos.</p>';
    renderizarMovimientosInventario();
    return;
  }

  document.getElementById("tablaInventario").innerHTML = `
    <table class="admin-tabla">
      <thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Mínimo</th><th>Acción</th></tr></thead>
      <tbody>${productos.map((producto) => {
        const item = mapa.get(producto.sku) || {};
        const stock = Number(item.stock || 0);
        const minimo = Number(item.stockMinimo ?? 2);
        return `<tr>
          <td>${escapar(producto.sku)}</td>
          <td><strong>${escapar(producto.nombre)}</strong></td>
          <td>${escapar(producto.categoria)}</td>
          <td>S/ ${producto.precio.toFixed(2)}</td>
          <td><input class="stock-valor ${stock <= minimo ? "stock-bajo" : ""}" data-sku="${escapar(producto.sku)}" type="number" min="0" max="9999" value="${stock}"></td>
          <td><input class="stock-minimo" data-sku="${escapar(producto.sku)}" type="number" min="0" max="999" value="${minimo}"></td>
          <td><button class="guardar-stock" data-sku="${escapar(producto.sku)}">Guardar</button></td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
}

async function sincronizarCatalogo() {
  const boton = document.getElementById("sincronizarCatalogo");
  boton.disabled = true;
  boton.textContent = "Sincronizando…";
  const existentes = new Map(inventario.map((item) => [item.sku || item.id, item]));

  try {
    await Promise.all(catalogoLocal.map((producto) => {
      const actual = existentes.get(producto.sku) || {};
      return setDoc(doc(db, "inventario", producto.sku), {
        ...producto,
        stock: Number(actual.stock || 0),
        stockMinimo: Number(actual.stockMinimo ?? 2),
        activo: actual.activo !== false,
        actualizadoEnMs: Date.now()
      }, { merge: true });
    }));
    await cargarInventario();
    actualizarMetricas();
    renderizarInventario();
    mostrarMensaje(`${catalogoLocal.length} productos sincronizados.`);
  } catch (error) {
    mostrarMensaje("No se pudo sincronizar el catálogo.", true);
    console.error(error);
  } finally {
    boton.disabled = false;
    boton.textContent = "Sincronizar catálogo";
  }
}

async function guardarStock(sku) {
  const producto = catalogoLocal.find((item) => item.sku === sku);
  const stock = Number(document.querySelector(`.stock-valor[data-sku="${CSS.escape(sku)}"]`)?.value);
  const stockMinimo = Number(document.querySelector(`.stock-minimo[data-sku="${CSS.escape(sku)}"]`)?.value);
  if (!producto || !Number.isInteger(stock) || stock < 0 || !Number.isInteger(stockMinimo) || stockMinimo < 0) {
    mostrarMensaje("Revisa las cantidades de inventario.", true);
    return;
  }

  await setDoc(doc(db, "inventario", sku), { ...producto, stock, stockMinimo, activo: true, actualizadoEnMs: Date.now() }, { merge: true });
  await cargarInventario();
  actualizarMetricas();
  renderizarInventario();
  renderizarMovimientosInventario();
  mostrarMensaje(`Inventario de ${producto.nombre} actualizado.`);
}

function mostrarSeccion(nombre) {
  document.querySelectorAll(".admin-seccion").forEach((seccion) => seccion.classList.toggle("activo", seccion.id === `seccion-${nombre}`));
  document.querySelectorAll(".admin-nav").forEach((boton) => boton.classList.toggle("activo", boton.dataset.seccion === nombre));
  document.getElementById("adminTitulo").textContent = ({ resumen:"Resumen", pedidos:"Pedidos", inventario:"Inventario" })[nombre] || "Administración";
}

document.addEventListener("click", async (evento) => {
  const nav = evento.target.closest("[data-seccion]");
  if (nav) mostrarSeccion(nav.dataset.seccion);
  const ir = evento.target.closest("[data-ir]");
  if (ir) mostrarSeccion(ir.dataset.ir);
  const guardar = evento.target.closest(".guardar-stock");
  if (guardar) await guardarStock(guardar.dataset.sku);

  if (evento.target.id === "cerrarPedidoModal") return cerrarModalPedido();
  if (evento.target.id === "imprimirPedidoModal") return imprimirPedidoModal();
  if (evento.target.id === "whatsappPedidoModal") return abrirWhatsappPedido();

  if (evento.target.closest(".cambiar-estado-pedido")) return;
  const fila = evento.target.closest("tr[data-abrir-pedido]");
  if (fila) {
    const pedidoId = fila.dataset.abrirPedido;
    const pedido = pedidos.find((item) => String(item.id) === pedidoId || String(item.pedidoId) === pedidoId);
    if (pedido) mostrarModalPedido(pedido);
  }
});

document.addEventListener("change", async (evento) => {
  if (evento.target.id === "filtroEstadoPedido") renderizarPedidos();
  if (evento.target.classList.contains("cambiar-estado-pedido")) {
    await updateDoc(doc(db, "pedidos", evento.target.dataset.id), { estado: evento.target.value, actualizadoEnMs: Date.now() });
    await cargarPedidos();
    actualizarMetricas();
    renderizarPedidos();
    mostrarMensaje("Estado del pedido actualizado.");
  }
});

document.getElementById("buscarInventario")?.addEventListener("input", renderizarInventario);
document.getElementById("sincronizarCatalogo")?.addEventListener("click", sincronizarCatalogo);
document.getElementById("adminSalir")?.addEventListener("click", () => signOut(auth));

document.getElementById("adminLogin")?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const estado = document.getElementById("adminLoginEstado");
  const boton = document.getElementById("adminIngresar");
  estado.textContent = "";
  boton.disabled = true;

  try {
    const credencial = await signInWithEmailAndPassword(auth, document.getElementById("adminEmail").value.trim(), document.getElementById("adminPassword").value);
    if (!(await comprobarAdministrador(credencial.user))) {
      await signOut(auth);
      throw new Error("Esta cuenta no tiene permisos administrativos.");
    }
    abrirAplicacion(credencial.user);
  } catch (error) {
    estado.textContent = error.message || "No se pudo iniciar sesión.";
  } finally {
    boton.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (user && await comprobarAdministrador(user)) {
    abrirAplicacion(user);
  } else {
    document.getElementById("adminAcceso").hidden = false;
    document.getElementById("adminApp").hidden = true;
  }
});
