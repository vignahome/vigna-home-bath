async function loginCliente() {
  const correo = document.getElementById("correoClienteLogin").value.trim();
  const password = document.getElementById("passwordClienteLogin").value.trim();

  if (!correo || !password) {
    alert("Ingresa correo y contraseña.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, correo, password);

    const usuario = auth.currentUser;

    const consulta = query(
      collection(db, "usuarios"),
      where("uid", "==", usuario.uid)
    );

    const resultado = await getDocs(consulta);

    if (resultado.empty) {
      await signOut(auth);
      alert("Esta cuenta no pertenece a un cliente.");
      return;
    }

    const datos = resultado.docs[0].data();

    if (datos.tipo !== "cliente") {
      await signOut(auth);
      alert("Esta cuenta no pertenece a un cliente.");
      return;
    }

    alert("Ingreso correcto.");
    window.location.href = "panel-cliente.html";

  } catch (error) {
    console.error(error);
    alert("Error al ingresar: " + error.message);
  }
}

window.loginCliente = loginCliente;