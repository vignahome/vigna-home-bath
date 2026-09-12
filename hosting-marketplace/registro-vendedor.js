const sellerForm = document.querySelector("#sellerRegistrationForm");
const formMessage = document.querySelector("#sellerFormMessage");
const passwordInput = document.querySelector("#sellerPassword");
const passwordConfirmInput = document.querySelector("#sellerPasswordConfirm");

sellerForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  clearMessage();

  if (!sellerForm.checkValidity()) {
    sellerForm.reportValidity();
    showMessage("Completa correctamente todos los campos obligatorios.", "error");
    return;
  }

  if (passwordInput.value !== passwordConfirmInput.value) {
    showMessage("Las contraseñas no coinciden. Revísalas antes de continuar.", "error");
    passwordConfirmInput.focus();
    return;
  }

  if (passwordInput.value.length < 8) {
    showMessage("La contraseña debe contener al menos 8 caracteres.", "error");
    passwordInput.focus();
    return;
  }

  showMessage(
    "Formulario validado correctamente. La conexión segura con Firebase se activará en el siguiente paso.",
    "success"
  );
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
