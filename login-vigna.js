import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getAuth,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDM_GxirB_YPju0O7CYjQKbZVIkfwQGrpQ",
  authDomain: "vigna-plomeros.firebaseapp.com",
  projectId: "vigna-plomeros",
  storageBucket: "vigna-plomeros.firebasestorage.app",
  messagingSenderId: "1032248473403",
  appId: "1:1032248473403:web:0c6c0b37dda35e5391291e",
  measurementId: "G-99QED634TE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

async function loginVigna() {
  const correo = document.getElementById("correoLogin").value.trim();
  const password = document.getElementById("passwordLogin").value.trim();

  if (!correo || !password) {
    alert("Ingresa correo y contraseña.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, correo, password);
    alert("Ingreso correcto.");
    window.location.href = "./panel-vigna.html";
  } catch (error) {
    console.error(error);
    alert("Error al ingresar: " + error.message);
  }
}

window.loginVigna = loginVigna;