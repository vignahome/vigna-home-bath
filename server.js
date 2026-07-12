require("dotenv").config({ path: "./.env" });

const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const { initializeApp: initializeAdminApp, cert, applicationDefault, getApps: getAdminApps } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const { WebhookSignatureValidator, InvalidWebhookSignatureError } = require("mercadopago");
const app = express();

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "http://127.0.0.1:5500").replace(/\/$/, "");
const MP_NOTIFICATION_URL = String(process.env.MP_NOTIFICATION_URL || "").trim();
const MP_WEBHOOK_SECRET = String(process.env.MP_WEBHOOK_SECRET || "").trim();
const CONTROL_INVENTARIO = String(process.env.CONTROL_INVENTARIO || "false").toLowerCase() === "true";
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || `${PUBLIC_BASE_URL},http://localhost:5500,http://127.0.0.1:5500`)
    .split(",").map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean)
);

const PLANES = Object.freeze({
  mensual: Object.freeze({ id: "mensual", nombre: "VIGNA Profesional 1 mes", precio: 39.9, meses: 1 }),
  semestral: Object.freeze({ id: "semestral", nombre: "VIGNA Profesional 6 meses", precio: 199.9, meses: 6 }),
  anual: Object.freeze({ id: "anual", nombre: "VIGNA Profesional 1 año", precio: 349.9, meses: 12 })
});

const ARCHIVOS_CATALOGO = Object.freeze([
  "data/griferias.csv",
  "data/grifos.csv",
  "data/espejos.csv",
  "data/muebles.csv",
  "data/duchas.csv",
  "data/combos.csv",
  "data/accesorios.csv"
]);

function cargarCatalogoServidor() {
  const porSolicitud = new Map();
  const porSku = new Map();

  ARCHIVOS_CATALOGO.forEach((archivo) => {
    const ruta = path.join(__dirname, archivo);
    if (!fs.existsSync(ruta)) return;

    const filas = fs.readFileSync(ruta, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/).slice(1);
    const categoria = path.basename(archivo, ".csv");

    filas.forEach((fila) => {
      const datos = fila.split(";");
      const id = datos[0]?.trim();
      const nombre = datos[1]?.trim();
      const precio = Number(datos[2]?.trim());

      if (!id || !nombre || !Number.isFinite(precio) || precio < 0) return;

      const producto = Object.freeze({
        id,
        archivo,
        sku: `${categoria}:${id}`,
        nombre,
        precio
      });

      porSolicitud.set(`${archivo}:${id}`, producto);
      porSku.set(producto.sku, producto);
    });
  });

  return { porSolicitud, porSku };
}

const CATALOGO = cargarCatalogoServidor();

function inicializarFirebaseAdmin() {
  try {
    if (getAdminApps().length) return getAdminFirestore();

    const credencialBase64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || "").trim();

    if (credencialBase64) {
      const cuentaServicio = JSON.parse(Buffer.from(credencialBase64, "base64").toString("utf8"));
      initializeAdminApp({ credential: cert(cuentaServicio) });
      return getAdminFirestore();
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeAdminApp({ credential: applicationDefault() });
      return getAdminFirestore();
    }
  } catch (error) {
    console.error("Firebase Admin no pudo inicializarse.", { message: error.message });
  }

  return null;
}

const adminDb = inicializarFirebaseAdmin();

app.disable("x-powered-by");
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origen no permitido"));
  }
}));
app.use(express.json({ limit: "20kb" }));

function credencialDisponible(res) {
  if (ACCESS_TOKEN && ACCESS_TOKEN !== "coloca_aqui_tu_nuevo_access_token") return true;
  res.status(503).json({ error: "El servidor de pagos aún no está configurado." });
  return false;
}

function plomeroIdValido(plomeroId) {
  return typeof plomeroId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(plomeroId);
}

function textoSeguro(valor, maximo) {
  return String(valor || "").trim().replace(/[<>]/g, "").slice(0, maximo);
}

function validarComprador(datos) {
  const comprador = {
    nombre: textoSeguro(datos?.nombre, 100),
    email: textoSeguro(datos?.email, 120).toLowerCase(),
    telefono: textoSeguro(datos?.telefono, 20).replace(/[^0-9+]/g, ""),
    departamento: textoSeguro(datos?.departamento, 60),
    distrito: textoSeguro(datos?.distrito, 60),
    direccion: textoSeguro(datos?.direccion, 160),
    referencia: textoSeguro(datos?.referencia, 200)
  };

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(comprador.email);
  const telefonoValido = /^\+?\d{9,15}$/.test(comprador.telefono);
  const completo = comprador.nombre.length >= 3 && comprador.departamento &&
    comprador.distrito && comprador.direccion.length >= 5;

  return completo && emailValido && telefonoValido ? comprador : null;
}

