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
const emailInput = document.getElementById("sellerLoginEmail");
const passwordInput = document.getElementById("sellerLoginPassword");
const messageBox = document.getElementById("sellerLoginMessage");
const submitButton = form.querySelector('button[type="submit"]');

function showMessage(message, type = "error") {
  messageBox.textContent = message;
  messageBox.className = `seller-login-message ${type}`;
  messageBox.hidden = false;
}

function clearMessage() {
  messageBox.textContent = "";
  messageBox.className = "seller-login-message";
  messageBox.hidden = true;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email || !password) {
    showMessage("Ingresa tu correo electrónico y contraseña.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Verificando cuenta...";

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    const applicationReference = doc(
      db,
      "sellerApplications",
      credential.user.uid
    );

    const applicationSnapshot = await getDoc(applicationReference);

    if (!applicationSnapshot.exists()) {
      await signOut(auth);
      showMessage("Esta cuenta no tiene una solicitud de vendedor registrada.");
      return;
    }

    showMessage("Acceso correcto. Abriendo tu panel...", "success");

    window.setTimeout(() => {
      window.location.replace("panel-vendedor");
    }, 600);
  } catch (error) {
    console.error("Error de acceso del vendedor:", error);

    if (
      error.code === "auth/invalid-credential" ||
      error.code === "auth/wrong-password" ||
      error.code === "auth/user-not-found"
    ) {
      showMessage("El correo o la contraseña son incorrectos.");
    } else if (error.code === "auth/too-many-requests") {
      showMessage("Se realizaron demasiados intentos. Espera unos minutos.");
    } else if (error.code === "auth/network-request-failed") {
      showMessage("No se pudo conectar con Firebase. Revisa tu conexión.");
    } else {
      showMessage("No fue posible iniciar sesión. Inténtalo nuevamente.");
    }
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Ingresar como vendedor";
  }
});