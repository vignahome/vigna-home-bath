async function cargarCategorias(archivo) {
  const respuesta = await fetch(archivo);
  const texto = await respuesta.text();

  const filas = texto.trim().split("\n").slice(1);

  const categoriasGrid = document.getElementById("categoriasGrid");
  const categoriasProductos = document.getElementById("categoriasProductos");

  if (!categoriasGrid || !categoriasProductos) return;

  categoriasGrid.innerHTML = "";
  categoriasProductos.innerHTML = "";

  filas.forEach((fila, index) => {
    const datos = fila.split(";");

    const id = datos[0]?.trim();
    const titulo = datos[1]?.trim();
    const subtitulo = datos[2]?.trim();
    const archivoCSV = datos[3]?.trim();
    const grid = datos[4]?.trim();
    const carpetaBase = datos[5]?.trim();

    if (!id || !titulo || !archivoCSV || !grid || !carpetaBase) return;

    categoriasGrid.innerHTML += `
      <button
        type="button"
        class="category-card"
        data-grid="${grid}"
        aria-controls="${id}"
        aria-pressed="false"
        onclick="mostrarCategoria('${id}')">
        <div class="category-carousel"></div>
        <span>${titulo}</span>
      </button>
    `;

    categoriasProductos.innerHTML += `
      <section id="${id}" class="categoria-productos">
        <h3>${titulo}</h3>
        <p>${subtitulo}</p>
        <div id="${grid}" class="model-grid"></div>
      </section>
    `;

    cargarCSV(archivoCSV, grid, carpetaBase);

    if (index === 0) {
      setTimeout(() => mostrarCategoria(id), 500);
    }
  });
}

async function cargarCSV(archivo, contenedor, carpetaBase) {
  try {
    const respuesta = await fetch(archivo);

    if (!respuesta.ok) {
      console.error("No se pudo cargar:", archivo);
      return;
    }

    const texto = await respuesta.text();
    const filas = texto.trim().split("\n").slice(1);
    const grid = document.getElementById(contenedor);

    if (!grid) return;

    grid.innerHTML = "";

    filas.forEach((fila) => {
      const datos = fila.split(";");

      const nombre = datos[1]?.trim();
      const precio = datos[2]?.trim();
      const descripcion = datos[3]?.trim();
      const carpeta = datos[4]?.trim();

      const c1 = datos[5]?.trim() || "";
      const c2 = datos[6]?.trim() || "";
      const c3 = datos[7]?.trim() || "";
      const c4 = datos[8]?.trim() || "";

      if (!nombre || !precio || !carpeta) return;

      const ruta = `${carpetaBase}${carpeta}/`;

      const boton = document.createElement("div");
boton.className = "model-card";
boton.setAttribute("role", "button");
boton.setAttribute("tabindex", "0");
      boton.dataset.precio = Number(precio);
boton.dataset.nombre = nombre.toLowerCase();

      boton.dataset.search = [
  nombre,
  precio,
  descripcion,
  carpeta,
  c1,
  c2,
  c3,
  c4
].join(" ").toLowerCase();

const idProducto = datos[0]?.trim();
const categoriaSku = archivo.split("/").pop().replace(/\.csv$/i, "");
boton.dataset.sku = `${categoriaSku}:${idProducto}`;

const url =
  "producto.html?" +
  "id=" + encodeURIComponent(idProducto) +
  "&archivo=" + encodeURIComponent(archivo) +
  "&carpetaBase=" + encodeURIComponent(carpetaBase);

      boton.innerHTML = `
  <img src="${ruta}portada.png" class="product-cover" alt="${nombre}" loading="lazy" decoding="async">
  <strong>${nombre}</strong>
  <span>S/ ${precio}</span>
  <small class="stock-producto" hidden></small>

  <button
    type="button"
    class="btn-mini-carrito">
    Agregar al carrito
  </button>
`;

const portadaProducto = boton.querySelector(".product-cover");

portadaProducto.addEventListener("error", () => {
  portadaProducto.remove();
  boton.classList.add("sin-imagen");
}, { once: true });

const botonCarrito = boton.querySelector(".btn-mini-carrito");

botonCarrito.addEventListener("click", (e) => {
  e.stopPropagation();
  agregarAlCarrito(nombre, precio, url, idProducto, archivo);
});

      boton.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    window.location.href = url;
  }
});

boton.addEventListener("click", () => {
  window.location.href = url;
});

      grid.appendChild(boton);

      agregarImagenACategoria(contenedor, `${ruta}portada.png`);
    });

    filtrarProductos();
    aplicarDisponibilidadCarrito();

  } catch (error) {
    console.error("Error cargando CSV:", archivo, error);
  }
}

