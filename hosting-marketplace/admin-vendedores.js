import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const ADMIN_EMAIL = "vignahome@vignahome.com";

const loginSection = document.getElementById("loginSection");
const adminPanel = document.getElementById("adminPanel");
const loginForm = document.getElementById("adminLoginForm");
const loginMessage = document.getElementById("loginMessage");
const logoutButton = document.getElementById("logoutButton");
const summaryBox = document.getElementById("summaryBox");
const applicationsList = document.getElementById("applicationsList");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showLoginMessage(message) {
  loginMessage.textContent = message;
  loginMessage.hidden = false;
}

function statusLabel(status) {
  if (status === "approved") return "Aprobado";
  if (status === "rejected") return "Requiere correcciones";
  return "Pendiente";
}

async function loadApplications() {
  summaryBox.textContent = "Cargando solicitudes...";
  applicationsList.innerHTML = "";

  try {
    const snapshot = await getDocs(collection(db, "sellerApplications"));
    const applications = snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data()
    }));

    const pending = applications.filter(
      (application) => application.status === "pending"
    ).length;

    summaryBox.textContent =
      `${applications.length} solicitud(es) registrada(s). ${pending} pendiente(s) de revisión.`;

    if (!applications.length) {
      applicationsList.innerHTML =
        '<div class="solicitud">No existen solicitudes registradas.</div>';
      return;
    }

    applicationsList.innerHTML = applications.map((application) => `
      <article class="solicitud">
        <div class="solicitud-cabecera">
          <div>
            <h2>${escapeHtml(application.businessName || "Sin nombre")}</h2>
            <div>${escapeHtml(application.legalName || "Sin razón social")}</div>
          </div>

          <div class="estado">${statusLabel(application.status)}</div>
        </div>

        <div class="datos">
          <div class="dato">
            <span>Representante</span>
            <strong>${escapeHtml(application.representativeName || "—")}</strong>
          </div>

          <div class="dato">
            <span>Correo</span>
            <strong>${escapeHtml(application.email || "—")}</strong>
          </div>

          <div class="dato">
            <span>Teléfono</span>
            <strong>${escapeHtml(application.phone || "—")}</strong>
          </div>

          <div class="dato">
            <span>País</span>
            <strong>Perú</strong>
          </div>

          <div class="dato">
            <span>Categoría</span>
            <strong>${escapeHtml(application.productCategory || "—")}</strong>
          </div>

          <div class="dato">
            <span>Tipo de vendedor</span>
            <strong>${escapeHtml(application.sellerType || "—")}</strong>
          </div>
        </div>

        <div class="acciones">
          <button
            class="aprobar"
            type="button"
            data-id="${escapeHtml(application.id)}"
            data-status="approved">
            Aprobar vendedor
          </button>

          <button
            class="rechazar"
            type="button"
            data-id="${escapeHtml(application.id)}"
            data-status="rejected">
            Solicitar correcciones
          </button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    console.error("Error al cargar solicitudes:", error);
    summaryBox.textContent =
      "No fue posible cargar las solicitudes. Verifica la sesión administrativa.";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.hidden = true;

  const email = document.getElementById("adminEmail").value.trim().toLowerCase();
  const password = document.getElementById("adminPassword").value;
  const button = loginForm.querySelector('button[type="submit"]');

  if (email !== ADMIN_EMAIL) {
    showLoginMessage("Este correo no tiene autorización administrativa.");
    return;
  }

  button.disabled = true;
  button.textContent = "Verificando...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error de acceso administrativo:", error);
    showLoginMessage("El correo o la contraseña son incorrectos.");
  } finally {
    button.disabled = false;
    button.textContent = "Ingresar como administrador";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
    if (user) await signOut(auth);

    loginSection.hidden = false;
    adminPanel.hidden = true;
    logoutButton.hidden = true;
    return;
  }

  loginSection.hidden = true;
  adminPanel.hidden = false;
  logoutButton.hidden = false;
  await loadApplications();
});

applicationsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-id][data-status]");
  if (!button) return;

  const sellerId = button.dataset.id;
  const nextStatus = button.dataset.status;

  const confirmationText = nextStatus === "approved"
    ? "¿Confirmas que deseas aprobar a este vendedor?"
    : "¿Confirmas que deseas solicitar correcciones?";

  if (!window.confirm(confirmationText)) return;

  button.disabled = true;

  try {
    await updateDoc(doc(db, "sellerApplications", sellerId), {
      status: nextStatus,
      reviewedAt: serverTimestamp(),
      reviewedBy: ADMIN_EMAIL
    });

    await loadApplications();
  } catch (error) {
    console.error("Error al actualizar la solicitud:", error);
    window.alert("No fue posible actualizar la solicitud.");
    button.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await signOut(auth);
});