const menuToggle = document.getElementById("menu-toggle");
const mainNav = document.getElementById("main-nav");
const siteHeader = document.querySelector(".site-header");

if (menuToggle && mainNav) {
  const cambiarEstadoMenu = (abierto) => {
    mainNav.classList.toggle("open", abierto);
    menuToggle.classList.toggle("open", abierto);
    menuToggle.setAttribute("aria-expanded", String(abierto));
    menuToggle.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
  };

  menuToggle.addEventListener("click", () => {
    cambiarEstadoMenu(!mainNav.classList.contains("open"));
  });

  mainNav.querySelectorAll("a").forEach((enlace) => {
    enlace.addEventListener("click", () => cambiarEstadoMenu(false));
  });

  document.addEventListener("click", (evento) => {
    if (!mainNav.contains(evento.target) && !menuToggle.contains(evento.target)) {
      cambiarEstadoMenu(false);
    }
  });

  document.addEventListener("keydown", (evento) => {
    if (evento.key === "Escape") cambiarEstadoMenu(false);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1050) cambiarEstadoMenu(false);
  });
}

if (siteHeader) {
  const actualizarEncabezado = () => {
    siteHeader.classList.toggle("scrolled", window.scrollY > 30);
  };

  actualizarEncabezado();
  window.addEventListener("scroll", actualizarEncabezado, { passive: true });
}

function mostrarCategoria(id, mover = true) {
  document.querySelectorAll(".categoria-productos").forEach((box) => {
    box.classList.remove("active");
  });

  document.querySelectorAll(".category-card").forEach((button) => {
    const estaActiva = button.getAttribute("aria-controls") === id;

    button.classList.toggle("active", estaActiva);
    button.setAttribute("aria-pressed", String(estaActiva));
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

// ==========================
// BOTÓN VOLVER ARRIBA
// ==========================

const btnSubir = document.getElementById("btnSubir");

if (btnSubir) {
  window.addEventListener("scroll", () => {
    if (window.scrollY > 600) {
      btnSubir.classList.add("visible");
    } else {
      btnSubir.classList.remove("visible");
    }
  });
}

function volverArriba() {

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });

}

window.volverArriba = volverArriba;

});