function agregarImagenACategoria(gridId, imagen) {
  const categoryCard = document.querySelector(
    `.category-card[data-grid="${gridId}"]`
  );

  if (!categoryCard) return;

  const carousel = categoryCard.querySelector(".category-carousel");
  if (!carousel) return;

  const img = document.createElement("img");
  img.src = imagen;
  img.className = "category-slide";
  img.loading = "lazy";
  img.decoding = "async";
  img.addEventListener("error", () => img.remove(), { once: true });

  if (carousel.children.length === 0) {
    img.classList.add("active");
  }

  carousel.appendChild(img);

  iniciarCategoryCarousel(carousel);
}

function iniciarCategoryCarousel(carousel) {
  if (carousel.dataset.started === "true") return;

  carousel.dataset.started = "true";

  setInterval(() => {
    const slides = carousel.querySelectorAll(".category-slide");

    if (slides.length <= 1) return;

    let actual = Array.from(slides).findIndex((slide) =>
      slide.classList.contains("active")
    );

    if (actual < 0) actual = 0;

    slides[actual].classList.remove("active");

    actual = (actual + 1) % slides.length;

    slides[actual].classList.add("active");
  }, 2500);
}

let disponibilidadPromesa = null;

function obtenerApiTiendaUrl() {
  const configurada = String(window.VIGNA_CONFIG?.apiPagosUrl || "").trim();
  if (configurada) return configurada.replace(/\/$/, "");
  if (["localhost", "127.0.0.1"].includes(window.location.hostname)) return "http://localhost:3000";
  return "";
}

async function obtenerDisponibilidad() {
  const apiUrl = obtenerApiTiendaUrl();
  if (!apiUrl) return null;

  if (!disponibilidadPromesa) {
    disponibilidadPromesa = fetch(`${apiUrl}/inventario`)
      .then((respuesta) => respuesta.ok ? respuesta.json() : null)
      .then((data) => {
        if (!data?.activo) return null;
        return new Map((data.productos || []).map((item) => [item.sku, item]));
      })
      .catch(() => null);
  }

  return disponibilidadPromesa;
}

async function consultarStockProducto(sku) {
  const disponibilidad = await obtenerDisponibilidad();
  return disponibilidad?.get(sku) || null;
}