function resolverCarrito(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) return null;

  const agrupados = new Map();

  for (const item of items) {
    const id = textoSeguro(item?.id, 40);
    const archivo = textoSeguro(item?.archivo, 80);
    const cantidad = Number(item?.cantidad);

    if (!ARCHIVOS_CATALOGO.includes(archivo) || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) {
      return null;
    }

    const producto = CATALOGO.porSolicitud.get(`${archivo}:${id}`);
    if (!producto) return null;

    const anterior = agrupados.get(producto.sku);
    const cantidadTotal = (anterior?.cantidad || 0) + cantidad;
    if (cantidadTotal > 20) return null;
    agrupados.set(producto.sku, { ...producto, cantidad: cantidadTotal });
  }

  return Array.from(agrupados.values());
}

async function consultarMercadoPago(ruta, opciones = {}) {
  const respuesta = await fetch(`https://api.mercadopago.com${ruta}`, {
    ...opciones,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...opciones.headers
    }
  });
  const data = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error("Mercado Pago rechazó la solicitud.");
    error.status = respuesta.status;
    throw error;
  }
  return data;
}

async function guardarPedidoPendiente({ pedidoId, comprador, productos, total, preferenciaId }) {
  if (!adminDb) return;

  await adminDb.collection("pedidos").doc(pedidoId).set({
    pedidoId,
    comprador,
    items: productos.map((producto) => ({
      sku: producto.sku,
      nombre: producto.nombre,
      precio: producto.precio,
      cantidad: producto.cantidad,
      subtotal: producto.precio * producto.cantidad
    })),
    total,
    moneda: "PEN",
    estado: "pendiente",
    estadoPago: "pendiente",
    preferenciaId: preferenciaId || "",
    fecha: new Date().toISOString(),
    creadoEnMs: Date.now(),
    actualizadoEnMs: Date.now(),
    origen: "Tienda web"
  }, { merge: true });
}

function validarDatosPagoPedido(pago) {
  let carrito = pago.metadata?.carrito;

  if (typeof carrito === "string") {
    try { carrito = JSON.parse(carrito); } catch (_error) { carrito = null; }
  }

  if (!Array.isArray(carrito) || carrito.length < 1) {
    return { valido: false, error: "El pago no contiene un pedido verificable." };
  }

  let totalEsperado = 0;
  const productos = [];

  for (const item of carrito) {
    const producto = CATALOGO.porSku.get(String(item?.sku || ""));
    const cantidad = Number(item?.cantidad);

    if (!producto || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) {
      return { valido: false, error: "El contenido del pedido no es válido." };
    }

    totalEsperado += producto.precio * cantidad;
    productos.push({ ...producto, cantidad });
  }

  const totalPagado = Number(pago.transaction_amount);
  const aprobado = pago.status === "approved" && pago.currency_id === "PEN" &&
    Math.abs(totalPagado - totalEsperado) < 0.001;

  return {
    valido: aprobado,
    estado: pago.status || "desconocido",
    pedidoId: pago.metadata?.pedido_id || pago.external_reference,
    total: totalPagado,
    productos,
    error: aprobado ? "" : "El pago no está aprobado o el importe no coincide."
  };
}

async function confirmarPedidoPagado(validacion, pago) {
  if (!adminDb || !validacion.valido || !validacion.pedidoId) return;

  const pedidoRef = adminDb.collection("pedidos").doc(String(validacion.pedidoId));

  await adminDb.runTransaction(async (transaccion) => {
    const pedido = await transaccion.get(pedidoRef);
    if (pedido.exists && pedido.data().estadoPago === "approved") return;

    const inventarios = [];

    for (const producto of validacion.productos) {
      const referencia = adminDb.collection("inventario").doc(producto.sku);
      const snapshot = await transaccion.get(referencia);
      inventarios.push({ referencia, snapshot, producto });
    }

    transaccion.set(pedidoRef, {
      pedidoId: String(validacion.pedidoId),
      total: validacion.total,
      moneda: "PEN",
      estado: "pagado",
      estadoPago: "approved",
      paymentId: String(pago.id || ""),
      pagadoEnMs: Date.now(),
      actualizadoEnMs: Date.now()
    }, { merge: true });

    inventarios.forEach(({ referencia, snapshot, producto }) => {
      if (!snapshot.exists) return;
      const datos = snapshot.data();
      transaccion.update(referencia, {
        stock: Math.max(0, Number(datos.stock || 0) - producto.cantidad),
        vendidos: Number(datos.vendidos || 0) + producto.cantidad,
        actualizadoEnMs: Date.now()
      });
    });
  });
}

