import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD0SHv3B6ebyU8145R0ZN6cROs1QzfJHm0",
  authDomain: "vigna-marketplace-productos.firebaseapp.com",
  projectId: "vigna-marketplace-productos",
  storageBucket: "vigna-marketplace-productos.firebasestorage.app",
  messagingSenderId: "629474714727",
  appId: "1:629474714727:web:647b8a07553c467ecda0c2"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };