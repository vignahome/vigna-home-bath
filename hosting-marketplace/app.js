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
const cartButton = document.querySelector(".cart-button");
const cartCount = document.querySelector("#cartCount");

const CART_STORAGE_KEY = "vigna_marketplace_cart_v1";

let publishedProducts = [];
let selectedCategory = "";
let searchTerm = "";
let cart = loadCart();

installMarketplaceUi();
updateCartCount();

const productModal = document.querySelector("#productModal");
const productModalContent = document.querySelector("#productModalContent");
const cartModal = document.querySelector("#cartModal");
const cartModalContent = document.querySelector("#cartModalContent");

menuButton?.addEventListener("click", () => {
  const isOpen = mainNav?.classList.toggle("open") || false;
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

function normalizeStock(value) {
  const stock = Math.floor(Number(value) || 0);
  return Math.max(0, stock);
}

function loadCart() {
  try {
    const savedCart = JSON.parse(
      localStorage.getItem(CART_STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(savedCart)) return [];

    return savedCart
      .filter((item) => item && item.id)
      .map((item) => ({
        id: String(item.id),
        name: String(item.name || "Producto"),
        price: Number(item.price) || 0,
        imageUrl: String(item.imageUrl || ""),
        sellerName: String(item.sellerName || ""),
        stock: normalizeStock(item.stock),
        quantity: Math.max(1, Math.floor(Number(item.quantity) || 1))
      }));
  } catch (error) {
    console.warn("No fue posible recuperar el carrito:", error);
    return [];
  }
}

function saveCart() {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn("No fue posible guardar el carrito:", error);
  }

  updateCartCount();
}

function updateCartCount() {
  if (!cartCount) return;

  const totalUnits = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  cartCount.textContent = String(totalUnits);
  cartButton?.setAttribute(
    "aria-label",
    `Abrir carrito. ${totalUnits} producto${totalUnits === 1 ? "" : "s"}`
  );
}

function showToast(message) {
  let toast = document.querySelector("#vignaToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "vignaToast";
    toast.className = "vigna-toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("is-visible");

  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2400);
}

function showCatalogMessage(title, description) {
  if (!catalogContainer) return;

  catalogContainer.classList.remove("vigna-catalog-ready");
  catalogContainer.style.width = "100%";
  catalogContainer.style.maxWidth = "none";
  catalogContainer.style.textAlign = "center";

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

  catalogContainer.classList.add("vigna-catalog-ready");
  catalogContainer.style.width = "100%";
  catalogContainer.style.maxWidth = "none";
  catalogContainer.style.textAlign = "left";

  catalogContainer.innerHTML = `
    <div class="vigna-product-grid">
      ${filteredProducts.map((product) => {
        const stock = normalizeStock(product.stock);
        const isAvailable = stock > 0;

        return `
          <article class="vigna-product-card">
            <button
              class="vigna-product-image-button"
              type="button"
              data-product-detail="${escapeHtml(product.id)}"
              aria-label="Ver detalle de ${escapeHtml(product.name)}"
            >
              ${
                product.imageUrl
                  ? `<img
                      src="${escapeHtml(product.imageUrl)}"
                      alt="${escapeHtml(product.name)}"
                      loading="lazy">`
                  : `<span>Producto sin imagen</span>`
              }
            </button>

            <div class="vigna-product-information">
              <span class="vigna-product-category">
                ${escapeHtml(product.category)}
              </span>

              <h3>${escapeHtml(product.name)}</h3>

              <p class="vigna-product-price">
                ${formatPrice(product.price)}
              </p>

              <p class="vigna-product-description">
                ${escapeHtml(product.description)}
              </p>

              <div class="vigna-product-meta">
                <strong>Vendido por:</strong>
                ${escapeHtml(product.sellerName)}
                <br>
                <strong>Stock:</strong>
                ${stock}
              </div>

              <div class="vigna-product-actions">
                <button
                  type="button"
                  class="vigna-button vigna-button-secondary"
                  data-product-detail="${escapeHtml(product.id)}"
                >
                  Ver detalle
                </button>

                <button
                  type="button"
                  class="vigna-button vigna-button-primary"
                  data-add-cart="${escapeHtml(product.id)}"
                  ${isAvailable ? "" : "disabled"}
                >
                  ${isAvailable ? "Agregar al carrito" : "Sin stock"}
                </button>
              </div>
            </div>
          </article>
        `;
      }).join("")}
    </div>
  `;
}

function findProduct(productId) {
  return publishedProducts.find(
    (product) => String(product.id) === String(productId)
  );
}

function addToCart(product, requestedQuantity = 1) {
  if (!product) return;

  const stock = normalizeStock(product.stock);

  if (stock < 1) {
    showToast("Este producto no tiene stock disponible.");
    return;
  }

  const quantityToAdd = Math.max(
    1,
    Math.floor(Number(requestedQuantity) || 1)
  );

  const existingItem = cart.find(
    (item) => item.id === String(product.id)
  );

  if (existingItem) {
    const nextQuantity = Math.min(
      stock,
      existingItem.quantity + quantityToAdd
    );

    if (nextQuantity === existingItem.quantity) {
      showToast("Ya agregaste todo el stock disponible.");
      return;
    }

    existingItem.quantity = nextQuantity;
    existingItem.stock = stock;
    existingItem.price = Number(product.price) || 0;
  } else {
    cart.push({
      id: String(product.id),
      name: String(product.name || "Producto"),
      price: Number(product.price) || 0,
      imageUrl: String(product.imageUrl || ""),
      sellerName: String(product.sellerName || ""),
      stock,
      quantity: Math.min(stock, quantityToAdd)
    });
  }

  saveCart();
  showToast("Producto agregado al carrito.");
}

function openProductDetail(productId) {
  const product = findProduct(productId);

  if (!product || !productModalContent || !productModal) return;

  const stock = normalizeStock(product.stock);

  productModalContent.innerHTML = `
    <div class="vigna-detail-grid">
      <div class="vigna-detail-image">
        ${
          product.imageUrl
            ? `<img
                src="${escapeHtml(product.imageUrl)}"
                alt="${escapeHtml(product.name)}">`
            : `<span>Producto sin imagen</span>`
        }
      </div>

      <div class="vigna-detail-information">
        <span class="vigna-product-category">
          ${escapeHtml(product.category)}
        </span>

        <h2>${escapeHtml(product.name)}</h2>

        <p class="vigna-detail-price">
          ${formatPrice(product.price)}
        </p>

        <p class="vigna-detail-description">
          ${escapeHtml(product.description)}
        </p>

        <dl class="vigna-detail-list">
          <div>
            <dt>Vendedor</dt>
            <dd>${escapeHtml(product.sellerName)}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>${escapeHtml(product.sku || "No especificado")}</dd>
          </div>
          <div>
            <dt>Disponibilidad</dt>
            <dd>${stock} unidad${stock === 1 ? "" : "es"}</dd>
          </div>
        </dl>

        <button
          type="button"
          class="vigna-button vigna-button-primary vigna-detail-add"
          data-modal-add="${escapeHtml(product.id)}"
          ${stock > 0 ? "" : "disabled"}
        >
          ${stock > 0 ? "Agregar al carrito" : "Producto sin stock"}
        </button>
      </div>
    </div>
  `;

  openModal(productModal);
}

function syncCartWithCatalog() {
  cart = cart
    .map((item) => {
      const product = findProduct(item.id);

      if (!product) return null;

      const stock = normalizeStock(product.stock);

      if (stock < 1) return null;

      return {
        id: String(product.id),
        name: String(product.name || "Producto"),
        price: Number(product.price) || 0,
        imageUrl: String(product.imageUrl || ""),
        sellerName: String(product.sellerName || ""),
        stock,
        quantity: Math.min(stock, Math.max(1, item.quantity))
      };
    })
    .filter(Boolean);

  saveCart();
}

function renderCart() {
  if (!cartModalContent) return;

  if (cart.length === 0) {
    cartModalContent.innerHTML = `
      <div class="vigna-empty-cart">
        <span aria-hidden="true">V</span>
        <h2>Tu carrito está vacío</h2>
        <p>Agrega productos del catálogo para continuar.</p>
        <button
          type="button"
          class="vigna-button vigna-button-primary"
          data-close-modal
        >
          Explorar productos
        </button>
      </div>
    `;
    return;
  }

  const subtotal = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  cartModalContent.innerHTML = `
    <h2 class="vigna-cart-title">Tu carrito</h2>

    <div class="vigna-cart-items">
      ${cart.map((item) => `
        <article class="vigna-cart-item">
          <div class="vigna-cart-image">
            ${
              item.imageUrl
                ? `<img
                    src="${escapeHtml(item.imageUrl)}"
                    alt="${escapeHtml(item.name)}">`
                : `<span>V</span>`
            }
          </div>

          <div class="vigna-cart-information">
            <h3>${escapeHtml(item.name)}</h3>
            <p>${escapeHtml(item.sellerName)}</p>
            <strong>${formatPrice(item.price)}</strong>

            <div class="vigna-quantity-controls">
              <button
                type="button"
                data-cart-decrease="${escapeHtml(item.id)}"
                aria-label="Reducir cantidad"
              >
                −
              </button>

              <span>${item.quantity}</span>

              <button
                type="button"
                data-cart-increase="${escapeHtml(item.id)}"
                aria-label="Aumentar cantidad"
                ${item.quantity >= item.stock ? "disabled" : ""}
              >
                +
              </button>

              <button
                type="button"
                class="vigna-remove-button"
                data-cart-remove="${escapeHtml(item.id)}"
              >
                Eliminar
              </button>
            </div>
          </div>

          <strong class="vigna-cart-line-total">
            ${formatPrice(item.price * item.quantity)}
          </strong>
        </article>
      `).join("")}
    </div>

    <div class="vigna-cart-summary">
      <div>
        <span>Subtotal</span>
        <strong>${formatPrice(subtotal)}</strong>
      </div>

      <p>
        El costo de envío se calculará cuando habilitemos el proceso de compra.
      </p>

      <button
        type="button"
        class="vigna-button vigna-button-primary"
        disabled
      >
        Pago protegido: próxima etapa
      </button>
    </div>
  `;
}

function changeCartQuantity(productId, change) {
  const item = cart.find(
    (cartItem) => cartItem.id === String(productId)
  );

  if (!item) return;

  const nextQuantity = item.quantity + change;

  if (nextQuantity < 1) {
    cart = cart.filter(
      (cartItem) => cartItem.id !== String(productId)
    );
  } else {
    item.quantity = Math.min(item.stock, nextQuantity);
  }

  saveCart();
  renderCart();
}

function removeCartItem(productId) {
  cart = cart.filter(
    (item) => item.id !== String(productId)
  );

  saveCart();
  renderCart();
  showToast("Producto eliminado del carrito.");
}

function openModal(modal) {
  if (!modal) return;

  modal.hidden = false;
  document.body.classList.add("vigna-modal-open");

  window.requestAnimationFrame(() => {
    modal.classList.add("is-open");
  });

  modal.querySelector(".vigna-modal-close")?.focus();
}

function closeModal(modal) {
  if (!modal) return;

  modal.classList.remove("is-open");
  document.body.classList.remove("vigna-modal-open");

  window.setTimeout(() => {
    modal.hidden = true;
  }, 180);
}

catalogContainer?.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-add-cart]");

  if (addButton) {
    addToCart(findProduct(addButton.dataset.addCart));
    return;
  }

  const detailButton = event.target.closest("[data-product-detail]");

  if (detailButton) {
    openProductDetail(detailButton.dataset.productDetail);
  }
});

