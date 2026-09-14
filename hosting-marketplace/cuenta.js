import { auth, db } from "./firebase-config.js";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const authView = document.querySelector("#authView");
const accountView = document.querySelector("#accountView");

const loginTab = document.querySelector("#loginTab");
const registerTab = document.querySelector("#registerTab");

const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const profileForm = document.querySelector("#profileForm");

const loginMessage = document.querySelector("#loginMessage");
const registerMessage = document.querySelector("#registerMessage");
const profileMessage = document.querySelector("#profileMessage");

const logoutButton = document.querySelector("#logoutButton");
const welcomeTitle = document.querySelector("#welcomeTitle");
const welcomeEmail = document.querySelector("#welcomeEmail");

const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");
const profilePhone = document.querySelector("#profilePhone");

let registrationInProgress = false;

function showMessage(element, message, type = "error") {
  if (!element) return;

  element.textContent = message;
  element.className = `form-message ${type}`;
  element.hidden = false;
}

function clearMessage(element) {
  if (!element) return;

  element.textContent = "";
  element.className = "form-message";
  element.hidden = true;
}

function setFormBusy(form, isBusy, busyText, normalText) {
  const button = form?.querySelector('button[type="submit"]');

  if (!button) return;

  button.disabled = isBusy;
  button.textContent = isBusy ? busyText : normalText;
}

function selectAuthTab(selectedTab) {
  const showLogin = selectedTab === "login";

  loginForm.hidden = !showLogin;
  registerForm.hidden = showLogin;

  loginTab.classList.toggle("active", showLogin);
  registerTab.classList.toggle("active", !showLogin);

  loginTab.setAttribute("aria-selected", String(showLogin));
  registerTab.setAttribute("aria-selected", String(!showLogin));

  clearMessage(loginMessage);
  clearMessage(registerMessage);
}

function getReadableError(error) {
  switch (error?.code) {
    case "auth/email-already-in-use":
      return "Ya existe una cuenta registrada con este correo.";
    case "auth/invalid-email":
      return "El correo electrónico no es válido.";
    case "auth/weak-password":
      return "La contraseña debe tener al menos 6 caracteres.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "El correo o la contraseña son incorrectos.";
    case "auth/too-many-requests":
      return "Se realizaron demasiados intentos. Espera unos minutos.";
    case "auth/network-request-failed":
      return "No fue posible conectarse. Revisa tu conexión a Internet.";
    case "permission-denied":
      return "La cuenta todavía no tiene permiso para guardar sus datos.";
    default:
      return "No fue posible completar la operación. Inténtalo nuevamente.";
  }
}

function normalizePhone(value) {
  return String(value || "")
    .replace(/[^\d+]/g, "")
    .slice(0, 20);
}

function defaultCustomerName(user) {
  if (user.displayName?.trim()) {
    return user.displayName.trim().slice(0, 100);
  }

  return String(user.email || "Cliente VIGNA")
    .split("@")[0]
    .slice(0, 100);
}

