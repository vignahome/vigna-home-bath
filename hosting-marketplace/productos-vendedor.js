import { auth, db, storage } from "./firebase-config.js";

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

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const MAX_ORIGINAL_IMAGE_BYTES = 5 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 500 * 1024;
const MAX_IMAGE_DIMENSION = 1200;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

const form = document.getElementById("productForm");
const formMessage = document.getElementById("formMessage");
const productsList = document.getElementById("productsList");
const productsSection = document.getElementById("productsSection");
const sellerNameBox = document.getElementById("sellerName");
const submitButton = form.querySelector('button[type="submit"]');

const imageInput = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");
const imagePreviewPhoto = document.getElementById("imagePreviewPhoto");
const imagePreviewInfo = document.getElementById("imagePreviewInfo");

let currentUser = null;
let sellerApplication = null;
let editingProductId = null;
let loadedProducts = [];

let selectedImageBlob = null;
let selectedImageObjectUrl = null;
let imageProcessing = false;
let imageSelectionVersion = 0;

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

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return `${Math.round(bytes / 1024)} KB`;
}

function revokeSelectedImageUrl() {
  if (selectedImageObjectUrl) {
    URL.revokeObjectURL(selectedImageObjectUrl);
    selectedImageObjectUrl = null;
  }
}

function resetImageField() {
  imageSelectionVersion += 1;
  imageProcessing = false;
  selectedImageBlob = null;
  revokeSelectedImageUrl();

  imageInput.value = "";
  imagePreview.hidden = true;
  imagePreviewPhoto.removeAttribute("src");
  imagePreviewInfo.textContent = "";
}

function showExistingImage(product) {
  resetImageField();

  if (!product.imageUrl) return;

  imagePreviewPhoto.src = product.imageUrl;
  imagePreviewInfo.textContent =
    "Esta es la imagen actual. Selecciona otra solamente si deseas reemplazarla.";
  imagePreview.hidden = false;
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const temporaryUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(temporaryUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(temporaryUrl);
      reject(new Error("No fue posible leer la imagen seleccionada."));
    };

    image.src = temporaryUrl;
  });
}

function canvasToWebp(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No fue posible comprimir la imagen."));
          return;
        }

        resolve(blob);
      },
      "image/webp",
      quality
    );
  });
}

async function compressImage(file) {
  const sourceImage = await loadImage(file);

  let width = sourceImage.naturalWidth;
  let height = sourceImage.naturalHeight;

  if (!width || !height) {
    throw new Error("La imagen no tiene dimensiones válidas.");
  }

  const initialScale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(width, height)
  );

  width = Math.max(1, Math.round(width * initialScale));
  height = Math.max(1, Math.round(height * initialScale));

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", {
    alpha: true
  });

  if (!context) {
    throw new Error("El navegador no pudo preparar la compresión.");
  }

  let quality = 0.82;
  let compressedBlob = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    canvas.width = width;
    canvas.height = height;

    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(sourceImage, 0, 0, width, height);

    compressedBlob = await canvasToWebp(canvas, quality);

    if (compressedBlob.size <= TARGET_IMAGE_BYTES) {
      break;
    }

    if (quality > 0.5) {
      quality = Math.max(0.5, quality - 0.07);
      continue;
    }

    if (Math.max(width, height) > 640) {
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
      quality = 0.7;
      continue;
    }

    break;
  }

  if (!compressedBlob) {
    throw new Error("No fue posible generar la imagen comprimida.");
  }

  if (compressedBlob.size > MAX_ORIGINAL_IMAGE_BYTES) {
    throw new Error("La imagen comprimida continúa siendo demasiado pesada.");
  }

  return compressedBlob;
}

async function uploadProductImage(productId, imageBlob) {
  const imagePath =
    `product-images/${currentUser.uid}/${productId}/main-${Date.now()}.webp`;

  const imageReference = ref(storage, imagePath);

  await uploadBytes(imageReference, imageBlob, {
    contentType: "image/webp",
    cacheControl: "public,max-age=31536000,immutable",
    customMetadata: {
      sellerId: currentUser.uid,
      productId
    }
  });

  const imageUrl = await getDownloadURL(imageReference);

  return {
    imagePath,
    imageUrl
  };
}

