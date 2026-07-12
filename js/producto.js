document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  const id = params.get("id");
  const archivo = params.get("archivo");
  const carpetaBase = params.get("carpetaBase");

  if (!id || !archivo || !carpetaBase) {
    document.getElementById("productoNombre").textContent = "Producto no encontrado";
    return;
  }

  let respuesta;
let texto;

try {
  respuesta = await fetch(archivo);

  if (!respuesta.ok) {
    throw new Error(`No se pudo cargar ${archivo}`);
  }

  texto = await respuesta.text();
} catch (error) {
  console.error("Error cargando el producto:", error);

  const titulo = document.getElementById("productoNombre");

  if (titulo) {
    titulo.textContent = "No se pudo cargar el producto";
  }

  return;
}

  const filas = texto.trim().split("\n").slice(1);

  const fila = filas.find((f) => f.split(";")[0]?.trim() === id);

  if (!fila) {
    document.getElementById("productoNombre").textContent = "Producto no encontrado";
    return;
  }

  const datos = fila.split(";");

  const nombre = datos[1]?.trim() || "";
  const precio = datos[2]?.trim() || "";
  const descripcion = datos[3]?.trim() || "";
  const carpeta = datos[4]?.trim() || "";

  const c1 = datos[5]?.trim() || "";
  const c2 = datos[6]?.trim() || "";
  const c3 = datos[7]?.trim() || "";
  const c4 = datos[8]?.trim() || "";

  const material = datos[9]?.trim() || "";
  const color = datos[10]?.trim() || "";
  const acabado = datos[11]?.trim() || "";
  const garantia = datos[12]?.trim() || "";
  const alto = datos[13]?.trim() || "";
  const ancho = datos[14]?.trim() || "";
  const profundidad = datos[15]?.trim() || "";
  const presion = datos[16]?.trim() || "";
  const manualPDF = datos[17]?.trim() || "";
  const video = datos[18]?.trim() || "video.mp4";

  const ruta = carpetaBase + carpeta + "/";

  document.getElementById("productoNombre").textContent = nombre;
  document.getElementById("productoPrecio").textContent = "S/ " + precio;
  document.getElementById("productoDescripcion").textContent = descripcion;
  document.title = `${nombre} | VIGNA Home & Bath`;

  const metaDescripcion = document.querySelector('meta[name="description"]');
  if (metaDescripcion) {
    metaDescripcion.content = `${nombre}: ${descripcion || "producto premium para baños y cocinas"}. Precio S/ ${precio}.`;
  }

  const especificaciones = [
    ["espMaterial", material],
    ["espColor", color],
    ["espAcabado", acabado],
    ["espGarantia", garantia],
    ["espAlto", alto],
    ["espAncho", ancho],
    ["espProfundidad", profundidad],
    ["espPresion", presion]
  ];

  let hayEspecificaciones = false;

  especificaciones.forEach(([idEspecificacion, valor]) => {
    const celda = document.getElementById(idEspecificacion);

    if (!celda) return;

    const filaEspecificacion = celda.closest("tr");

    if (valor) {
      celda.textContent = valor;
      hayEspecificaciones = true;

      if (filaEspecificacion) {
        filaEspecificacion.hidden = false;
      }
    } else if (filaEspecificacion) {
      filaEspecificacion.hidden = true;
    }
  });

  const seccionEspecificaciones =
    document.querySelector(".producto-especificaciones");
  const manual = document.getElementById("descargarManual");

if (manual) {

    if (manualPDF) {
        manual.href = ruta + manualPDF;
        manual.style.display = "inline-flex";
    } else {
        manual.removeAttribute("href");
        manual.style.display = "none";
    }

}

if (seccionEspecificaciones) {
  seccionEspecificaciones.style.display =
    hayEspecificaciones || manualPDF ? "" : "none";
}

  const imagen = document.getElementById("productoImagen");

  const rutasCandidatas = [
    ruta + "portada.png",
    ruta + "1.png",
    ruta + "2.png",
    ruta + "3.png"
  ];

  const imagenesGaleria = (await Promise.all(
    rutasCandidatas.map((src) => new Promise((resolve) => {
      const prueba = new Image();
      prueba.onload = () => resolve(src);
      prueba.onerror = () => resolve(null);
      prueba.src = src;
    }))
  )).filter(Boolean);