async function ensureCustomerProfile(user) {
  const customerReference = doc(db, "customers", user.uid);
  const customerSnapshot = await getDoc(customerReference);

  if (customerSnapshot.exists()) {
    return customerSnapshot.data();
  }

  const customerData = {
    uid: user.uid,
    name: defaultCustomerName(user),
    email: user.email || "",
    phone: "",
    country: "PE",
    role: "customer",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(customerReference, customerData);
  return customerData;
}

async function showAuthenticatedAccount(user) {
  clearMessage(profileMessage);

  try {
    const customer = await ensureCustomerProfile(user);
    const name = customer.name || defaultCustomerName(user);

    welcomeTitle.textContent = `Hola, ${name.split(" ")[0]}`;
    welcomeEmail.textContent = user.email || "";

    profileName.value = name;
    profileEmail.value = user.email || "";
    profilePhone.value = customer.phone || "";

    authView.hidden = true;
    accountView.hidden = false;
  } catch (error) {
    console.error("Error al cargar la cuenta:", error);

    authView.hidden = false;
    accountView.hidden = true;
    selectAuthTab("login");

    showMessage(
      loginMessage,
      getReadableError(error)
    );
  }
}

loginTab.addEventListener("click", () => {
  selectAuthTab("login");
});

registerTab.addEventListener("click", () => {
  selectAuthTab("register");
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(loginMessage);

  const email = document
    .querySelector("#loginEmail")
    .value
    .trim()
    .toLowerCase();

  const password = document.querySelector("#loginPassword").value;

  if (!email || !password) {
    showMessage(
      loginMessage,
      "Ingresa tu correo electrónico y contraseña."
    );
    return;
  }

  setFormBusy(
    loginForm,
    true,
    "Ingresando...",
    "Iniciar sesión"
  );

  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    showMessage(loginMessage, getReadableError(error));
  } finally {
    setFormBusy(
      loginForm,
      false,
      "Ingresando...",
      "Iniciar sesión"
    );
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(registerMessage);

  const name = document
    .querySelector("#registerName")
    .value
    .trim()
    .slice(0, 100);

  const email = document
    .querySelector("#registerEmail")
    .value
    .trim()
    .toLowerCase();

  const phone = normalizePhone(
    document.querySelector("#registerPhone").value
  );

  const password = document.querySelector("#registerPassword").value;
  const passwordConfirmation = document.querySelector(
    "#registerPasswordConfirm"
  ).value;

  if (name.length < 2) {
    showMessage(
      registerMessage,
      "Ingresa tu nombre completo."
    );
    return;
  }

  if (phone.length < 9) {
    showMessage(
      registerMessage,
      "Ingresa un número de celular válido."
    );
    return;
  }

  if (password !== passwordConfirmation) {
    showMessage(
      registerMessage,
      "Las contraseñas no coinciden."
    );
    return;
  }

  registrationInProgress = true;

  setFormBusy(
    registerForm,
    true,
    "Creando cuenta...",
    "Crear cuenta"
  );

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    await updateProfile(credential.user, {
      displayName: name
    });

    await setDoc(
      doc(db, "customers", credential.user.uid),
      {
        uid: credential.user.uid,
        name,
        email: credential.user.email || email,
        phone,
        country: "PE",
        role: "customer",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }
    );

    showMessage(
      registerMessage,
      "Cuenta creada correctamente.",
      "success"
    );

    await showAuthenticatedAccount(credential.user);
  } catch (error) {
    console.error("Error al crear la cuenta:", error);
    showMessage(registerMessage, getReadableError(error));
  } finally {
    registrationInProgress = false;

    setFormBusy(
      registerForm,
      false,
      "Creando cuenta...",
      "Crear cuenta"
    );
  }
});

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(profileMessage);

  const user = auth.currentUser;

  if (!user) {
    showMessage(
      profileMessage,
      "Tu sesión terminó. Vuelve a iniciar sesión."
    );
    return;
  }

  const name = profileName.value.trim().slice(0, 100);
  const phone = normalizePhone(profilePhone.value);

  if (name.length < 2) {
    showMessage(profileMessage, "Ingresa tu nombre completo.");
    return;
  }

  if (phone && phone.length < 9) {
    showMessage(profileMessage, "Ingresa un celular válido.");
    return;
  }

  setFormBusy(
    profileForm,
    true,
    "Guardando...",
    "Guardar cambios"
  );

  try {
    await updateDoc(
      doc(db, "customers", user.uid),
      {
        name,
        phone,
        updatedAt: serverTimestamp()
      }
    );

    await updateProfile(user, {
      displayName: name
    });

    welcomeTitle.textContent = `Hola, ${name.split(" ")[0]}`;

    showMessage(
      profileMessage,
      "Tus datos fueron actualizados.",
      "success"
    );
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    showMessage(profileMessage, getReadableError(error));
  } finally {
    setFormBusy(
      profileForm,
      false,
      "Guardando...",
      "Guardar cambios"
    );
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  logoutButton.textContent = "Cerrando sesión...";

  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  } finally {
    logoutButton.disabled = false;
    logoutButton.textContent = "Cerrar sesión";
  }
});

onAuthStateChanged(auth, async (user) => {
  if (registrationInProgress) return;

  if (!user) {
    authView.hidden = false;
    accountView.hidden = true;
    selectAuthTab("login");
    return;
  }

  await showAuthenticatedAccount(user);
});