productModal?.addEventListener("click", (event) => {
  const addButton = event.target.closest("[data-modal-add]");

  if (!addButton) return;

  addToCart(findProduct(addButton.dataset.modalAdd));
});

cartButton?.addEventListener("click", () => {
  renderCart();
  openModal(cartModal);
});

cartModal?.addEventListener("click", (event) => {
  const decreaseButton = event.target.closest("[data-cart-decrease]");
  const increaseButton = event.target.closest("[data-cart-increase]");
  const removeButton = event.target.closest("[data-cart-remove]");

  if (decreaseButton) {
    changeCartQuantity(decreaseButton.dataset.cartDecrease, -1);
    return;
  }

  if (increaseButton) {
    changeCartQuantity(increaseButton.dataset.cartIncrease, 1);
    return;
  }

  if (removeButton) {
    removeCartItem(removeButton.dataset.cartRemove);
  }
});

document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close-modal]");

  if (closeButton) {
    closeModal(closeButton.closest(".vigna-modal"));
    return;
  }

  if (
    event.target.classList.contains("vigna-modal") &&
    event.target.classList.contains("is-open")
  ) {
    closeModal(event.target);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  document
    .querySelectorAll(".vigna-modal.is-open")
    .forEach(closeModal);
});

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

    syncCartWithCatalog();
    renderProducts();
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);

    showCatalogMessage(
      "No fue posible cargar el catálogo",
      "Actualiza la página para intentarlo nuevamente."
    );
  }
}