if (imagen) {
  if (imagenesGaleria.length > 0) {
    imagen.src = imagenesGaleria[0];
    imagen.alt = nombre;
  } else {
    imagen.hidden = true;
    imagen.closest(".zoom-container")?.classList.add("sin-imagen");
  }
}

  for (let i = 1; i <= 3; i++) {
  const mini = document.getElementById("mini" + i);

  if (!mini || !imagen) continue;

  const rutaMiniatura = imagenesGaleria[i];

  if (!rutaMiniatura) {
    mini.hidden = true;
    continue;
  }

  mini.src = rutaMiniatura;
  mini.alt = `${nombre}, vista ${i + 1}`;

  mini.onclick = () => {
  const videoPrincipal = document.getElementById("productoVideoPrincipal");

  if (videoPrincipal) {
    videoPrincipal.pause();
    videoPrincipal.currentTime = 0;
    videoPrincipal.style.display = "none";
  }

  imagen.style.display = "block";
  imagen.src = mini.src;
};

}

  const lista = document.getElementById("productoCaracteristicas");

if (lista) {
  lista.innerHTML = "";

  [c1, c2, c3, c4].forEach((c) => {
    if (c) {
      lista.innerHTML += `<li>${c}</li>`;
    }
  });
}

  const videoEl = document.getElementById("productoVideo");
  const videoSource = document.getElementById("productoVideoSource");
  const seccionVideo = document.querySelector(".producto-video");

  if (videoEl && videoSource && video) {
    videoSource.src = ruta + video;
    videoEl.addEventListener("loadedmetadata", () => {
      if (seccionVideo) seccionVideo.hidden = false;
    }, { once: true });
    videoEl.addEventListener("error", () => {
      if (seccionVideo) seccionVideo.hidden = true;
    }, { once: true });
    videoEl.load();
  }

  const videoPrincipal = document.getElementById("productoVideoPrincipal");
const videoPrincipalSource = document.getElementById("productoVideoPrincipalSource");
const miniVideo = document.getElementById("miniVideo");

if (videoPrincipal && videoPrincipalSource && miniVideo && imagen && video) {
  videoPrincipalSource.src = ruta + video;
  videoPrincipal.addEventListener("loadedmetadata", () => {
    miniVideo.hidden = false;
  }, { once: true });
  videoPrincipal.addEventListener("error", () => {
    miniVideo.hidden = true;
    videoPrincipal.style.display = "none";
  }, { once: true });
  videoPrincipal.load();

  miniVideo.onclick = () => {
    imagen.style.display = "none";
    videoPrincipal.style.display = "block";
    videoPrincipal.play();
  };
}

  const btnWhatsapp = document.getElementById("productoWhatsapp");

if (btnWhatsapp) {
  btnWhatsapp.href =
    "https://wa.me/51973108121?text=" +
    encodeURIComponent(
      "Hola VIGNA, deseo cotizar el producto: " + nombre
    );
}

    const botonAgregarCarrito = document.getElementById("productoAgregarCarrito");

if (botonAgregarCarrito) {
  const categoriaSku = archivo.split("/").pop().replace(/\.csv$/i, "");
  const sku = `${categoriaSku}:${id}`;
  const stockProducto = document.getElementById("productoStock");
  const disponibilidad = typeof window.consultarStockProducto === "function"
    ? await window.consultarStockProducto(sku)
    : null;

  if (disponibilidad) {
    const agotado = disponibilidad.activo === false || Number(disponibilidad.stock) <= 0;
    botonAgregarCarrito.disabled = agotado;
    botonAgregarCarrito.textContent = agotado ? "Producto agotado" : "Agregar al carrito";
    if (stockProducto) {
      stockProducto.hidden = false;
      stockProducto.textContent = agotado
        ? "Sin stock disponible"
        : Number(disponibilidad.stock) <= Number(disponibilidad.stockMinimo) ? "Últimas unidades disponibles" : "Disponible";
      stockProducto.classList.toggle("agotado", agotado);
    }
  }

  botonAgregarCarrito.onclick = () => {
    const enlaceProducto =
      "producto.html?" +
      "id=" + encodeURIComponent(id) +
      "&archivo=" + encodeURIComponent(archivo) +
      "&carpetaBase=" + encodeURIComponent(carpetaBase);

    agregarAlCarrito(nombre, precio, enlaceProducto, id, archivo);
  };
}

  const relacionados = document.getElementById("productosRelacionados");

if (!relacionados) {
  console.warn("No existe el contenedor productosRelacionados.");
  return;
}

