import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("productForm");
const formMessage = document.getElementById("formMessage");
const productsList = document.getElementById("productsList");
const productsSection = document.getElementById("productsSection");
const sellerNameBox = document.getElementById("sellerName");

let currentUser = null;
let sellerApplication = null;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `mensaje ${type}`;
  formMessage.hidden = false;
}

async function loadProducts() {
  productsList.innerHTML = '<div class="vacio">Cargando productos...</div>';

  try {
    const productsQuery = query(
      collection(db, "products"),
      where("sellerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(productsQuery);

    if (snapshot.empty) {
      productsList.innerHTML =
        '<div class="vacio">Todavía no registraste productos.</div>';
      return;
    }

    const products = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    productsList.innerHTML = products.map((product) => `
      <article class="producto">
        <div class="producto-cabecera">
          <div>
            <h3>${escapeHtml(product.name)}</h3>
            <strong>SKU: ${escapeHtml(product.sku)}</strong>
          </div>

          <span class="estado">Borrador</span>
        </div>

        <div class="detalles">
          Categoría: ${escapeHtml(product.category)}<br>
          Precio: S/ ${Number(product.price).toFixed(2)}<br>
          Stock: ${Number(product.stock)}
        </div>

        <button
          class="eliminar"
          type="button"
          data-delete-id="${escapeHtml(product.id)}">
          Eliminar borrador
        </button>
      </article>
    `).join("");
  } catch (error) {
    console.error("Error al cargar productos:", error);
    productsList.innerHTML =
      '<div class="mensaje error">No fue posible cargar tus productos.</div>';
  }
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login-vendedor");
    return;
  }

  currentUser = user;

  try {
    const applicationSnapshot = await getDoc(
      doc(db, "sellerApplications", user.uid)
    );

    if (!applicationSnapshot.exists()) {
      window.location.replace("login-vendedor");
      return;
    }

    sellerApplication = applicationSnapshot.data();

    if (sellerApplication.status !== "approved") {
      window.location.replace("panel-vendedor");
      return;
    }

    sellerNameBox.textContent =
      `${sellerApplication.businessName}: administra aquí tus productos en borrador.`;

    productsSection.hidden = false;
    await loadProducts();
  } catch (error) {
    console.error("Error al verificar vendedor:", error);
    sellerNameBox.textContent =
      "No fue posible verificar la cuenta de vendedor.";
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.hidden = true;

  if (!currentUser || sellerApplication?.status !== "approved") {
    showMessage("Tu cuenta no tiene autorización para registrar productos.", "error");
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  const price = Number(document.getElementById("productPrice").value);
  const stock = Number(document.getElementById("productStock").value);

  if (!Number.isFinite(price) || price < 0) {
    showMessage("Ingresa un precio válido.", "error");
    return;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    showMessage("Ingresa una cantidad de stock válida.", "error");
    return;
  }

  button.disabled = true;
  button.textContent = "Guardando producto...";

  try {
    await addDoc(collection(db, "products"), {
      sellerId: currentUser.uid,
      sellerName: sellerApplication.businessName,
      name: document.getElementById("productName").value.trim(),
      sku: document.getElementById("productSku").value.trim().toUpperCase(),
      category: document.getElementById("productCategory").value,
      description: document.getElementById("productDescription").value.trim(),
      price,
      stock,
      status: "draft",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    form.reset();
    showMessage("Producto guardado correctamente como borrador.", "success");
    await loadProducts();
  } catch (error) {
    console.error("Error al guardar producto:", error);
    showMessage("No fue posible guardar el producto.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Guardar producto como borrador";
  }
});

productsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-delete-id]");
  if (!button) return;

  if (!window.confirm("¿Confirmas que deseas eliminar este borrador?")) return;

  button.disabled = true;

  try {
    await deleteDoc(doc(db, "products", button.dataset.deleteId));
    await loadProducts();
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    window.alert("No fue posible eliminar el borrador.");
    button.disabled = false;
  }
});