function installMarketplaceUi() {
  if (!document.querySelector("#vignaMarketplaceStyles")) {
    const style = document.createElement("style");
    style.id = "vignaMarketplaceStyles";
    style.textContent = `
      body.vigna-modal-open {
        overflow: hidden;
      }

      .vigna-catalog-ready {
        display: block !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
      }

      .vigna-product-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 22px;
        width: 100%;
      }

      .vigna-product-card {
        overflow: hidden;
        border: 1px solid rgba(212, 175, 55, .45);
        border-radius: 20px;
        background: #050b08;
        box-shadow: 0 16px 38px rgba(0, 0, 0, .28);
      }

      .vigna-product-image-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        height: 250px;
        padding: 14px;
        border: 0;
        background: #fff;
        cursor: pointer;
      }

      .vigna-product-image-button img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        border-radius: 12px;
      }

      .vigna-product-image-button span {
        color: #53625a;
      }

      .vigna-product-information {
        padding: 20px;
      }

      .vigna-product-category {
        display: inline-block;
        margin-bottom: 12px;
        color: #21df8b;
        font-size: .76rem;
        font-weight: 800;
        letter-spacing: .12em;
        text-transform: uppercase;
      }

      .vigna-product-information h3 {
        margin: 0 0 8px;
        color: #d4af37;
        font-size: 1.28rem;
      }

      .vigna-product-price,
      .vigna-detail-price {
        margin: 0 0 12px;
        color: #fff;
        font-size: 1.25rem;
        font-weight: 800;
      }

      .vigna-product-description,
      .vigna-detail-description {
        margin: 0 0 14px;
        color: #bdc8c1;
        line-height: 1.55;
      }

      .vigna-product-meta {
        padding-top: 14px;
        border-top: 1px solid rgba(255, 255, 255, .12);
        color: #fff;
        font-size: .9rem;
      }

      .vigna-product-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 18px;
      }

      .vigna-button {
        min-height: 44px;
        padding: 11px 18px;
        border: 1px solid transparent;
        border-radius: 12px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
      }

      .vigna-button-primary {
        background: #21df8b;
        color: #03120b;
      }

      .vigna-button-secondary {
        border-color: #d4af37;
        background: transparent;
        color: #f3d264;
      }

      .vigna-button:disabled {
        cursor: not-allowed;
        opacity: .48;
      }

      .vigna-modal[hidden] {
        display: none;
      }

      .vigna-modal {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(0, 0, 0, .82);
        opacity: 0;
        transition: opacity .18s ease;
      }

      .vigna-modal.is-open {
        opacity: 1;
      }

      .vigna-modal-panel {
        position: relative;
        width: min(960px, 100%);
        max-height: min(820px, 92vh);
        overflow: auto;
        padding: 28px;
        border: 1px solid rgba(212, 175, 55, .55);
        border-radius: 22px;
        background: #07100b;
        box-shadow: 0 24px 70px rgba(0, 0, 0, .65);
        transform: translateY(14px);
        transition: transform .18s ease;
      }

      .vigna-modal.is-open .vigna-modal-panel {
        transform: translateY(0);
      }

      .vigna-modal-close {
        position: absolute;
        top: 14px;
        right: 14px;
        z-index: 2;
        width: 42px;
        height: 42px;
        border: 1px solid rgba(255, 255, 255, .22);
        border-radius: 50%;
        background: #111b15;
        color: #fff;
        font-size: 1.5rem;
        cursor: pointer;
      }

      .vigna-detail-grid {
        display: grid;
        grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
        gap: 30px;
        align-items: center;
      }

      .vigna-detail-image {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 390px;
        padding: 20px;
        border-radius: 18px;
        background: #fff;
        color: #53625a;
      }

      .vigna-detail-image img {
        width: 100%;
        max-height: 440px;
        object-fit: contain;
      }

      .vigna-detail-information {
        padding-right: 12px;
      }

      .vigna-detail-information h2 {
        margin: 0 0 12px;
        color: #f3d264;
        font-family: Georgia, serif;
        font-size: clamp(2rem, 4vw, 3.2rem);
        line-height: 1;
      }

      .vigna-detail-price {
        font-size: 1.7rem;
      }

      .vigna-detail-list {
        margin: 22px 0;
        color: #fff;
      }

      .vigna-detail-list div {
        display: grid;
        grid-template-columns: 120px 1fr;
        gap: 12px;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255, 255, 255, .12);
      }

      .vigna-detail-list dt {
        color: #8fa096;
        font-weight: 700;
      }

      .vigna-detail-list dd {
        margin: 0;
      }

      .vigna-detail-add {
        width: 100%;
      }

      .vigna-cart-title {
        margin: 0 0 22px;
        color: #f3d264;
        font-family: Georgia, serif;
        font-size: 2.2rem;
      }

      .vigna-cart-items {
        display: grid;
        gap: 14px;
      }

      .vigna-cart-item {
        display: grid;
        grid-template-columns: 92px 1fr auto;
        gap: 16px;
        align-items: center;
        padding: 14px;
        border: 1px solid rgba(255, 255, 255, .12);
        border-radius: 16px;
        background: #030805;
      }

      .vigna-cart-image {
        display: grid;
        place-items: center;
        width: 92px;
        height: 92px;
        overflow: hidden;
        border-radius: 12px;
        background: #fff;
        color: #07100b;
        font-weight: 900;
      }

      .vigna-cart-image img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .vigna-cart-information h3 {
        margin: 0 0 5px;
        color: #fff;
      }

      .vigna-cart-information p {
        margin: 0 0 6px;
        color: #9eaaa3;
      }

      .vigna-cart-information strong,
      .vigna-cart-line-total {
        color: #f3d264;
      }

      .vigna-quantity-controls {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
        margin-top: 12px;
      }

      .vigna-quantity-controls button {
        min-width: 36px;
        min-height: 36px;
        border: 1px solid rgba(255, 255, 255, .2);
        border-radius: 9px;
        background: #132019;
        color: #fff;
        font-weight: 800;
        cursor: pointer;
      }

      .vigna-quantity-controls button:disabled {
        cursor: not-allowed;
        opacity: .4;
      }

      .vigna-quantity-controls .vigna-remove-button {
        padding-inline: 12px;
        border-color: rgba(210, 71, 71, .55);
        color: #ff9999;
      }

      .vigna-cart-summary {
        display: grid;
        gap: 14px;
        margin-top: 22px;
        padding-top: 20px;
        border-top: 1px solid rgba(212, 175, 55, .4);
      }

      .vigna-cart-summary > div {
        display: flex;
        justify-content: space-between;
        color: #fff;
        font-size: 1.3rem;
      }

      .vigna-cart-summary > div strong {
        color: #f3d264;
      }

      .vigna-cart-summary p {
        margin: 0;
        color: #9eaaa3;
        font-size: .9rem;
      }

      .vigna-empty-cart {
        padding: 54px 20px;
        text-align: center;
      }

      .vigna-empty-cart > span {
        display: grid;
        place-items: center;
        width: 70px;
        height: 70px;
        margin: 0 auto 18px;
        border: 1px solid #d4af37;
        border-radius: 50%;
        color: #f3d264;
        font-family: Georgia, serif;
        font-size: 2rem;
      }

      .vigna-empty-cart h2 {
        margin: 0 0 8px;
        color: #fff;
      }

      .vigna-empty-cart p {
        margin: 0 0 22px;
        color: #9eaaa3;
      }

      .vigna-toast {
        position: fixed;
        left: 50%;
        bottom: 24px;
        z-index: 10050;
        max-width: calc(100% - 32px);
        padding: 13px 20px;
        border: 1px solid rgba(33, 223, 139, .5);
        border-radius: 12px;
        background: #0a1710;
        color: #fff;
        box-shadow: 0 14px 36px rgba(0, 0, 0, .5);
        opacity: 0;
        pointer-events: none;
        transform: translate(-50%, 18px);
        transition: opacity .2s ease, transform .2s ease;
      }

      .vigna-toast.is-visible {
        opacity: 1;
        transform: translate(-50%, 0);
      }

      .vigna-catalog-ready .vigna-product-category {
        display: inline-block !important;
        width: auto !important;
        height: auto !important;
        margin: 0 0 12px !important;
        padding: 0 !important;
        border: 0 !important;
        background: transparent !important;
        color: #21df8b !important;
        font-family: inherit !important;
        font-size: .76rem !important;
        font-weight: 800 !important;
        line-height: 1.2 !important;
        letter-spacing: .12em !important;
        text-transform: uppercase !important;
      }

      @media (max-width: 720px) {
        .vigna-product-grid {
          grid-template-columns: 1fr;
        }

        .vigna-detail-grid {
          grid-template-columns: 1fr;
        }

        .vigna-detail-image {
          min-height: 260px;
        }

        .vigna-modal {
          padding: 10px;
        }

        .vigna-modal-panel {
          max-height: 94vh;
          padding: 20px;
          padding-top: 64px;
          border-radius: 16px;
        }

        .vigna-cart-item {
          grid-template-columns: 72px 1fr;
        }

        .vigna-cart-image {
          width: 72px;
          height: 72px;
        }

        .vigna-cart-line-total {
          grid-column: 2;
        }

        .vigna-product-actions .vigna-button {
          flex: 1 1 145px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  if (!document.querySelector("#productModal")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `
        <div
          class="vigna-modal"
          id="productModal"
          role="dialog"
          aria-modal="true"
          aria-label="Detalle del producto"
          hidden
        >
          <div class="vigna-modal-panel">
            <button
              type="button"
              class="vigna-modal-close"
              data-close-modal
              aria-label="Cerrar detalle"
            >
              ×
            </button>
            <div id="productModalContent"></div>
          </div>
        </div>

        <div
          class="vigna-modal"
          id="cartModal"
          role="dialog"
          aria-modal="true"
          aria-label="Carrito de compras"
          hidden
        >
          <div class="vigna-modal-panel">
            <button
              type="button"
              class="vigna-modal-close"
              data-close-modal
              aria-label="Cerrar carrito"
            >
              ×
            </button>
            <div id="cartModalContent"></div>
          </div>
        </div>
      `
    );
  }
}

loadPublishedProducts();