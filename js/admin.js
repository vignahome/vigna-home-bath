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

function escapar(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
  await Promise.all([cargarPedidos(), cargarInventario(), cargarCatalogoLocal()]);
  actualizarMetricas();
  renderizarPedidos();
  renderizarInventario();
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
        <tr>
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
