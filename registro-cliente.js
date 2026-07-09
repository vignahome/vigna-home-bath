async function registrarCliente() {
  const nombre = document.getElementById("nombreCliente").value.trim();
  const correo = document.getElementById("correoCliente").value.trim();
  const password = document.getElementById("passwordCliente").value.trim();
  const whatsapp = document.getElementById("whatsappCliente").value.trim();
  const distrito = document.getElementById("distritoCliente").value.trim();

  if (!nombre || !correo || !password || !whatsapp || !distrito) {
    alert("Completa todos los datos.");
    return;
  }

  try {
    const credencial = await createUserWithEmailAndPassword(
      auth,
      correo,
      password
    );

    const uid = credencial.user.uid;

    await addDoc(collection(db, "usuarios"), {
      uid,
      nombre,
      correo,
      whatsapp,
      distrito,
      tipo: "cliente",
      fechaRegistro: new Date().toLocaleDateString()
    });

    alert("Cuenta cliente creada correctamente.");
    window.location.href = "login-cliente.html";

  } catch (error) {
    console.error(error);
    alert("Error creando cliente: " + error.message);
  }
}

window.registrarCliente = registrarCliente;