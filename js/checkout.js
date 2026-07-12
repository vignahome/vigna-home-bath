function obtenerCarrito() {
  try {
    const carrito = JSON.parse(localStorage.getItem("carritoVigna"));
    return Array.isArray(carrito) ? carrito : [];
  } catch (_error) {
    return [];
  }
}

function obtenerApiPagosUrl() {
  const configurada = String(window.VIGNA_CONFIG?.apiPagosUrl || "").trim();
  if (configurada) return configurada.replace(/\/$/, "");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://localhost:3000";
  return "";
}

function mostrarEstado(mensaje, tipo = "") {
  const estado = document.getElementById("estadoPago");
  if (!estado) return;
  estado.textContent = mensaje;
  estado.className = `checkout-estado ${tipo}`.trim();
  estado.hidden = false;
  estado.scrollIntoView({ behavior: "smooth", block: "center" });
}

function renderizarResumen() {
  const carrito = obtenerCarrito();
  const contenedor = document.getElementById("checkoutProductos");
  const totalElemento = document.getElementById("checkoutTotal");
  const botonPagar = document.getElementById("botonPagar");

  if (!contenedor || !totalElemento) return;
  contenedor.replaceChildren();

  let total = 0;

  carrito.forEach((item) => {
    const precio = Number(item.precio) || 0;
    const cantidad = Math.max(1, Number(item.cantidad) || 1);
    const subtotal = precio * cantidad;
    total += subtotal;

    const fila = document.createElement("div");
    fila.className = "checkout-producto";

    const nombre = document.createElement("strong");
    nombre.textContent = item.nombre || "Producto VIGNA";
    const detalle = document.createElement("small");
    detalle.textContent = `${cantidad} × S/ ${precio.toFixed(2)}`;
    const subtotalElemento = document.createElement("span");
    subtotalElemento.className = "checkout-subtotal";
    subtotalElemento.textContent = `S/ ${subtotal.toFixed(2)}`;

    fila.append(nombre, detalle, subtotalElemento);
    contenedor.appendChild(fila);
  });

  totalElemento.textContent = total.toFixed(2);

  if (carrito.length === 0) {
    const vacio = document.createElement("p");
    vacio.className = "checkout-ayuda";
    vacio.textContent = "Tu carrito está vacío. Regresa al catálogo para agregar productos.";
    contenedor.appendChild(vacio);
    if (botonPagar) botonPagar.disabled = true;
  }
}

function crearMensajeWhatsApp() {
  const carrito = obtenerCarrito();
  let mensaje = "Hola VIGNA, deseo coordinar este pedido:\n\n";
  let total = 0;

  carrito.forEach((item, index) => {
    const subtotal = Number(item.precio) * Number(item.cantidad);
    total += subtotal;
    mensaje += `${index + 1}. ${item.nombre} × ${item.cantidad} — S/ ${subtotal.toFixed(2)}\n`;
  });

  mensaje += `\nTotal productos: S/ ${total.toFixed(2)}`;
  window.open(`https://wa.me/51973108121?text=${encodeURIComponent(mensaje)}`, "_blank", "noopener,noreferrer");
}

async function verificarRetornoPago() {
  const params = new URLSearchParams(window.location.search);
  const estadoRetorno = params.get("pago");
  const paymentId = params.get("payment_id") || params.get("collection_id");

  if (estadoRetorno === "fallido") {
    mostrarEstado("El pago no se completó. Tu carrito sigue guardado para que puedas intentarlo nuevamente.", "error");
    return;
  }

  if (estadoRetorno === "pendiente") {
    mostrarEstado("El pago está pendiente. Te mostraremos la confirmación cuando Mercado Pago lo apruebe.");
    return;
  }

  if (estadoRetorno !== "retorno" || !paymentId) return;

  const apiUrl = obtenerApiPagosUrl();
  if (!apiUrl) {
    mostrarEstado("El pago regresó correctamente, pero el servidor todavía no está configurado para verificarlo.", "error");
    return;
  }

  try {
    mostrarEstado("Verificando el pago con Mercado Pago…");
    const respuesta = await fetch(`${apiUrl}/verificar-pago-productos/${encodeURIComponent(paymentId)}`);
    const data = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok || !data.aprobado) {
      throw new Error(data.error || "El pago aún no figura como aprobado.");
    }

    localStorage.removeItem("carritoVigna");
    renderizarResumen();
    mostrarEstado(`Pago aprobado. Pedido ${data.pedidoId || "VIGNA"} confirmado por S/ ${Number(data.total).toFixed(2)}.`, "exito");
    window.history.replaceState({}, document.title, "checkout.html");
  } catch (error) {
    mostrarEstado(error.message || "No se pudo verificar el pago.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderizarResumen();
  verificarRetornoPago();

  try {
    const cliente = JSON.parse(localStorage.getItem("vignaCliente"));
    if (cliente) {
      if (cliente.nombre) document.getElementById("nombre").value = cliente.nombre;
      if (cliente.email) document.getElementById("email").value = cliente.email;
      if (cliente.telefono) document.getElementById("telefono").value = cliente.telefono;
    }
  } catch (_error) {
    localStorage.removeItem("vignaCliente");
  }

  document.getElementById("checkoutWhatsapp")?.addEventListener("click", crearMensajeWhatsApp);

  document.getElementById("formCheckout")?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const formulario = evento.currentTarget;

    if (!formulario.reportValidity()) return;

    const carrito = obtenerCarrito();
    if (carrito.length === 0) {
      mostrarEstado("Tu carrito está vacío.", "error");
      return;
    }

    if (carrito.some((item) => !item.id || !item.archivo)) {
      mostrarEstado("Debes volver a agregar los productos desde el catálogo para continuar.", "error");
      return;
    }

    const apiUrl = obtenerApiPagosUrl();
    if (!apiUrl) {
      mostrarEstado("El servidor de pagos todavía no está publicado. Mientras tanto puedes coordinar el pedido por WhatsApp.", "error");
      return;
    }

    const boton = document.getElementById("botonPagar");
    boton.disabled = true;
    boton.textContent = "Preparando pago…";

    const datos = new FormData(formulario);

    try {
      const respuesta = await fetch(`${apiUrl}/crear-pago-productos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map((item) => ({
            id: item.id,
            archivo: item.archivo,
            cantidad: item.cantidad
          })),
          comprador: {
            nombre: datos.get("nombre"),
            email: datos.get("email"),
            telefono: datos.get("telefono"),
            departamento: datos.get("departamento"),
            distrito: datos.get("distrito"),
            direccion: datos.get("direccion"),
            referencia: datos.get("referencia")
          }
        })
      });

      const data = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok || !data.init_point) throw new Error(data.error || "No se pudo iniciar el pago.");

      sessionStorage.setItem("vignaPedidoPendiente", data.pedidoId || "");
      window.location.href = data.init_point;
    } catch (error) {
      mostrarEstado(error.message || "No se pudo conectar con el servidor de pagos.", "error");
      boton.disabled = false;
      boton.textContent = "Ir al pago seguro";
    }
  });
});