async function removeStoredImage(imagePath) {
  if (!imagePath) return;

  try {
    await deleteObject(ref(storage, imagePath));
  } catch (error) {
    if (error?.code !== "storage/object-not-found") {
      console.warn("No fue posible eliminar la imagen anterior:", error);
    }
  }
}

function finishEditing() {
  editingProductId = null;
  form.reset();
  resetImageField();
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
  document.getElementById("productDescription").value =
    product.description || "";

  showExistingImage(product);

  submitButton.textContent = "Guardar cambios";
  cancelEditButton.hidden = false;
  formMessage.hidden = true;

  form.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function loadProducts() {
  productsList.innerHTML =
    '<div class="vacio">Cargando productos...</div>';

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
        ${
          product.imageUrl
            ? `
              <img
                src="${escapeHtml(product.imageUrl)}"
                alt="${escapeHtml(product.name)}"
                loading="lazy"
                style="
                  display:block;
                  width:100%;
                  height:220px;
                  margin-bottom:18px;
                  object-fit:contain;
                  background:#ffffff;
                  border-radius:12px;
                ">
            `
            : `
              <div style="
                display:grid;
                place-items:center;
                width:100%;
                height:150px;
                margin-bottom:18px;
                color:#829087;
                background:#06100b;
                border:1px dashed #314139;
                border-radius:12px;
              ">
                Producto sin imagen
              </div>
            `
        }

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
            style="
              padding:12px 18px;
              border:0;
              border-radius:10px;
              background:#21df8b;
              color:#00130b;
              font-weight:700;
              cursor:pointer;
            ">
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

imageInput.addEventListener("change", async () => {
  const file = imageInput.files?.[0] || null;
  const requestVersion = ++imageSelectionVersion;

  selectedImageBlob = null;
  revokeSelectedImageUrl();

  if (!file) {
    imagePreview.hidden = true;
    imagePreviewPhoto.removeAttribute("src");
    imagePreviewInfo.textContent = "";
    return;
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    imageInput.value = "";
    showMessage(
      "Selecciona una imagen JPG, PNG o WebP.",
      "error"
    );
    return;
  }

  if (file.size > MAX_ORIGINAL_IMAGE_BYTES) {
    imageInput.value = "";
    showMessage(
      "La imagen original supera el máximo permitido de 5 MB.",
      "error"
    );
    return;
  }

  imageProcessing = true;
  formMessage.hidden = true;
  imagePreviewPhoto.removeAttribute("src");
  imagePreviewInfo.textContent = "Comprimiendo imagen automáticamente...";
  imagePreview.hidden = false;

  try {
    const compressedBlob = await compressImage(file);

    if (requestVersion !== imageSelectionVersion) return;

    selectedImageBlob = compressedBlob;
    selectedImageObjectUrl = URL.createObjectURL(compressedBlob);
    imagePreviewPhoto.src = selectedImageObjectUrl;
    imagePreviewInfo.textContent =
      `Imagen preparada: ${formatBytes(file.size)} → ` +
      `${formatBytes(compressedBlob.size)} en formato WebP.`;
  } catch (error) {
    if (requestVersion !== imageSelectionVersion) return;

    console.error("Error al comprimir imagen:", error);
    imageInput.value = "";
    imagePreview.hidden = true;
    showMessage(
      error.message || "No fue posible preparar la imagen.",
      "error"
    );
  } finally {
    if (requestVersion === imageSelectionVersion) {
      imageProcessing = false;
    }
  }
});

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

  if (imageProcessing) {
    showMessage(
      "Espera unos segundos mientras termina la compresión de la imagen.",
      "error"
    );
    return;
  }

  if (!editingProductId && !selectedImageBlob) {
    showMessage(
      "Selecciona la imagen principal del producto.",
      "error"
    );
    return;
  }

  const price = Number(
    document.getElementById("productPrice").value
  );

  const stock = Number(
    document.getElementById("productStock").value
  );

  if (!Number.isFinite(price) || price < 0) {
    showMessage("Ingresa un precio válido.", "error");
    return;
  }

  if (!Number.isInteger(stock) || stock < 0) {
    showMessage(
      "Ingresa una cantidad de stock válida.",
      "error"
    );
    return;
  }

  const productData = {
    sellerName: sellerApplication.businessName,
    name: document.getElementById("productName").value.trim(),
    sku: document.getElementById("productSku").value
      .trim()
      .toUpperCase(),
    category: document.getElementById("productCategory").value,
    description: document.getElementById("productDescription").value
      .trim(),
    price,
    stock,
    updatedAt: serverTimestamp()
  };

  const productIdBeingEdited = editingProductId;

  const existingProduct = loadedProducts.find(
    (product) => product.id === productIdBeingEdited
  );

  submitButton.disabled = true;
  imageInput.disabled = true;

  submitButton.textContent = productIdBeingEdited
    ? "Guardando cambios..."
    : "Comprimiendo y subiendo producto...";

  try {
    if (productIdBeingEdited) {
      let uploadedImage = null;

      if (selectedImageBlob) {
        uploadedImage = await uploadProductImage(
          productIdBeingEdited,
          selectedImageBlob
        );
      }

      try {
        await updateDoc(
          doc(db, "products", productIdBeingEdited),
          {
            ...productData,
            ...(uploadedImage || {})
          }
        );
      } catch (error) {
        if (uploadedImage?.imagePath) {
          await removeStoredImage(uploadedImage.imagePath);
        }

        throw error;
      }

      if (
        uploadedImage?.imagePath &&
        existingProduct?.imagePath &&
        existingProduct.imagePath !== uploadedImage.imagePath
      ) {
        await removeStoredImage(existingProduct.imagePath);
      }

      finishEditing();
      showMessage(
        uploadedImage
          ? "Producto e imagen actualizados correctamente."
          : "Producto actualizado correctamente.",
        "success"
      );
    } else {
      let createdProductReference = null;
      let uploadedImage = null;

      try {
        createdProductReference = await addDoc(
          collection(db, "products"),
          {
            sellerId: currentUser.uid,
            ...productData,
            status: "draft",
            createdAt: serverTimestamp()
          }
        );

        uploadedImage = await uploadProductImage(
          createdProductReference.id,
          selectedImageBlob
        );

        await updateDoc(createdProductReference, {
          ...uploadedImage,
          updatedAt: serverTimestamp()
        });
      } catch (error) {
        if (uploadedImage?.imagePath) {
          await removeStoredImage(uploadedImage.imagePath);
        }

        if (createdProductReference) {
          await deleteDoc(createdProductReference).catch(() => {});
        }

        throw error;
      }

      form.reset();
      resetImageField();

      showMessage(
        "Producto e imagen guardados correctamente como borrador.",
        "success"
      );
    }

    await loadProducts();
  } catch (error) {
    console.error("Error al guardar producto:", error);

    showMessage(
      productIdBeingEdited
        ? "No fue posible actualizar el producto."
        : "No fue posible guardar el producto y su imagen.",
      "error"
    );
  } finally {
    submitButton.disabled = false;
    imageInput.disabled = false;

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

  const deleteButton = event.target.closest(
    "button[data-delete-id]"
  );

  if (!deleteButton) return;

  if (!window.confirm("¿Confirmas que deseas eliminar este borrador?")) {
    return;
  }

  const productId = deleteButton.dataset.deleteId;

  const productToDelete = loadedProducts.find(
    (product) => product.id === productId
  );

  deleteButton.disabled = true;

  try {
    await deleteDoc(doc(db, "products", productId));

    if (productToDelete?.imagePath) {
      await removeStoredImage(productToDelete.imagePath);
    }

    if (editingProductId === productId) {
      finishEditing();
    }

    await loadProducts();
  } catch (error) {
    console.error("Error al eliminar producto:", error);
    window.alert("No fue posible eliminar el borrador.");
    deleteButton.disabled = false;
  }
});

window.addEventListener("beforeunload", () => {
  revokeSelectedImageUrl();
});