async function aplicarDisponibilidadCarrito() {
  const disponibilidad = await obtenerDisponibilidad();
  if (!disponibilidad) return;

  document.querySelectorAll(".model-card[data-sku]").forEach((card) => {
    const stock = disponibilidad.get(card.dataset.sku);
    if (!stock) return;

    const boton = card.querySelector(".btn-mini-carrito");
    const etiqueta = card.querySelector(".stock-producto");
    const agotado = stock.activo === false || Number(stock.stock) <= 0;

    card.classList.toggle("producto-agotado", agotado);
    if (boton) {
      boton.disabled = agotado;
      boton.textContent = agotado ? "Agotado" : "Agregar al carrito";
    }

    if (etiqueta) {
      etiqueta.hidden = false;
      etiqueta.textContent = agotado
        ? "Sin stock"
        : Number(stock.stock) <= Number(stock.stockMinimo) ? "Últimas unidades" : "Disponible";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  cargarCategorias("data/categorias.csv");
});

function irACategorias() {
  const productos = document.getElementById("productos");

  if (productos) {
    const posicion = productos.getBoundingClientRect().top + window.pageYOffset - 110;

    window.scrollTo({
      top: posicion,
      behavior: "smooth"
    });
  }
}
  
window.irACategorias = irACategorias;

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function filtrarProductos() {
  const buscador = document.getElementById("buscadorProductos");
  const filtroColor = document.getElementById("filtroColor");
  const filtroPrecio = document.getElementById("filtroPrecio");

  const texto = normalizarTexto(buscador?.value);
  const color = normalizarTexto(filtroColor?.value);
  const precioFiltro = filtroPrecio ? filtroPrecio.value : "";
  const hayFiltros = Boolean(texto || color || precioFiltro);
  let totalVisible = 0;

  document.querySelectorAll(".model-card").forEach((card) => {
    const contenido = normalizarTexto(
      card.textContent + " " + (card.dataset.search || "")
    );

    const precio = Number(card.dataset.precio || 0);

    let coincidePrecio = true;

    if (precioFiltro) {
      const [min, max] = precioFiltro.split("-").map(Number);
      coincidePrecio = precio >= min && precio <= max;
    }

    const coincideTexto = contenido.includes(texto);
    const coincideColor = !color || contenido.includes(color);

    const visible = coincideTexto && coincideColor && coincidePrecio;
    card.style.display = visible ? "" : "none";
    if (visible) totalVisible += 1;
  });

  const seccionesConResultados = [];

  document.querySelectorAll(".categoria-productos").forEach((seccion) => {
    const cantidadVisible = Array.from(seccion.querySelectorAll(".model-card"))
      .filter((card) => card.style.display !== "none").length;
    const botonCategoria = document.querySelector(
      `.category-card[aria-controls="${seccion.id}"]`
    );

    if (botonCategoria) botonCategoria.hidden = hayFiltros && cantidadVisible === 0;
    if (cantidadVisible > 0) seccionesConResultados.push(seccion);
  });

  const seccionActiva = document.querySelector(".categoria-productos.active");

  if (
    seccionesConResultados.length > 0 &&
    (!seccionActiva || !seccionesConResultados.includes(seccionActiva)) &&
    typeof window.mostrarCategoria === "function"
  ) {
    window.mostrarCategoria(seccionesConResultados[0].id, false);
  }

  const resultado = document.getElementById("resultadoProductos");
  const vacio = document.getElementById("catalogoVacio");

  if (resultado) {
    resultado.textContent = `${totalVisible} ${totalVisible === 1 ? "producto encontrado" : "productos encontrados"}`;
  }

  if (vacio) vacio.hidden = totalVisible !== 0;

  ordenarProductos();
}

function ordenarProductos() {
  const orden = document.getElementById("ordenProductos")?.value;

  document.querySelectorAll(".model-grid").forEach((grid) => {
    const cards = Array.from(grid.querySelectorAll(".model-card"));

    cards.sort((a, b) => {
      const precioA = Number(a.dataset.precio || 0);
      const precioB = Number(b.dataset.precio || 0);
      const nombreA = a.dataset.nombre || "";
      const nombreB = b.dataset.nombre || "";

      if (orden === "menor") return precioA - precioB;
      if (orden === "mayor") return precioB - precioA;
      if (orden === "az") return nombreA.localeCompare(nombreB);
      if (orden === "za") return nombreB.localeCompare(nombreA);

      return 0;
    });

    cards.forEach((card) => grid.appendChild(card));
  });
}

document.addEventListener("input", (e) => {
  if (e.target.id === "buscadorProductos") {
    filtrarProductos();
  }
});

document.addEventListener("change", (e) => {
  if (
    e.target.id === "filtroColor" ||
    e.target.id === "filtroPrecio" ||
    e.target.id === "ordenProductos"
  ) {
    filtrarProductos();
  }
});

document.addEventListener("click", (e) => {
  if (e.target.id !== "limpiarFiltros") return;

  ["buscadorProductos", "filtroColor", "filtroPrecio", "ordenProductos"].forEach((id) => {
    const campo = document.getElementById(id);
    if (campo) campo.value = "";
  });

  filtrarProductos();
  document.getElementById("buscadorProductos")?.focus();
});

// ==========================
// CARRITO VIGNA
// ==========================

function cargarCarritoGuardado() {
  try {
    const guardado = JSON.parse(localStorage.getItem("carritoVigna"));
    return Array.isArray(guardado) ? guardado : [];
  } catch (_error) {
    return [];
  }
}

function escaparHTML(valor) {
  return String(valor || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let carritoVigna = cargarCarritoGuardado();

// Corrige productos antiguos que no tengan cantidad
carritoVigna = carritoVigna.map((item) => ({
  nombre: String(item.nombre || "Producto VIGNA"),
  precio: Number(item.precio) || 0,
  cantidad: Math.max(1, Math.min(99, Number(item.cantidad) || 1)),
  enlace: String(item.enlace || ""),
  id: String(item.id || ""),
  archivo: String(item.archivo || "")
})).filter((item) => item.precio >= 0);

function guardarCarrito() {
  localStorage.setItem("carritoVigna", JSON.stringify(carritoVigna));
}

function actualizarCarrito() {
  const contador = document.getElementById("contadorCarrito");
  const lista = document.getElementById("listaCarrito");
  const total = document.getElementById("totalCarrito");

  if (!contador || !lista || !total) return;

  const cantidadTotal = carritoVigna.reduce(
    (acumulado, item) => acumulado + item.cantidad,
    0
  );

  contador.textContent = cantidadTotal;
  lista.innerHTML = "";

  let suma = 0;

  if (carritoVigna.length === 0) {
    lista.innerHTML = `<p class="carrito-vacio">Tu carrito está vacío.</p>`;
  }

  carritoVigna.forEach((item, index) => {
    const subtotal = Number(item.precio) * Number(item.cantidad);
    suma += subtotal;

    lista.innerHTML += `
      <div class="item-carrito">

        <strong>${escaparHTML(item.nombre)}</strong>

        <span class="precio-carrito">
          S/ ${Number(item.precio).toFixed(2)}
        </span>

        <div class="carrito-controles">

          <button
            type="button"
            onclick="cambiarCantidad(${index}, -1)"
            aria-label="Disminuir cantidad">
            −
          </button>

          <span class="cantidad-carrito">
            ${item.cantidad}
          </span>

          <button
            type="button"
            onclick="cambiarCantidad(${index}, 1)"
            aria-label="Aumentar cantidad">
            +
          </button>

          <button
            type="button"
            class="btn-trash"
            onclick="eliminarDelCarrito(${index})"
            aria-label="Eliminar producto">
            🗑️
          </button>

        </div>

        <small class="subtotal-carrito">
          Subtotal: S/ ${subtotal.toFixed(2)}
        </small>

      </div>
    `;
  });

  total.textContent = suma.toFixed(2);
}

function agregarAlCarrito(nombre, precio, enlace = "", id = "", archivo = "") {
  const existente = carritoVigna.find(
    (item) => (id && archivo)
      ? item.id === String(id) && item.archivo === String(archivo)
      : item.nombre === nombre
  );

  if (existente) {
    existente.cantidad += 1;

    if (enlace) {
      existente.enlace = enlace;
    }
    if (id) existente.id = String(id);
    if (archivo) existente.archivo = String(archivo);
  } else {
    carritoVigna.push({
      nombre: nombre,
      precio: Number(precio),
      cantidad: 1,
      enlace: enlace,
      id: String(id || ""),
      archivo: String(archivo || "")
    });
  }

  guardarCarrito();
  actualizarCarrito();
  abrirCarrito();
}

function cambiarCantidad(index, cambio) {
  if (!carritoVigna[index]) return;

  carritoVigna[index].cantidad += cambio;

  if (carritoVigna[index].cantidad <= 0) {
    carritoVigna.splice(index, 1);
  }

  guardarCarrito();
  actualizarCarrito();
}

function eliminarDelCarrito(index) {
  carritoVigna.splice(index, 1);

  guardarCarrito();
  actualizarCarrito();
}

function abrirCarrito() {
  const panel = document.getElementById("panelCarrito");
  const overlay = document.getElementById("carritoOverlay");
  const boton = document.getElementById("btnCarrito");

  panel?.classList.add("open");
  overlay?.classList.add("open");
  panel?.setAttribute("aria-hidden", "false");
  boton?.setAttribute("aria-expanded", "true");
  document.body.classList.add("carrito-abierto");
  panel?.querySelector(".cerrar-carrito")?.focus();
}

function cerrarCarrito() {
  const panel = document.getElementById("panelCarrito");
  const overlay = document.getElementById("carritoOverlay");
  const boton = document.getElementById("btnCarrito");

  panel?.classList.remove("open");
  overlay?.classList.remove("open");
  panel?.setAttribute("aria-hidden", "true");
  boton?.setAttribute("aria-expanded", "false");
  document.body.classList.remove("carrito-abierto");
}

function vaciarCarrito() {
  if (carritoVigna.length === 0) return;
  if (!window.confirm("¿Deseas vaciar todo el carrito?")) return;

  carritoVigna = [];
  guardarCarrito();
  actualizarCarrito();
}

function iniciarCompra() {
  if (carritoVigna.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }

  const productosSinIdentificador = carritoVigna.some((item) => !item.id || !item.archivo);

  if (productosSinIdentificador) {
    alert("Actualizamos el catálogo. Vacía el carrito y agrega nuevamente los productos para continuar.");
    return;
  }

  window.location.href = "checkout.html";
}

function enviarCarritoWhatsApp() {
  if (carritoVigna.length === 0) {
    alert("Tu carrito está vacío.");
    return;
  }

  let mensaje = "Hola VIGNA, deseo cotizar los siguientes productos:\n\n";
  let total = 0;

  carritoVigna.forEach((item, index) => {
    const precio = Number(item.precio);
    const cantidad = Number(item.cantidad);
    const subtotal = precio * cantidad;

    total += subtotal;

    mensaje +=
      `${index + 1}. ${item.nombre}\n` +
      `Precio unitario: S/ ${precio.toFixed(2)}\n` +
      `Cantidad: ${cantidad}\n` +
      `Subtotal: S/ ${subtotal.toFixed(2)}\n`;

    if (item.enlace) {
      const enlaceCompleto = new URL(item.enlace, window.location.href).href;

      mensaje += `Producto: ${enlaceCompleto}\n`;
    }

    mensaje += "\n";
  });

  mensaje += `TOTAL GENERAL: S/ ${total.toFixed(2)}`;

  const enlaceWhatsApp =
    "https://wa.me/51973108121?text=" +
    encodeURIComponent(mensaje);

  window.open(enlaceWhatsApp, "_blank", "noopener,noreferrer");
}

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape") cerrarCarrito();
});

document.addEventListener("DOMContentLoaded", () => {
  guardarCarrito();
  actualizarCarrito();
});

window.agregarAlCarrito = agregarAlCarrito;
window.cambiarCantidad = cambiarCantidad;
window.eliminarDelCarrito = eliminarDelCarrito;
window.abrirCarrito = abrirCarrito;
window.cerrarCarrito = cerrarCarrito;
window.vaciarCarrito = vaciarCarrito;
window.iniciarCompra = iniciarCompra;
window.enviarCarritoWhatsApp = enviarCarritoWhatsApp;
window.consultarStockProducto = consultarStockProducto;
window.aplicarDisponibilidadCarrito = aplicarDisponibilidadCarrito;