async function consultarYProcesarPagoPedido(paymentId) {
  const pago = await consultarMercadoPago(`/v1/payments/${paymentId}`);
  const validacion = validarDatosPagoPedido(pago);
  if (validacion.valido) await confirmarPedidoPagado(validacion, pago);
  return validacion;
}

async function comprobarInventario(productos) {
  if (!CONTROL_INVENTARIO) return { disponible: true };
  if (!adminDb) return { disponible: false, error: "El control de inventario no está configurado." };

  for (const producto of productos) {
    const snapshot = await adminDb.collection("inventario").doc(producto.sku).get();
    if (!snapshot.exists) return { disponible: false, error: `${producto.nombre} todavía no tiene inventario configurado.` };
    const datos = snapshot.data();
    if (datos.activo === false || Number(datos.stock || 0) < producto.cantidad) {
      return { disponible: false, error: `No hay stock suficiente de ${producto.nombre}.` };
    }
  }

  return { disponible: true };
}

app.get("/salud", (_req, res) => res.json({ ok: true }));

app.get("/inventario", async (_req, res) => {
  if (!adminDb) return res.json({ activo: false, productos: [] });

  try {
    const snapshot = await adminDb.collection("inventario").get();
    const productos = snapshot.docs.map((documento) => {
      const datos = documento.data();
      return {
        sku: datos.sku || documento.id,
        stock: Math.max(0, Number(datos.stock || 0)),
        stockMinimo: Math.max(0, Number(datos.stockMinimo ?? 2)),
        activo: datos.activo !== false
      };
    });
    return res.json({ activo: CONTROL_INVENTARIO, productos });
  } catch (_error) {
    return res.status(503).json({ error: "No se pudo consultar el inventario." });
  }
});

app.post("/crear-pago", async (req, res) => {
  if (!credencialDisponible(res)) return;
  const { planId, plomeroId } = req.body || {};
  const plan = PLANES[planId];
  if (!plan) return res.status(400).json({ error: "El plan seleccionado no es válido." });
  if (!plomeroIdValido(plomeroId)) return res.status(400).json({ error: "El perfil profesional no es válido." });

  try {
    const data = await consultarMercadoPago("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify({
        items: [{ id: plan.id, title: plan.nombre, quantity: 1, unit_price: plan.precio, currency_id: "PEN" }],
        back_urls: {
          success: `${PUBLIC_BASE_URL}/plomeros.html?pago=retorno`,
          failure: `${PUBLIC_BASE_URL}/plomeros.html?pago=fallido`,
          pending: `${PUBLIC_BASE_URL}/plomeros.html?pago=pendiente`
        },
        auto_return: "approved",
        external_reference: plomeroId,
        metadata: { plan_id: plan.id, plomero_id: plomeroId }
      })
    });
    const initPoint = data.init_point || data.sandbox_init_point;
    if (!initPoint) throw new Error("Mercado Pago no devolvió un enlace de pago.");
    return res.json({ init_point: initPoint });
  } catch (error) {
    console.error("No se pudo crear la preferencia de pago.", { status: error.status || 500, message: error.message });
    return res.status(502).json({ error: "No se pudo iniciar el pago. Inténtalo nuevamente." });
  }
});

app.post("/crear-pago-productos", async (req, res) => {
  if (!credencialDisponible(res)) return;

  const productos = resolverCarrito(req.body?.items);
  const comprador = validarComprador(req.body?.comprador);

  if (!productos) {
    return res.status(400).json({ error: "El carrito contiene productos o cantidades no válidos." });
  }

  if (!comprador) {
    return res.status(400).json({ error: "Revisa los datos de contacto y entrega." });
  }

  const inventario = await comprobarInventario(productos);
  if (!inventario.disponible) {
    return res.status(409).json({ error: inventario.error });
  }

  const pedidoId = `VIGNA-${randomUUID().split("-")[0].toUpperCase()}`;
  const carritoVerificacion = productos.map(({ sku, cantidad }) => ({ sku, cantidad }));
  const totalPedido = productos.reduce((total, producto) => total + producto.precio * producto.cantidad, 0);

  try {
    const preferencia = {
      items: productos.map((producto) => ({
        id: producto.sku,
        title: producto.nombre,
        quantity: producto.cantidad,
        unit_price: producto.precio,
        currency_id: "PEN"
      })),
      payer: {
        name: comprador.nombre,
        email: comprador.email,
        phone: { number: comprador.telefono }
      },
      back_urls: {
        success: `${PUBLIC_BASE_URL}/checkout.html?pago=retorno`,
        failure: `${PUBLIC_BASE_URL}/checkout.html?pago=fallido`,
        pending: `${PUBLIC_BASE_URL}/checkout.html?pago=pendiente`
      },
      auto_return: "approved",
      external_reference: pedidoId,
      metadata: {
        pedido_id: pedidoId,
        carrito: JSON.stringify(carritoVerificacion),
        comprador_nombre: comprador.nombre,
        comprador_telefono: comprador.telefono,
        entrega_departamento: comprador.departamento,
        entrega_distrito: comprador.distrito,
        entrega_direccion: comprador.direccion,
        entrega_referencia: comprador.referencia
      }
    };

    if (MP_NOTIFICATION_URL.startsWith("https://")) {
      preferencia.notification_url = MP_NOTIFICATION_URL;
    }

    const data = await consultarMercadoPago("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferencia)
    });

    const initPoint = data.init_point || data.sandbox_init_point;
    if (!initPoint) throw new Error("Mercado Pago no devolvió un enlace de pago.");

    await guardarPedidoPendiente({
      pedidoId,
      comprador,
      productos,
      total: totalPedido,
      preferenciaId: data.id
    });

    return res.json({ init_point: initPoint, pedidoId });
  } catch (error) {
    console.error("No se pudo crear el pago del pedido.", { status: error.status || 500, message: error.message });
    return res.status(502).json({ error: "No se pudo iniciar el pago del pedido." });
  }
});