relacionados.innerHTML = "";

  let cantidad = 0;

  filas.forEach((f) => {
    if (cantidad >= 3) return;

    const d = f.split(";");
    const idRel = d[0]?.trim();
    const nombreRel = d[1]?.trim();
    const precioRel = d[2]?.trim();
    const carpetaRel = d[4]?.trim();

    if (!idRel || idRel === id || !nombreRel || !precioRel || !carpetaRel) return;

    const rutaRel = carpetaBase + carpetaRel + "/";

    const enlaceRelacionado =
  "producto.html?" +
  "id=" + encodeURIComponent(idRel) +
  "&archivo=" + encodeURIComponent(archivo) +
  "&carpetaBase=" + encodeURIComponent(carpetaBase);

const tarjetaRelacionada = document.createElement("div");
tarjetaRelacionada.className = "model-card";
tarjetaRelacionada.dataset.sku = `${archivo.split("/").pop().replace(/\.csv$/i, "")}:${idRel}`;
tarjetaRelacionada.setAttribute("role", "button");
tarjetaRelacionada.setAttribute("tabindex", "0");

tarjetaRelacionada.innerHTML = `
  <img
    src="${rutaRel}portada.png"
    class="product-cover"
    alt="${nombreRel}"
    loading="lazy"
    decoding="async">

  <strong>${nombreRel}</strong>
  <span>S/ ${precioRel}</span>

  <button
    type="button"
    class="btn-mini-carrito">
    Agregar al carrito
  </button>

  <button
    type="button"
    class="btn-ver-detalles">
    Ver detalles →
  </button>
`;

const imagenRelacionada =
  tarjetaRelacionada.querySelector(".product-cover");

const botonCarritoRelacionado =
  tarjetaRelacionada.querySelector(".btn-mini-carrito");

const botonDetalles =
  tarjetaRelacionada.querySelector(".btn-ver-detalles");

imagenRelacionada.addEventListener("click", () => {
  window.location.href = enlaceRelacionado;
});

botonDetalles.addEventListener("click", () => {
  window.location.href = enlaceRelacionado;
});

botonCarritoRelacionado.addEventListener("click", (e) => {
  e.stopPropagation();

  agregarAlCarrito(
    nombreRel,
    precioRel,
    enlaceRelacionado,
    idRel,
    archivo
  );
});

tarjetaRelacionada.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    window.location.href = enlaceRelacionado;
  }
});

relacionados.appendChild(tarjetaRelacionada);

    cantidad++;
  });

  if (typeof window.aplicarDisponibilidadCarrito === "function") {
    window.aplicarDisponibilidadCarrito();
  }

  // ==========================
// VISOR PREMIUM DE IMÁGENES
// ==========================

const visorProducto = document.getElementById("visorProducto");
const visorImagen = document.getElementById("visorImagen");
const visorCerrar = document.getElementById("visorCerrar");

if (imagen && visorProducto && visorImagen && visorCerrar) {
  imagen.style.cursor = "zoom-in";

  imagen.onclick = () => {
    visorImagen.src = imagen.src;
    visorProducto.classList.add("open");
  };

  visorCerrar.onclick = () => {
    visorProducto.classList.remove("open");
  };

  visorProducto.onclick = (e) => {
    if (e.target === visorProducto) {
      visorProducto.classList.remove("open");
    }
  };
}

let indiceGaleria = 0;

const flechaIzq = document.getElementById("flechaIzq");
const flechaDer = document.getElementById("flechaDer");

function mostrarImagenGaleria(indice) {
  const videoPrincipal = document.getElementById("productoVideoPrincipal");

  if (videoPrincipal) {
    videoPrincipal.pause();
    videoPrincipal.currentTime = 0;
    videoPrincipal.style.display = "none";
  }

if (!imagen) return;

  imagen.style.display = "block";
  imagen.src = imagenesGaleria[indice];
}

if (flechaIzq && flechaDer && imagen && imagenesGaleria.length > 1) {
  flechaDer.onclick = () => {
    indiceGaleria = (indiceGaleria + 1) % imagenesGaleria.length;
    mostrarImagenGaleria(indiceGaleria);
  };

  flechaIzq.onclick = () => {
    indiceGaleria =
      (indiceGaleria - 1 + imagenesGaleria.length) % imagenesGaleria.length;
    mostrarImagenGaleria(indiceGaleria);
  };
} else {
  if (flechaIzq) flechaIzq.hidden = true;
  if (flechaDer) flechaDer.hidden = true;
}
});
