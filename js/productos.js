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

const url =
  "producto.html?" +
  "id=" + encodeURIComponent(idProducto) +
  "&archivo=" + encodeURIComponent(archivo) +
  "&carpetaBase=" + encodeURIComponent(carpetaBase);

      boton.innerHTML = `
  <img src="${ruta}portada.png" class="product-cover" alt="${nombre}">
  <strong>${nombre}</strong>
  <span>S/ ${precio}</span>

  <button
    type="button"
    class="btn-mini-carrito">
    Agregar al carrito
  </button>
`;

const botonCarrito = boton.querySelector(".btn-mini-carrito");

botonCarrito.addEventListener("click", (e) => {
  e.stopPropagation();
  agregarAlCarrito(nombre, precio, url);
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

function filtrarProductos() {
  const buscador = document.getElementById("buscadorProductos");
  const filtroColor = document.getElementById("filtroColor");
  const filtroPrecio = document.getElementById("filtroPrecio");

  const texto = buscador ? buscador.value.toLowerCase().trim() : "";
  const color = filtroColor ? filtroColor.value.toLowerCase().trim() : "";
  const precioFiltro = filtroPrecio ? filtroPrecio.value : "";

  document.querySelectorAll(".model-card").forEach((card) => {
    const contenido = (
      card.textContent + " " + (card.dataset.search || "")
    ).toLowerCase();

    const precio = Number(card.dataset.precio || 0);

    let coincidePrecio = true;

    if (precioFiltro) {
      const [min, max] = precioFiltro.split("-").map(Number);
      coincidePrecio = precio >= min && precio <= max;
    }

    const coincideTexto = contenido.includes(texto);
    const coincideColor = !color || contenido.includes(color);

    card.style.display =
      coincideTexto && coincideColor && coincidePrecio ? "" : "none";
  });

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

// ==========================
// CARRITO VIGNA
// ==========================

let carritoVigna = JSON.parse(localStorage.getItem("carritoVigna")) || [];

// Corrige productos antiguos que no tengan cantidad
carritoVigna = carritoVigna.map((item) => ({
  nombre: item.nombre,
  precio: Number(item.precio) || 0,
  cantidad: Number(item.cantidad) || 1,
  enlace: item.enlace || ""
}));

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

        <strong>${item.nombre}</strong>

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

function agregarAlCarrito(nombre, precio, enlace = "") {
  const existente = carritoVigna.find(
    (item) => item.nombre === nombre
  );

  if (existente) {
    existente.cantidad += 1;

    if (enlace) {
      existente.enlace = enlace;
    }
  } else {
    carritoVigna.push({
      nombre: nombre,
      precio: Number(precio),
      cantidad: 1,
      enlace: enlace
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
  document.getElementById("panelCarrito")?.classList.add("open");
}

function cerrarCarrito() {
  document.getElementById("panelCarrito")?.classList.remove("open");
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
      const enlaceCompleto = new URL(
  item.enlace,
  window.location.origin + "/"
).href;

      mensaje += `Producto: ${enlaceCompleto}\n`;
    }

    mensaje += "\n";
  });

  mensaje += `TOTAL GENERAL: S/ ${total.toFixed(2)}`;

  const enlaceWhatsApp =
    "https://wa.me/51973108121?text=" +
    encodeURIComponent(mensaje);

  window.open(enlaceWhatsApp, "_blank");
}

document.addEventListener("DOMContentLoaded", () => {
  guardarCarrito();
  actualizarCarrito();
});

window.agregarAlCarrito = agregarAlCarrito;
window.cambiarCantidad = cambiarCantidad;
window.eliminarDelCarrito = eliminarDelCarrito;
window.abrirCarrito = abrirCarrito;
window.cerrarCarrito = cerrarCarrito;
window.enviarCarritoWhatsApp = enviarCarritoWhatsApp;