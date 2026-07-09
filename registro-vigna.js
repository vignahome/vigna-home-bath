import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/12.14.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword
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
const db = getFirestore(app);
const auth = getAuth(app);

async function registrarVigna() {
  const nombre = document.getElementById("nombreRegistro").value.trim();
  const correo = document.getElementById("correoRegistro").value.trim();
  const password = document.getElementById("passwordRegistro").value.trim();
  const whatsapp = document.getElementById("telefonoRegistro").value.trim();
  const especialidad = document.getElementById("especialidadRegistro").value;
  const departamento = document.getElementById("departamentoRegistro").value.trim();
  const provincia = document.getElementById("provinciaRegistro").value.trim();
  const distrito = document.getElementById("distritoRegistro").value.trim();

  if (!nombre || !correo || !password || !whatsapp || !especialidad || !departamento || !provincia || !distrito) {
    alert("Completa todos los datos.");
    return;
  }

  try {
    const credencial = await createUserWithEmailAndPassword(auth, correo, password);
    const uid = credencial.user.uid;

    await addDoc(collection(db, "usuarios"), {
      uid,
      nombre,
      correo,
      tipo: "vigna",
      fechaRegistro: new Date().toLocaleDateString()
    });

    const perfil = await addDoc(collection(db, "plomeros"), {
      uid,
      nombre,
      correo,
      whatsapp,
      especialidad,
      departamento,
      provincia,
      distrito,
      zona: `${departamento} - ${provincia} - ${distrito}`,
      descripcion: "",
      foto: "images/avatar-default.png",
      estado: "Pendiente",
      verificacion: "Pendiente",
      plan: "",
      fechaVencimiento: "",
      nivel: 1,
      puntos: 0,
      trabajos: 0,
      calificacion: 5,
      totalCalificaciones: 1,
      disponibilidad: "Disponible",
      fechaRegistro: new Date().toLocaleDateString()
    });

    localStorage.setItem("vignaPendientePago", perfil.id);

    alert("Cuenta y perfil creados correctamente.");
    window.location.href = "./login-vigna.html";

  } catch (error) {
    console.error(error);
    alert("Error creando cuenta: " + error.message);
  }
}

window.registrarVigna = registrarVigna;