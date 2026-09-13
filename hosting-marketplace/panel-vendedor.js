import { auth, db } from "./firebase-config.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const loadingBox = document.getElementById("loadingBox");
const errorBox = document.getElementById("errorBox");
const sellerPanel = document.getElementById("sellerPanel");
const logoutButton = document.getElementById("logoutButton");
const productsButton = document.getElementById("productsButton");

function showError(message) {
  loadingBox.hidden = true;
  sellerPanel.hidden = true;
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function setText(id, value) {
  document.getElementById(id).textContent = value || "—";
}

function renderStatus(application) {
  const statusBox = document.getElementById("statusBox");
  const reviewStep = document.getElementById("reviewStep");
  const publicationStep = document.getElementById("publicationStep");
  const productsNotice = document.getElementById("productsNotice");

  if (application.status === "approved") {
    statusBox.textContent =
      "Tu solicitud fue aprobada por VIGNA. Tu cuenta de vendedor está activa.";

    reviewStep.textContent = "2. Solicitud aprobada";
    publicationStep.classList.add("activo");
    publicationStep.textContent = "3. Cuenta habilitada";

    productsButton.disabled = true;
    productsButton.textContent = "Módulo de productos en preparación";
    productsNotice.textContent =
      "Tu cuenta está aprobada. El módulo de productos será conectado en el siguiente paso.";
    return;
  }

  if (application.status === "rejected") {
    statusBox.textContent =
      "Tu solicitud requiere correcciones. VIGNA revisará contigo la información necesaria.";

    statusBox.style.borderColor = "#a33";
    statusBox.style.color = "#ff8c8c";
    statusBox.style.background = "rgba(120, 25, 25, .18)";
    reviewStep.textContent = "2. Correcciones requeridas";
    return;
  }

  statusBox.textContent =
    "Tu solicitud está pendiente de revisión por VIGNA. Todavía no puedes publicar productos.";

  reviewStep.textContent = "2. Revisión en proceso";
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.replace("login-vendedor");
    return;
  }

  try {
    const applicationReference = doc(db, "sellerApplications", user.uid);
    const applicationSnapshot = await getDoc(applicationReference);

    if (!applicationSnapshot.exists()) {
      await signOut(auth);
      showError("Esta cuenta no tiene una solicitud de vendedor registrada.");
      return;
    }

    const application = applicationSnapshot.data();

    setText("welcomeTitle", `Bienvenido, ${application.businessName || "vendedor"}`);
    setText("businessName", application.businessName);
    setText("legalName", application.legalName);
    setText("representativeName", application.representativeName);
    setText("sellerEmail", application.email || user.email);
    setText("sellerPhone", application.phone);

    renderStatus(application);

    loadingBox.hidden = true;
    errorBox.hidden = true;
    sellerPanel.hidden = false;
  } catch (error) {
    console.error("Error al cargar el panel:", error);
    showError("No fue posible cargar la información del vendedor.");
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;

  try {
    await signOut(auth);
    window.location.replace("login-vendedor");
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    logoutButton.disabled = false;
  }
});