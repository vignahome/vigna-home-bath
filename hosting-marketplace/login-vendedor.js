import { auth, db } from "./firebase-config.js";
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("sellerLoginForm");
const messageBox = document.getElementById("sellerLoginMessage");
const submitButton = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = document
    .getElementById("sellerLoginEmail")
    .value
    .trim()
    .toLowerCase();

  const password = document.getElementById("sellerLoginPassword").value;

  submitButton.disabled = true;
  submitButton.textContent = "Verificando cuenta...";

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const sellerReference = doc(
      db,
      "sellerApplications",
      credential.user.uid
    );

    const sellerSnapshot = await getDoc(sellerReference);

    if (!sellerSnapshot.exists()) {
      await signOut(auth);
      showMessage(
        "Esta cuenta no tiene una solicitud de vendedor registrada.",
        "error"
      );
      return;
    }

    const seller = sellerSnapshot.data();

    if (seller.status === "pending") {
      showMessage(
        `Bienvenido, ${seller.businessName}. Tu solicitud está pendiente de revisión por VIGNA.`,
        "success"
      );
      return;
    }

    if (seller.status === "approved") {
      showMessage(
        `Bienvenido, ${seller.businessName}. Tu cuenta de vendedor está aprobada.`,
        "success"
      );
      return;
    }

    if (seller.status === "rejected") {
      showMessage(
        "Tu solicitud requiere correcciones. VIGNA se comunicará contigo.",
        "error"
      );
      return;
    }

    showMessage(
      "Tu cuenta fue identificada, pero el estado de la solicitud requiere revisión.",
      "error"
    );
  } catch (error) {
    const messages = {
      "auth/invalid-email": "El correo electrónico no es válido.",
      "auth/invalid-credential": "El correo o la contraseña son incorrectos.",
      "auth/wrong-password": "El correo o la contraseña son incorrectos.",
      "auth/user-not-found": "El correo o la contraseña son incorrectos.",
      "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
      "auth/network-request-failed": "No se pudo conectar con Firebase."
    };

    showMessage(
      messages[error.code] || "No fue posible iniciar sesión.",
      "error"
    );

    console.error("Error de acceso del vendedor:", error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Ingresar como vendedor";
  }
});

function showMessage(message, type) {
  messageBox.textContent = message;
  messageBox.className = `seller-login-message ${type}`;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "seller-login-message";
}