const fs = require("fs");

console.log("Iniciando generación...");

const urls = {
  departamentos: "https://raw.githubusercontent.com/joseluisq/ubigeos-peru/master/json/departamentos.json",
  provincias: "https://raw.githubusercontent.com/joseluisq/ubigeos-peru/master/json/provincias.json",
  distritos: "https://raw.githubusercontent.com/joseluisq/ubigeos-peru/master/json/distritos.json"
};

async function cargarJSON(url) {
  const respuesta = await fetch(url);
  const data = await respuesta.json();

  if (Array.isArray(data)) {
    return data;
  }

  return Object.values(data).flat();
}

async function generarUbigeo() {
  const departamentos = await cargarJSON(urls.departamentos);
  const provincias = await cargarJSON(urls.provincias);
  const distritos = await cargarJSON(urls.distritos);

  const resultado = {};

  departamentos.forEach((dep) => {
    resultado[dep.nombre_ubigeo] = {};

    const provinciasDelDep = provincias.filter(
      (prov) => prov.id_padre_ubigeo === dep.id_ubigeo
    );

    provinciasDelDep.forEach((prov) => {
      const distritosDeProv = distritos
        .filter((dist) => dist.id_padre_ubigeo === prov.id_ubigeo)
        .map((dist) => dist.nombre_ubigeo);

      resultado[dep.nombre_ubigeo][prov.nombre_ubigeo] = distritosDeProv;
    });
  });

  fs.writeFileSync(
    "data/ubigeo-peru.json",
    JSON.stringify(resultado, null, 2),
    "utf8"
  );

  console.log("UBIGEO completo creado en data/ubigeo-peru.json");
}

generarUbigeo();