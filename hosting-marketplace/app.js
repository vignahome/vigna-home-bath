import { db } from "./firebase-config.js";

import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const menuButton = document.querySelector(".menu-button");
const mainNav = document.querySelector(".main-nav");
const searchForm = document.querySelector(".search-box");
const searchInput = document.querySelector("#searchInput");
const categoryButtons = document.querySelectorAll("[data-category]");
const catalogContainer = document.querySelector(".empty-state");

let publishedProducts = [];
let selectedCategory = "";
let searchTerm = "";

menuButton?.addEventListener("click", () => {
  const isOpen = mainNav.classList.toggle("open");
  menuButton.setAttribute("aria-expanded", String(isOpen));
});

mainNav?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");
    menuButton?.setAttribute("aria-expanded", "false");
  });
});

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function formatPrice(value) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN"
  }).format(Number(value) || 0);
}

function showCatalogMessage(title, description) {
  if (!catalogContainer) return;

  catalogContainer.style.width = "100%";
  catalogContainer.style.maxWidth = "none";

  catalogContainer.innerHTML = `
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(description)}</p>
  `;
}

function matchesCurrentFilters(product) {
  const normalizedSearch = normalizeText(searchTerm);
  const normalizedCategory = normalizeText(selectedCategory);
  const productCategory = normalizeText(product.category);

  const searchContent = normalizeText([
    product.name,
    product.sku,
    product.category,
    product.description,
    product.sellerName
  ].join(" "));

  const matchesSearch =
    !normalizedSearch || searchContent.includes(normalizedSearch);

  const matchesCategory =
    !normalizedCategory ||
    normalizedCategory === "todos" ||
    productCategory === normalizedCategory ||
    productCategory.includes(normalizedCategory) ||
    normalizedCategory.includes(productCategory);

  return matchesSearch && matchesCategory;
}

function renderProducts() {
  if (!catalogContainer) return;

  const filteredProducts = publishedProducts.filter(
    matchesCurrentFilters
  );

  if (filteredProducts.length === 0) {
    showCatalogMessage(
      "No encontramos productos",
      "Prueba con otra búsqueda o selecciona una categoría diferente."
    );
    return;
  }

  catalogContainer.style.width = "100%";
  catalogContainer.style.maxWidth = "none";
  catalogContainer.style.textAlign = "left";

  catalogContainer.innerHTML = `
    <div style="
      display:grid;
      grid-template-columns:repeat(auto-fit,minmax(250px,1fr));
      gap:22px;
      width:100%;
    ">
      ${filteredProducts.map((product) => `
        <article style="
          overflow:hidden;
          border:1px solid rgba(212,175,55,.45);
          border-radius:20px;
          background:#050b08;
          box-shadow:0 16px 38px rgba(0,0,0,.28);
        ">
          <div style="
            display:flex;
            align-items:center;
            justify-content:center;
            height:250px;
            padding:14px;
            background:#ffffff;
          ">
            ${
              product.imageUrl
                ? `<img
                    src="${escapeHtml(product.imageUrl)}"
                    alt="${escapeHtml(product.name)}"
                    loading="lazy"
                    style="
                      width:100%;
                      height:100%;
                      object-fit:contain;
                      border-radius:12px;
                    ">`
                : `<span style="color:#53625a;">Producto sin imagen</span>`
            }
          </div>

          <div style="padding:20px;">
            <span style="
              display:inline-block;
              margin-bottom:12px;
              color:#21df8b;
              font-size:.76rem;
              font-weight:800;
              letter-spacing:.12em;
              text-transform:uppercase;
            ">
              ${escapeHtml(product.category)}
            </span>

            <h3 style="
              margin:0 0 8px;
              color:#d4af37;
              font-size:1.28rem;
            ">
              ${escapeHtml(product.name)}
            </h3>

            <p style="
              margin:0 0 12px;
              color:#ffffff;
              font-size:1.25rem;
              font-weight:800;
            ">
              ${formatPrice(product.price)}
            </p>

            <p style="
              margin:0 0 14px;
              color:#bdc8c1;
              line-height:1.55;
            ">
              ${escapeHtml(product.description)}
            </p>

            <div style="
              padding-top:14px;
              border-top:1px solid rgba(255,255,255,.12);
              color:#ffffff;
              font-size:.9rem;
            ">
              <strong>Vendido por:</strong>
              ${escapeHtml(product.sellerName)}
              <br>
              <strong>Stock:</strong>
              ${escapeHtml(product.stock)}
            </div>
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  searchTerm = searchInput?.value.trim() || "";
  renderProducts();

  document.querySelector("#productos")?.scrollIntoView({
    behavior: "smooth"
  });
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category || "";

    categoryButtons.forEach((item) => {
      item.setAttribute(
        "aria-pressed",
        String(item === button)
      );
    });

    renderProducts();

    document.querySelector("#productos")?.scrollIntoView({
      behavior: "smooth"
    });
  });
});

async function loadPublishedProducts() {
  showCatalogMessage(
    "Cargando productos",
    "Estamos preparando el catálogo VIGNA."
  );

  try {
    const productsQuery = query(
      collection(db, "products"),
      where("status", "==", "published")
    );

    const snapshot = await getDocs(productsQuery);

    publishedProducts = snapshot.docs
      .map((productDocument) => ({
        id: productDocument.id,
        ...productDocument.data()
      }))
      .sort((firstProduct, secondProduct) => {
        const firstDate = firstProduct.updatedAt?.seconds || 0;
        const secondDate = secondProduct.updatedAt?.seconds || 0;
        return secondDate - firstDate;
      });

    if (publishedProducts.length === 0) {
      showCatalogMessage(
        "Próximamente",
        "Las tiendas aprobadas todavía no han publicado productos."
      );
      return;
    }

    renderProducts();
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);

    showCatalogMessage(
      "No fue posible cargar el catálogo",
      "Actualiza la página para intentarlo nuevamente."
    );
  }
}

loadPublishedProducts();