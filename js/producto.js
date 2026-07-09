console.log("producto.js cargado correctamente");

document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);

  const id = params.get("id");
  const archivo = params.get("archivo");
  const carpetaBase = params.get("carpetaBase");

  if (!id || !archivo || !carpetaBase) {
    document.getElementById("productoNombre").textContent = "Producto no encontrado";
    return;
  }

  const respuesta = await fetch(archivo);
  const texto = await respuesta.text();
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

  document.getElementById("espMaterial").textContent = material;
  document.getElementById("espColor").textContent = color;
  document.getElementById("espAcabado").textContent = acabado;
  document.getElementById("espGarantia").textContent = garantia;
  document.getElementById("espAlto").textContent = alto;
  document.getElementById("espAncho").textContent = ancho;
  document.getElementById("espProfundidad").textContent = profundidad;
  document.getElementById("espPresion").textContent = presion;

  const manual = document.getElementById("descargarManual");
  if (manualPDF) {
    manual.href = ruta + manualPDF;
    manual.style.display = "inline-flex";
  } else {
    manual.style.display = "none";
  }

  const imagen = document.getElementById("productoImagen");
  imagen.src = ruta + "portada.png";

  for (let i = 1; i <= 3; i++) {
  const mini = document.getElementById("mini" + i);

  if (!mini || !imagen) continue;

  mini.src = ruta + i + ".png";

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

  mini.onerror = () => {
    mini.style.display = "none";
  };
}

  const lista = document.getElementById("productoCaracteristicas");
  lista.innerHTML = "";
  [c1, c2, c3, c4].forEach((c) => {
    if (c) lista.innerHTML += `<li>${c}</li>`;
  });

  const videoEl = document.getElementById("productoVideo");
  const videoSource = document.getElementById("productoVideoSource");

  if (videoEl && videoSource && video) {
    videoSource.src = ruta + video;
    videoEl.load();
  }

  const videoPrincipal = document.getElementById("productoVideoPrincipal");
const videoPrincipalSource = document.getElementById("productoVideoPrincipalSource");
const miniVideo = document.getElementById("miniVideo");

if (videoPrincipal && videoPrincipalSource && miniVideo && imagen && video) {
  videoPrincipalSource.src = ruta + video;
  videoPrincipal.load();

  miniVideo.onclick = () => {
    imagen.style.display = "none";
    videoPrincipal.style.display = "block";
    videoPrincipal.play();
  };
}

  document.getElementById("productoWhatsapp").href =
    "https://wa.me/51991718386?text=" +
    encodeURIComponent("Hola VIGNA, deseo cotizar el producto: " + nombre);

  const relacionados = document.getElementById("productosRelacionados");
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

    relacionados.innerHTML += `
      <button class="model-card" onclick="window.location.href='producto.html?id=${idRel}&archivo=${encodeURIComponent(archivo)}&carpetaBase=${encodeURIComponent(carpetaBase)}'">
        <img src="${rutaRel}portada.png" class="product-cover" alt="${nombreRel}">
        <strong>${nombreRel}</strong>
        <span>S/ ${precioRel}</span>
      </button>
    `;

    cantidad++;
  });

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

const imagenesGaleria = [
  ruta + "portada.png",
  ruta + "1.png",
  ruta + "2.png",
  ruta + "3.png"
];

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

  imagen.style.display = "block";
  imagen.src = imagenesGaleria[indice];
}

if (flechaIzq && flechaDer && imagen) {
  flechaDer.onclick = () => {
    indiceGaleria = (indiceGaleria + 1) % imagenesGaleria.length;
    mostrarImagenGaleria(indiceGaleria);
  };

  flechaIzq.onclick = () => {
    indiceGaleria =
      (indiceGaleria - 1 + imagenesGaleria.length) % imagenesGaleria.length;
    mostrarImagenGaleria(indiceGaleria);
  };
}
});