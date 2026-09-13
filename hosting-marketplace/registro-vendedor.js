import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const form = document.getElementById("sellerRegistrationForm");
const formMessage = document.getElementById("sellerFormMessage");
const submitButton = form.querySelector('button[type="submit"]');

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage();

  const password = document.getElementById("sellerPassword").value;
  const passwordConfirm = document.getElementById("sellerPasswordConfirm").value;
  const termsAccepted = document.getElementById("sellerTerms").checked;

  if (!form.reportValidity()) {
    return;
  }

  if (password.length < 8) {
    showMessage("La contraseña debe tener al menos 8 caracteres.", "error");
    return;
  }

  if (password !== passwordConfirm) {
    showMessage("Las contraseñas no coinciden.", "error");
    return;
  }

  if (!termsAccepted) {
    showMessage("Debes aceptar los términos y condiciones.", "error");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "Enviando solicitud...";

  let createdUser = null;

  try {
    const email = document.getElementById("sellerEmail").value.trim().toLowerCase();

    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    createdUser = credential.user;

    await setDoc(doc(db, "sellerApplications", createdUser.uid), {
      uid: createdUser.uid,
      country: "PE",
      sellerType: document.getElementById("sellerType").value,
      businessName: document.getElementById("businessName").value.trim(),
      legalName: document.getElementById("legalName").value.trim(),
      taxId: document.getElementById("taxId").value.trim(),
      representativeName: document.getElementById("representativeName").value.trim(),
      email,
      phone: document.getElementById("sellerPhone").value.trim(),
      productCategory: document.getElementById("productCategory").value,
      businessDescription: document.getElementById("businessDescription").value.trim(),
      status: "pending",
      role: "seller",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    form.reset();
    document.getElementById("sellerCountry").value = "PE";

    showMessage(
      "Solicitud enviada correctamente. Tu cuenta quedó pendiente de revisión y aprobación por VIGNA.",
      "success"
    );
  } catch (error) {
    if (createdUser) {
      try {
        await deleteUser(createdUser);
      } catch (cleanupError) {
        console.error("No se pudo revertir la cuenta:", cleanupError);
      }
    }

    const messages = {
      "auth/email-already-in-use": "Este correo ya está registrado.",
      "auth/invalid-email": "Ingresa un correo electrónico válido.",
      "auth/weak-password": "La contraseña no cumple los requisitos de seguridad.",
      "auth/network-request-failed": "No se pudo conectar con Firebase. Revisa tu conexión."
    };

    showMessage(
      messages[error.code] || "No fue posible enviar la solicitud. Inténtalo nuevamente.",
      "error"
    );

    console.error("Error de registro:", error);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enviar solicitud de vendedor";
  }
});

function showMessage(message, type) {
  formMessage.textContent = message;
  formMessage.className = `form-message ${type}`;
  formMessage.scrollIntoView({ behavior: "smooth", block: "center" });
}

function clearMessage() {
  formMessage.textContent = "";
  formMessage.className = "form-message";
}