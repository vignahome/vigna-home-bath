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
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("productForm");
const formMessage = document.getElementById("formMessage");
const productsList = document.getElementById("productsList");
const productsSection = document.getElementById("productsSection");
const sellerNameBox = document.getElementById("sellerName");
const submitButton = form.querySelector('button[type="submit"]');

let currentUser = null;
let sellerApplication = null;
let editingProductId = null;
let loadedProducts = [];

const cancelEditButton = document.createElement("button");
cancelEditButton.type = "button";
cancelEditButton.textContent = "Cancelar edición";
cancelEditButton.hidden = true;
cancelEditButton.style.marginTop = "12px";
cancelEditButton.style.width = "100%";
cancelEditButton.style.padding = "16px";
cancelEditButton.style.border = "1px solid #a62e2e";
cancelEditButton.style.borderRadius = "10px";
cancelEditButton.style.background = "#a62e2e";
cancelEditButton.style.color = "#ffffff";
cancelEditButton.style.fontWeight = "700";
cancelEditButton.style.cursor = "pointer";
submitButton.insertAdjacentElement("afterend", cancelEditButton);

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

function finishEditing() {
  editingProductId = null;
  form.reset();
  submitButton.textContent = "Guardar producto como borrador";
  cancelEditButton.hidden = true;
}

function startEditing(productId) {
  const product = loadedProducts.find((item) => item.id === productId);
  if (!product) return;

  editingProductId = product.id;

  document.getElementById("productName").value = product.name || "";
  document.getElementById("productSku").value = product.sku || "";
  document.getElementById("productCategory").value = product.category || "";
  document.getElementById("productPrice").value = product.price ?? "";
  document.getElementById("productStock").value = product.stock ?? "";
  document.getElementById("productDescription").value = product.description || "";

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.hidden = false;
  formMessage.hidden = true;

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function loadProducts() {
  productsList.innerHTML = '<div class="vacio">Cargando productos...</div>';

  try {
    const productsQuery = query(
      collection(db, "products"),
      where("sellerId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(productsQuery);

    loadedProducts = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    if (loadedProducts.length === 0) {
      productsList.innerHTML =
        '<div class="vacio">Todavía no registraste productos.</div>';
      return;
    }

    productsList.innerHTML = loadedProducts.map((product) => `
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

        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button
            type="button"
            data-edit-id="${escapeHtml(product.id)}"
            style="padding:12px 18px; border:0; border-radius:10px; background:#21df8b; color:#00130b; font-weight:700; cursor:pointer;">
            Editar producto
          </button>

          <button
            class="eliminar"
            type="button"
            data-delete-id="${escapeHtml(product.id)}">
            Eliminar borrador
          </button>
        </div>
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
    showMessage(
      "Tu cuenta no tiene autorización para registrar productos.",
      "error"
    );
    return;
  }

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

  const productData = {
    sellerName: sellerApplication.businessName,
    name: document.getElementById("productName").value.trim(),
    sku: document.getElementById("productSku").value.trim().toUpperCase(),
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDescription").value.trim(),
    price,
    stock,
    updatedAt: serverTimestamp()
  };

  submitButton.disabled = true;
  submitButton.textContent = editingProductId
    ? "Guardando cambios..."
    : "Guardando producto...";

  try {
    if (editingProductId) {
      await updateDoc(
        doc(db, "products", editingProductId),
        productData
      );

      finishEditing();
      showMessage("Producto actualizado correctamente.", "success");
    } else {
      await addDoc(collection(db, "products"), {
        sellerId: currentUser.uid,
        ...productData,
        status: "draft",
        createdAt: serverTimestamp()
      });

      form.reset();
      showMessage(
        "Producto guardado correctamente como borrador.",
        "success"
      );
    }

    await loadProducts();
  } catch (error) {
    console.error("Error al guardar producto:", error);
    showMessage(
      editingProductId
        ? "No fue posible actualizar el producto."
        : "No fue posible guardar el producto.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = editingProductId
      ? "Guardar cambios"
      : "Guardar producto como borrador";
  }
});

cancelEditButton.addEventListener("click", () => {
  finishEditing();
  formMessage.hidden = true;
});

productsList.addEventListener("click", async (event) => {
  const editButton = event.target.closest("button[data-edit-id]");

  if (editButton) {
    startEditing(editButton.dataset.editId);
    return;
  }

  const deleteButton = event.target.closest("button[data-delete-id]");
  if (!deleteButton) return;

  if (!window.confirm("¿Confirmas que deseas eliminar este borrador?")) {
    return;
  }

  deleteButton.disabled = true;

  try {
    await deleteDoc(
      doc(db, "products", deleteButton.dataset.deleteId)
    );

    if (editingProductId === deleteButton.dataset.deleteId) {
      finishEditing();
    }

    await loadProducts();
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    window.alert("No fue posible eliminar el borrador.");
    deleteButton.disabled = false;
  }
});