app.get("/verificar-pago-productos/:paymentId", async (req, res) => {
  if (!credencialDisponible(res)) return;

  const paymentId = String(req.params.paymentId || "");
  if (!/^\d{1,30}$/.test(paymentId)) {
    return res.status(400).json({ error: "El identificador del pago no es válido." });
  }

  try {
    const validacion = await consultarYProcesarPagoPedido(paymentId);

    if (!validacion.valido) {
      return res.status(409).json({ aprobado: false, estado: validacion.estado, error: validacion.error });
    }

    return res.json({ aprobado: true, pedidoId: validacion.pedidoId, total: validacion.total });
  } catch (error) {
    console.error("No se pudo verificar el pago del pedido.", { status: error.status || 500, message: error.message });
    return res.status(502).json({ error: "No se pudo verificar el pago del pedido." });
  }
});

app.post("/webhook-mercadopago", async (req, res) => {
  const paymentId = String(req.query["data.id"] || req.body?.data?.id || "");

  if (!MP_WEBHOOK_SECRET || !/^\d{1,30}$/.test(paymentId)) {
    return res.sendStatus(400);
  }

  try {
    WebhookSignatureValidator.validate({
      xSignature: req.headers["x-signature"],
      xRequestId: req.headers["x-request-id"],
      dataId: paymentId,
      secret: MP_WEBHOOK_SECRET
    });

    await consultarYProcesarPagoPedido(paymentId);
    return res.sendStatus(200);
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) return res.sendStatus(401);
    console.error("No se pudo procesar el webhook de Mercado Pago.", { message: error.message });
    return res.sendStatus(500);
  }
});

app.get("/verificar-pago/:paymentId", async (req, res) => {
  if (!credencialDisponible(res)) return;
  const paymentId = String(req.params.paymentId || "");
  if (!/^\d{1,30}$/.test(paymentId)) return res.status(400).json({ error: "El identificador del pago no es válido." });

  try {
    const pago = await consultarMercadoPago(`/v1/payments/${paymentId}`);
    const planId = pago.metadata?.plan_id || pago.additional_info?.items?.[0]?.id;
    const plan = PLANES[planId];
    const plomeroId = String(pago.external_reference || pago.metadata?.plomero_id || "");
    const montoCorrecto = plan && Math.abs(Number(pago.transaction_amount) - plan.precio) < 0.001;
    if (pago.status !== "approved" || pago.currency_id !== "PEN" || !montoCorrecto || !plomeroIdValido(plomeroId)) {
      return res.status(409).json({ aprobado: false, estado: pago.status || "desconocido" });
    }
    return res.json({ aprobado: true, plomeroId, plan: plan.nombre, meses: plan.meses, verificacion: "Plan Activo" });
  } catch (error) {
    console.error("No se pudo verificar el pago.", { status: error.status || 500, message: error.message });
    return res.status(502).json({ error: "No se pudo verificar el pago." });
  }
});

app.use((error, _req, res, _next) => {
  if (error.message === "Origen no permitido") return res.status(403).json({ error: "Origen no permitido." });
  console.error("Error interno del servidor de pagos.");
  return res.status(500).json({ error: "Error interno del servidor." });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Servidor de pagos VIGNA activo en el puerto ${PORT}.`));
}

module.exports = { app, PLANES, CATALOGO, resolverCarrito, validarComprador, validarDatosPagoPedido };
