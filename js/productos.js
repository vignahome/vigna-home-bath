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
      <button class="category-card" data-grid="${grid}" onclick="mostrarCategoria('${id}')">
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

      const boton = document.createElement("button");
      boton.className = "model-card";

      boton.innerHTML = `
        <img src="${ruta}portada.png" class="product-cover" alt="${nombre}">
        <strong>${nombre}</strong>
        <span>S/ ${precio}</span>
      `;

      boton.addEventListener("click", () => {

    const idProducto = datos[0]?.trim();

const url =
  "producto.html?" +
  "id=" + encodeURIComponent(idProducto) +
  "&archivo=" + encodeURIComponent(archivo) +
  "&carpetaBase=" + encodeURIComponent(carpetaBase);

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