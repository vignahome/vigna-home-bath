const fs = require("node:fs");
const path = require("node:path");

const raiz = __dirname;
const leer = (archivo) => fs.readFileSync(path.join(raiz, archivo), "utf8");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`Verificación fallida: ${mensaje}`);
};

const requeridos = [
  "garantias-reclamos.html",
  "garantias-reclamos.css",
  "garantias-reclamos.js",
  "firestore.rules",
  "storage.rules"
];
requeridos.forEach((archivo) => exigir(fs.existsSync(path.join(raiz, archivo)), `falta ${archivo}`));

const html = leer("garantias-reclamos.html");
const js = leer("garantias-reclamos.js");
const bootstrap = leer("mvp-profesionales-bootstrap.js");
const principal = leer("mvp-profesionales.html");
const hosting = leer("preparar-hosting-profesionales.js");
const firestore = leer("firestore.rules");
const storage = leer("storage.rules");

const idsHtml = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((coincidencia) => coincidencia[1]));
const idsControlador = [...js.matchAll(/getElementById\("([^"]+)"\)/g)].map((coincidencia) => coincidencia[1]);
idsControlador.forEach((id) => exigir(idsHtml.has(id), `el controlador busca #${id}, pero ese elemento no existe`));

const llavesBalanceadas = (contenido) => {
  let nivel = 0;
  for (const caracter of contenido) {
    if (caracter === "{") nivel += 1;
    if (caracter === "}") nivel -= 1;
    if (nivel < 0) return false;
  }
  return nivel === 0;
};

exigir(html.includes('src="garantias-reclamos.js?v=1"'), "la página no carga su controlador");
exigir(html.includes('href="garantias-reclamos.css?v=1"'), "la página no carga sus estilos");
exigir(js.includes('"cliente", "profesional", "admin"'), "faltan los tres roles autorizados");
exigir(js.includes("signInWithEmailAndPassword"), "falta Firebase Auth");
exigir(js.includes('reclamos: "pv_reclamos"'), "falta la conexión a Firestore");
exigir(js.includes("uploadBytes"), "falta la conexión a Firebase Storage");
exigir(js.includes("form?.elements?.namedItem(nombre)"), "los formularios deben poder leerse después de bloquear sus controles");
exigir(js.includes("} finally {\n    estado.cargando = false;\n  }\n  renderizar();"), "el listado debe renderizarse después de finalizar la carga");
exigir(principal.includes('href="garantias-reclamos.html"'), "el MVP no enlaza el módulo independiente");
exigir(hosting.includes('"garantias-reclamos.html"'), "Hosting no incluye la página independiente");
exigir(hosting.includes('"garantias-reclamos.js"'), "Hosting no incluye el controlador");
exigir(hosting.includes('"garantias-reclamos.css"'), "Hosting no incluye los estilos");
exigir(!bootstrap.includes("mvp-profesionales-reclamos.js"), "el panel flotante anterior todavía se carga");
exigir(!fs.existsSync(path.join(raiz, "mvp-profesionales-reclamos.js")), "el archivo roto anterior todavía existe");
exigir(firestore.includes("match /pv_reclamos/{reclamoId}"), "faltan reglas Firestore para reclamos");
exigir(firestore.includes("allow delete: if false"), "los reclamos deben ser indelebles desde el cliente web");
exigir(storage.includes("match /profesionales-vigna/reclamos/{reclamoId}/{uid}/{archivo}"), "faltan reglas Storage para evidencias");
exigir(llavesBalanceadas(firestore), "las llaves de firestore.rules no están balanceadas");
exigir(llavesBalanceadas(storage), "las llaves de storage.rules no están balanceadas");

console.log("Garantías y reclamos: integración independiente verificada.");
