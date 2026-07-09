const menuToggle = document.getElementById("menu-toggle");
const mainNav = document.getElementById("main-nav");

if (menuToggle && mainNav) {
  menuToggle.addEventListener("click", () => {
    mainNav.classList.toggle("open");
  });
}

function mostrarCategoria(id, mover = true) {
  document.querySelectorAll(".categoria-productos").forEach((box) => {
    box.classList.remove("active");
  });

  const box = document.getElementById(id);

  if (box) {
    box.classList.add("active");

    if (mover) {
      setTimeout(() => {
        const posicion = box.getBoundingClientRect().top + window.pageYOffset - 120;

window.scrollTo({
    top: posicion,
    behavior: "smooth"
});
      }, 150);
    }
  }
}

function abrirProducto(nombre, precio, carpeta, descripcion, c1, c2, c3, c4) {
  document.getElementById("modalName").textContent = nombre;
  document.getElementById("modalPrice").textContent = precio;
  document.getElementById("modalDescription").textContent = descripcion;

  const features = document.querySelectorAll("#modalFeatures li");
  features[0].textContent = c1 || "";
  features[1].textContent = c2 || "";
  features[2].textContent = c3 || "";
  features[3].textContent = c4 || "";

  const modalImg = document.getElementById("modalImg");
  modalImg.src = carpeta + "1.png";
  modalImg.onclick = () => abrirImagenCompleta(modalImg.src);

  document.querySelectorAll(".modal-thumbs img").forEach((thumb, index) => {
    const ruta = carpeta + (index + 1) + ".png";
    thumb.src = ruta;

    thumb.onclick = () => {
      modalImg.src = ruta;
      modalImg.onclick = () => abrirImagenCompleta(ruta);
    };
  });

  const video = document.getElementById("modalVideo");
  const source = document.getElementById("modalVideoSource");

  source.src = carpeta + "video.mp4";
  video.load();

  document.getElementById("modalWhatsapp").href =
    "https://wa.me/51973108121?text=" +
    encodeURIComponent("Hola VIGNA, quiero cotizar " + nombre + " con precio " + precio);

  document.getElementById("productModal").classList.add("open");
}

function abrirImagenCompleta(ruta) {
  const viewer = document.getElementById("imageViewer");
  const img = document.getElementById("imageViewerImg");

  img.src = ruta;
  viewer.classList.add("open");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".reveal").forEach((el) => {
    el.classList.add("visible");
  });

  const modal = document.getElementById("productModal");
  const cerrar = document.getElementById("modalClose");

  if (modal && cerrar) {
    cerrar.onclick = () => modal.classList.remove("open");

    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.classList.remove("open");
      }
    };
  }

  const viewer = document.getElementById("imageViewer");
  const cerrarViewer = document.getElementById("imageViewerClose");

  if (viewer && cerrarViewer) {
    cerrarViewer.onclick = () => viewer.classList.remove("open");

    viewer.onclick = (e) => {
      if (e.target === viewer) {
        viewer.classList.remove("open");
      }
    };
  }

  const heroCarousel = document.getElementById("heroCarousel");

if (heroCarousel) {
  for (let i = 1; i <= 20; i++) {
    const img = document.createElement("img");
    img.src = `images/hero-carousel/${i}.png`;
    img.className = "hero-slide";

    if (i === 1) img.classList.add("active");

    img.onerror = () => img.remove();

    heroCarousel.appendChild(img);
  }

  function renderTrabajos(plomeroId) {
  const trabajos = trabajosVigna.filter(
    (t) => String(t.plomeroId || "").trim() === String(plomeroId || "").trim()
  );

  if (trabajos.length === 0) {
    return "<small>Sin trabajos cargados</small>";
  }

  let html = "<h4>Trabajos realizados</h4>";

  trabajos.forEach((t) => {
    html += `
      <div class="trabajo-box">
        <h5>${t.titulo || "Trabajo realizado"}</h5>
        <p>${t.descripcion || ""}</p>

        <div class="trabajo-fotos">
          <div>
            <p>Antes</p>
            <img src="${t.fotoAntes}" class="foto-trabajo">
          </div>

          <div>
            <p>Después</p>
            <img src="${t.fotoDespues}" class="foto-trabajo">
          </div>
        </div>
      </div>
    `;
  });

  return html;
}

function renderComentarios(plomeroId) {
  const comentariosFiltrados = comentariosVigna.filter((c) => {
    return String(c.plomeroId || "").trim() === String(plomeroId || "").trim();
  });

  if (comentariosFiltrados.length === 0) {
    return "<small>Sin comentarios</small>";
  }

  let html = "";

  comentariosFiltrados.forEach((c) => {
    html += `
      <div class="comentario-box">
        ⭐ ${c.estrellas}<br>
        "${c.comentario}"
      </div>
    `;
  });

  return html;
}

  const slides = heroCarousel.querySelectorAll(".hero-slide");

  if (slides.length > 1) {
    let actual = 0;

    setInterval(() => {
      slides[actual].classList.remove("active");

      actual = (actual + 1) % slides.length;

      slides[actual].classList.add("active");
    }, 3000);
  }
}

window.mostrarCategoria = mostrarCategoria;
window.abrirProducto = abrirProducto;
window.abrirImagenCompleta = abrirImagenCompleta;
window.abrirImagenCompleta = abrirImagenCompleta;

// ==========================
// BOTÓN VOLVER ARRIBA
// ==========================

const btnSubir = document.getElementById("btnSubir");

window.addEventListener("scroll", () => {

  if (window.scrollY > 600) {
    btnSubir.classList.add("visible");
  } else {
    btnSubir.classList.remove("visible");
  }

});

function volverArriba() {

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}

window.volverArriba = volverArriba;

});