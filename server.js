require("dotenv").config({ path: "./.env" });

const express = require("express");
const cors = require("cors");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const PDFDocument = require("pdfkit");
const { initializeApp: initializeAdminApp, cert, applicationDefault, getApps: getAdminApps } = require("firebase-admin/app");
const { getFirestore: getAdminFirestore } = require("firebase-admin/firestore");
const { getAuth: getAdminAuth } = require("firebase-admin/auth");
const { WebhookSignatureValidator, InvalidWebhookSignatureError } = require("mercadopago");
const app = express();

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "http://127.0.0.1:5500").replace(/\/$/, "");
const MP_NOTIFICATION_URL = String(process.env.MP_NOTIFICATION_URL || "").trim();
const MP_WEBHOOK_SECRET = String(process.env.MP_WEBHOOK_SECRET || "").trim();
const MP_WEBHOOK_SECRET_TEST = String(process.env.MP_WEBHOOK_SECRET_TEST || "").trim();
const CONTROL_INVENTARIO = String(process.env.CONTROL_INVENTARIO || "false").toLowerCase() === "true";
const INVENTARIO_MOVIMIENTOS_COLLECTION = "movimientosInventario";
const PAGOS_PLANES_COLLECTION = "pv_pagos_planes";
const PLANES_PROFESIONALES_COLLECTION = "pv_planes_profesionales";
const PROFESIONALES_COLLECTION = "pv_profesionales";
const USUARIOS_COLLECTION = "pv_usuarios";
const AUDITORIA_PROFESIONALES_COLLECTION = "pv_auditoria";
const CONTRATOS_PROFESIONALES_COLLECTION = "pv_contratos";
const VENTANA_LIMITES_MS = 15 * 60 * 1000;
const ORIGENES_OFICIALES = [
  PUBLIC_BASE_URL,
  "https://vigna-plomeros.web.app",
  "https://vigna-plomeros.firebaseapp.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];
const ALLOWED_ORIGINS = new Set(
  [...ORIGENES_OFICIALES, ...String(process.env.ALLOWED_ORIGINS || "").split(",")]
    .map((origin) => origin.trim().replace(/\/$/, "")).filter(Boolean)
);

function obtenerOrigenRetorno(origin) {
  const origenNormalizado = String(origin || "").trim().replace(/\/$/, "");
  return ALLOWED_ORIGINS.has(origenNormalizado) ? origenNormalizado : PUBLIC_BASE_URL;
}

const PLANES = Object.freeze({
  mensual: Object.freeze({ id: "mensual", nombre: "VIGNA Profesional Mensual", precio: 19.9, meses: 1 }),
  semestral: Object.freeze({ id: "semestral", nombre: "VIGNA Profesional Semestral + 1 mes gratis", precio: 99.9, meses: 7 }),
  anual: Object.freeze({ id: "anual", nombre: "VIGNA Profesional Anual + 2 meses gratis", precio: 199.9, meses: 14 })
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
app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(self)");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.secure || req.headers["x-forwarded-proto"] === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin.replace(/\/$/, ""))) return callback(null, true);
    return callback(new Error("Origen no permitido"));
  }
}));
app.use(express.json({ limit: "20kb" }));

function crearLimitadorSolicitudes({ maximo, ventanaMs = VENTANA_LIMITES_MS, nombre }) {
  const solicitudes = new Map();
  return function limitarSolicitudes(req, res, next) {
    const ahora = Date.now();
    const clave = `${nombre}:${req.ip || req.socket?.remoteAddress || "desconocido"}`;
    let registro = solicitudes.get(clave);
    if (!registro || registro.reiniciaEn <= ahora) {
      registro = { cantidad: 0, reiniciaEn: ahora + ventanaMs };
      solicitudes.set(clave, registro);
    }
    registro.cantidad += 1;
    const restantes = Math.max(0, maximo - registro.cantidad);
    res.setHeader("RateLimit-Limit", String(maximo));
    res.setHeader("RateLimit-Remaining", String(restantes));
    res.setHeader("RateLimit-Reset", String(Math.ceil(registro.reiniciaEn / 1000)));
    if (solicitudes.size > 10000) {
      for (const [itemClave, item] of solicitudes) {
        if (item.reiniciaEn <= ahora) solicitudes.delete(itemClave);
      }
    }
    if (registro.cantidad > maximo) {
      res.setHeader("Retry-After", String(Math.ceil((registro.reiniciaEn - ahora) / 1000)));
      return res.status(429).json({ error: "Demasiadas solicitudes. Espera unos minutos antes de intentarlo nuevamente." });
    }
    return next();
  };
}

const limitarCreacionPagos = crearLimitadorSolicitudes({ maximo: 10, nombre: "crear-pago" });
const limitarVerificacionPagos = crearLimitadorSolicitudes({ maximo: 60, nombre: "verificar-pago" });
const limitarPdfContratos = crearLimitadorSolicitudes({ maximo: 30, nombre: "pdf-contrato" });

function credencialDisponible(res) {
  if (ACCESS_TOKEN && ACCESS_TOKEN !== "coloca_aqui_tu_nuevo_access_token") return true;
  res.status(503).json({ error: "El servidor de pagos aún no está configurado." });
  return false;
}

function plomeroIdValido(plomeroId) {
  return typeof plomeroId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(plomeroId);
}

function obtenerBearer(req) {
  const autorizacion = String(req.headers.authorization || "").trim();
  const coincidencia = autorizacion.match(/^Bearer\s+(.+)$/i);
  return coincidencia?.[1]?.trim() || "";
}

async function exigirProfesionalAutenticado(req, res) {
  if (!adminDb) {
    res.status(503).json({ error: "El servidor de pagos no tiene Firebase configurado." });
    return null;
  }

  const token = obtenerBearer(req);
  if (!token) {
    res.status(401).json({ error: "Inicia sesión nuevamente para continuar con el pago." });
    return null;
  }

  try {
    const usuario = await getAdminAuth().verifyIdToken(token, true);
    const [rolSnap, profesionalSnap] = await Promise.all([
      adminDb.collection(USUARIOS_COLLECTION).doc(usuario.uid).get(),
      adminDb.collection(PROFESIONALES_COLLECTION).doc(usuario.uid).get()
    ]);
    const rol = rolSnap.data()?.rol;
    if (rol !== "profesional" || !profesionalSnap.exists) {
      res.status(403).json({ error: "Solo una cuenta profesional puede adquirir este plan." });
      return null;
    }
    return { uid: usuario.uid, email: usuario.email || "" };
  } catch (error) {
    if (String(error.code || "").startsWith("auth/")) {
      res.status(401).json({ error: "La sesión ya no es válida. Ingresa nuevamente." });
      return null;
    }
    throw error;
  }
}

async function exigirUsuarioFirebase(req, res) {
  if (!adminDb) {
    res.status(503).json({ error: "El servidor no tiene Firebase configurado." });
    return null;
  }
  const token = obtenerBearer(req);
  if (!token) {
    res.status(401).json({ error: "Inicia sesión nuevamente para continuar." });
    return null;
  }
  try {
    return await getAdminAuth().verifyIdToken(token, true);
  } catch (error) {
    if (String(error.code || "").startsWith("auth/")) {
      res.status(401).json({ error: "La sesión ya no es válida. Ingresa nuevamente." });
      return null;
    }
    throw error;
  }
}

function dineroContrato(valor) {
  return `S/ ${Number(valor || 0).toFixed(2)}`;
}

function escribirSeccionContrato(pdf, titulo, contenido) {
  pdf.moveDown(0.6).font("Helvetica-Bold").fontSize(12).fillColor("#865400").text(titulo, { keepTogether: true });
  pdf.moveDown(0.2).font("Helvetica").fontSize(9.5).fillColor("#171717").text(String(contenido || "No especificado"), { lineGap: 2 });
}

function generarPdfContrato(res, contrato) {
  const pdf = new PDFDocument({ size: "A4", margins: { top: 42, right: 46, bottom: 48, left: 46 }, info: { Title: `Contrato ${contrato.id}`, Author: "VIGNA Home & Bath" } });
  res.type("application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="contrato-${String(contrato.id).replace(/[^a-zA-Z0-9_-]/g, "-")}.pdf"`);
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  pdf.pipe(res);
  pdf.font("Helvetica-Bold").fontSize(18).fillColor("#865400").text("PROFESIONALES VIGNA'S", { align: "right" });
  pdf.moveDown(0.2).fontSize(9).fillColor("#555555").text(`CONTRATO ${contrato.id} - VERSION ${Number(contrato.version || 1)}`);
  pdf.text(`Emitido: ${contrato.creadoEn || "No registrado"} | Solicitud: ${contrato.solicitudId || ""} | Cotizacion: ${contrato.cotizacionId || ""} v${Number(contrato.cotizacionVersion || 1)}`);
  pdf.moveDown().fontSize(17).fillColor("#171717").text("Contrato de prestacion de servicios");
  pdf.moveDown(0.5).font("Helvetica").fontSize(10).text(`Cliente: ${contrato.clienteNombre || ""} - ${contrato.clienteTipoDocumento || "Documento"} ${contrato.clienteDocumento || ""}`);
  pdf.text(`Profesional: ${contrato.profesionalNombre || ""} - ${contrato.profesionalTipoDocumento || "Documento"} ${contrato.profesionalDocumento || ""}`);
  escribirSeccionContrato(pdf, "Objeto, alcance y entregables", `${contrato.descripcionSolicitud || "Servicio acordado"}\n${contrato.detalle || ""}`);
  const desglose = contrato.desglose || {};
  escribirSeccionContrato(pdf, "Precio y pagos", `Opcion: ${contrato.opcion || ""}\nMateriales: ${dineroContrato(desglose.materiales)}\nMano de obra: ${dineroContrato(desglose.manoObra)}\nTransporte, permisos u otros: ${dineroContrato(desglose.otros)}\nTOTAL: ${dineroContrato(contrato.total)}\nForma de pago: ${contrato.formaPago || "Segun acuerdo documentado entre las partes."}`);
  const ubicacion = contrato.ubicacion || {};
  escribirSeccionContrato(pdf, "Lugar, plazo y responsabilidades", `${ubicacion.departamento || ""}, ${ubicacion.provincia || ""}, ${ubicacion.distrito || ""}\nDireccion contractual: ${ubicacion.direccion || "Registrada en el expediente privado"}${ubicacion.referencia ? ` - ${ubicacion.referencia}` : ""}\nInicio preferido: ${ubicacion.fecha || "Por coordinar"}${ubicacion.fechaFin ? ` - Fin esperado: ${ubicacion.fechaFin}` : ""}\nMateriales: ${contrato.responsableMaterialesSolicitud || contrato.responsableMateriales || "Por definir"}\nRestricciones: ${contrato.restricciones || "Sin restricciones adicionales declaradas."}`);
  escribirSeccionContrato(pdf, "Garantia", `${Number(contrato.garantiaDias || 0)} dias desde el cierre conforme. ${contrato.exclusiones || ""}`);
  escribirSeccionContrato(pdf, "Condiciones, cambios y cancelacion", `${contrato.condiciones || ""}\nTodo cambio de alcance, precio o plazo requiere una orden escrita aceptada en el expediente. Las pausas, cancelaciones y reclamos deben registrarse con motivo y evidencia.`);
  escribirSeccionContrato(pdf, "Privacidad y evidencias", "Las partes autorizan el tratamiento restringido de los datos y archivos necesarios para ejecutar, acreditar y resolver el servicio conforme a los terminos y la politica de privacidad de VIGNA. La publicacion de fotografias requiere autorizacion independiente.");
  pdf.moveDown(2.4).strokeColor("#222222").moveTo(60, pdf.y).lineTo(250, pdf.y).stroke().moveTo(345, pdf.y).lineTo(535, pdf.y).stroke();
  pdf.moveDown(0.4).font("Helvetica-Bold").fontSize(9).fillColor("#171717").text("Firma del cliente", 60, pdf.y, { width: 190, align: "center" }).text("Firma del profesional", 345, pdf.y - 11, { width: 190, align: "center" });
  pdf.moveDown(1.2).font("Helvetica").fontSize(8).fillColor("#555555").text(`Estado al generar: ${contrato.estado || "Pendiente de firma"} | Documento generado por VIGNA; la firma digital certificada requiere un proveedor acreditado.`);
  pdf.end();
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

function extraerProductosDePago(pago) {
  let carrito = pago.metadata?.carrito;

  if (typeof carrito === "string") {
    try { carrito = JSON.parse(carrito); } catch (_error) { carrito = null; }
  }

  if (!Array.isArray(carrito) || carrito.length < 1) return null;

  const productos = [];
  for (const item of carrito) {
    const producto = CATALOGO.porSku.get(String(item?.sku || ""));
    const cantidad = Number(item?.cantidad);
    if (!producto || !Number.isInteger(cantidad) || cantidad < 1 || cantidad > 20) return null;
    productos.push({ ...producto, cantidad });
  }

  return productos;
}

function construirMovimientoId(paymentId, sku, tipo) {
  return `mov-${String(paymentId).replace(/[^a-zA-Z0-9_-]/g, "_")}-${String(sku).replace(/[^a-zA-Z0-9_-]/g, "_")}-${tipo}`;
}

function estadoPedidoDesdePago(status) {
  const clave = String(status || "").toLowerCase();
  if (clave === "approved") return "pagado";
  if (clave === "cancelled") return "cancelado";
  if (clave === "refunded") return "reembolsado";
  if (clave === "rejected") return "rechazado";
  if (clave === "pending") return "pendiente";
  if (clave === "in_process") return "en proceso";
  return clave || "pendiente";
}

function esPagoAprobado(status) {
  return String(status || "").toLowerCase() === "approved";
}

function esPagoRestauracion(status) {
  return ["cancelled", "refunded"].includes(String(status || "").toLowerCase());
}

async function procesarPagoInventario(pago) {
  if (!adminDb) {
    return {
      valido: false,
      error: "El servidor no está disponible."
    };
  }

  const status = String(pago.status || "").toLowerCase();
  const paymentId = String(pago.id || "").trim();
  const pedidoId = String(
    pago.metadata?.pedido_id || pago.external_reference || ""
  ).trim();
  const productos = extraerProductosDePago(pago);
  const totalPagado = Number(pago.transaction_amount || 0);

  if (!pedidoId || !productos) {
    return {
      valido: false,
      estado: status,
      pedidoId,
      total: totalPagado,
      error: "El pago no contiene datos de pedido válidos."
    };
  }

  const validacionAprobada = validarDatosPagoPedido(pago);
  const pedidoRef = adminDb.collection("pedidos").doc(pedidoId);

  await adminDb.runTransaction(async (transaccion) => {
    // PRIMERA ETAPA: todas las lecturas.
    const pedidoSnap = await transaccion.get(pedidoRef);

    if (!pedidoSnap.exists) return;

    const pedido = pedidoSnap.data() || {};
    const pagoAnterior = String(pedido.estadoPago || "").toLowerCase();

    const debeAplicarDescuento =
      esPagoAprobado(status) &&
      validacionAprobada.valido &&
      pagoAnterior !== "approved";

    const debeRestaurar =
      esPagoRestauracion(status) &&
      pagoAnterior === "approved";

    if (debeAplicarDescuento) {
      const descuentos = [];

      if (CONTROL_INVENTARIO) {
        for (const producto of productos) {
          const inventarioRef = adminDb
            .collection("inventario")
            .doc(producto.sku);

          const movimientoRef = adminDb
            .collection(INVENTARIO_MOVIMIENTOS_COLLECTION)
            .doc(
              construirMovimientoId(
                paymentId,
                producto.sku,
                "descuento"
              )
            );

          const snapshotInventario =
            await transaccion.get(inventarioRef);

          const snapshotMovimiento =
            await transaccion.get(movimientoRef);

          if (!snapshotInventario.exists) {
            throw new Error(
              `No existe inventario para ${producto.sku}.`
            );
          }

          // El movimiento ya fue aplicado. No se vuelve a descontar.
          if (snapshotMovimiento.exists) continue;

          const datosInventario =
            snapshotInventario.data() || {};

          const stockAnterior =
            Number(datosInventario.stock || 0);

          if (stockAnterior < producto.cantidad) {
            throw new Error(
              `No hay stock suficiente de ${producto.nombre}.`
            );
          }

          descuentos.push({
            inventarioRef,
            movimientoRef,
            datosInventario,
            producto,
            stockAnterior
          });
        }
      }

      // SEGUNDA ETAPA: todas las escrituras.
      const ahoraMs = Date.now();

      transaccion.set(
        pedidoRef,
        {
          pedidoId,
          total: totalPagado,
          moneda: "PEN",
          estado: "pagado",
          estadoPago: "approved",
          paymentId,
          pagadoEnMs: ahoraMs,
          actualizadoEnMs: ahoraMs
        },
        { merge: true }
      );

      for (const descuento of descuentos) {
        const {
          inventarioRef,
          movimientoRef,
          datosInventario,
          producto,
          stockAnterior
        } = descuento;

        const stockNuevo =
          stockAnterior - producto.cantidad;

        transaccion.update(inventarioRef, {
          stock: stockNuevo,
          vendidos:
            Number(datosInventario.vendidos || 0) +
            producto.cantidad,
          actualizadoEnMs: ahoraMs
        });

        transaccion.set(movimientoRef, {
          sku: producto.sku,
          producto: producto.nombre,
          cantidad: producto.cantidad,
          pedidoId,
          paymentId,
          tipo: "descuento",
          stockAnterior,
          stockNuevo,
          fecha: new Date(ahoraMs).toISOString(),
          creadoEnMs: ahoraMs
        });
      }

      return;
    }

    if (debeRestaurar) {
      const restauraciones = [];

      if (CONTROL_INVENTARIO) {
        for (const producto of productos) {
          const inventarioRef = adminDb
            .collection("inventario")
            .doc(producto.sku);

          const restauracionRef = adminDb
            .collection(INVENTARIO_MOVIMIENTOS_COLLECTION)
            .doc(
              construirMovimientoId(
                paymentId,
                producto.sku,
                "restauracion"
              )
            );

          const snapshotInventario =
            await transaccion.get(inventarioRef);

          const snapshotRestauracion =
            await transaccion.get(restauracionRef);

          if (
            !snapshotInventario.exists ||
            snapshotRestauracion.exists
          ) {
            continue;
          }

          const datosInventario =
            snapshotInventario.data() || {};

          const stockAnterior =
            Number(datosInventario.stock || 0);

          restauraciones.push({
            inventarioRef,
            restauracionRef,
            producto,
            stockAnterior
          });
        }
      }

      // Después de terminar las lecturas se realizan las escrituras.
      const ahoraMs = Date.now();

      transaccion.set(
        pedidoRef,
        {
          estado: estadoPedidoDesdePago(status),
          estadoPago: status,
          actualizadoEnMs: ahoraMs
        },
        { merge: true }
      );

      for (const restauracion of restauraciones) {
        const {
          inventarioRef,
          restauracionRef,
          producto,
          stockAnterior
        } = restauracion;

        const stockNuevo =
          stockAnterior + producto.cantidad;

        transaccion.update(inventarioRef, {
          stock: stockNuevo,
          actualizadoEnMs: ahoraMs
        });

        transaccion.set(restauracionRef, {
          sku: producto.sku,
          producto: producto.nombre,
          cantidad: producto.cantidad,
          pedidoId,
          paymentId,
          tipo: "restauracion",
          stockAnterior,
          stockNuevo,
          fecha: new Date(ahoraMs).toISOString(),
          creadoEnMs: ahoraMs
        });
      }

      return;
    }

    transaccion.set(
      pedidoRef,
      {
        estado: estadoPedidoDesdePago(status),
        estadoPago: status,
        actualizadoEnMs: Date.now()
      },
      { merge: true }
    );
  });

  return {
    valido:
      esPagoAprobado(status) &&
      validacionAprobada.valido,
    estado: status,
    pedidoId,
    total: totalPagado,
    error:
      esPagoAprobado(status) &&
      !validacionAprobada.valido
        ? validacionAprobada.error
        : ""
  };
}

async function consultarYProcesarPagoPedido(paymentId) {
  const pago = await consultarMercadoPago(`/v1/payments/${paymentId}`);
  return await procesarPagoInventario(pago);
}

function validarDatosPagoPlan(pago) {
  const tipoPago = String(pago.metadata?.tipo_pago || "").toLowerCase();
  const planId = String(pago.metadata?.plan_id || pago.additional_info?.items?.[0]?.id || "").toLowerCase();
  const plan = PLANES[planId];
  const uidMetadata = String(pago.metadata?.profesional_uid || "").trim();
  const uidReferencia = String(pago.external_reference || "").trim();
  const identidadConsistente = Boolean(uidMetadata && uidReferencia && uidMetadata === uidReferencia);
  const profesionalUid = identidadConsistente ? uidMetadata : "";
  const totalPagado = Number(pago.transaction_amount || 0);
  const estado = String(pago.status || "").toLowerCase();
  const aprobado = tipoPago === "plan_profesional" && estado === "approved" && pago.currency_id === "PEN" &&
    plan && identidadConsistente && plomeroIdValido(profesionalUid) && Math.abs(totalPagado - plan.precio) < 0.001;

  return {
    valido: Boolean(aprobado),
    estado,
    planId,
    plan,
    profesionalUid,
    total: totalPagado,
    error: aprobado ? "" : "El pago no está aprobado o no coincide con el plan solicitado."
  };
}

function sumarMeses(fechaBase, meses) {
  const fecha = new Date(fechaBase);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);
  return fecha;
}

async function procesarPagoPlanProfesional(pago) {
  if (!adminDb) return { valido: false, error: "El servidor no está disponible." };

  const paymentId = String(pago.id || "").trim();
  const validacion = validarDatosPagoPlan(pago);
  if (!/^\d{1,30}$/.test(paymentId) || !validacion.plan || !plomeroIdValido(validacion.profesionalUid)) {
    return { ...validacion, valido: false, error: "El pago no contiene un plan profesional verificable." };
  }

  const pagoRef = adminDb.collection(PAGOS_PLANES_COLLECTION).doc(paymentId);
  const planRef = adminDb.collection(PLANES_PROFESIONALES_COLLECTION).doc(validacion.profesionalUid);
  const profesionalRef = adminDb.collection(PROFESIONALES_COLLECTION).doc(validacion.profesionalUid);
  const auditoriaRef = adminDb.collection(AUDITORIA_PROFESIONALES_COLLECTION).doc(`pago-plan-${paymentId}`);
  let resultado = { ...validacion, paymentId };

  await adminDb.runTransaction(async (transaccion) => {
    const [pagoSnap, planSnap, profesionalSnap] = await Promise.all([
      transaccion.get(pagoRef),
      transaccion.get(planRef),
      transaccion.get(profesionalRef)
    ]);

    if (!profesionalSnap.exists) throw new Error("El perfil profesional asociado ya no existe.");

    const ahoraFecha = new Date();
    const ahoraIso = ahoraFecha.toISOString();
    const pagoAnterior = pagoSnap.data() || {};
    const planActual = planSnap.data() || {};
    if (pagoAnterior.profesionalUid && pagoAnterior.profesionalUid !== validacion.profesionalUid) {
      throw new Error("El pago ya está asociado a otra cuenta profesional.");
    }
    if ((planActual.uid && planActual.uid !== validacion.profesionalUid) ||
        (planActual.profesionalUid && planActual.profesionalUid !== validacion.profesionalUid)) {
      throw new Error("El plan almacenado no corresponde a la cuenta profesional.");
    }
    const profesionalActual = profesionalSnap.data() || {};
    if (profesionalActual.uid && profesionalActual.uid !== validacion.profesionalUid) {
      throw new Error("El perfil almacenado no corresponde a la cuenta profesional.");
    }
    const basePago = {
      id: paymentId,
      paymentId,
      profesionalUid: validacion.profesionalUid,
      planId: validacion.planId,
      tipo: validacion.plan.nombre,
      monto: validacion.total,
      moneda: String(pago.currency_id || ""),
      estado: validacion.estado || "desconocido",
      origen: "Mercado Pago",
      actualizadoEn: ahoraIso
    };

    if (validacion.valido && pagoAnterior.estado !== "approved") {
      const vencimientoAnterior = Date.parse(planActual.venceEn || "");
      const inicio = planActual.estado === "Activo" && Number.isFinite(vencimientoAnterior) && vencimientoAnterior > ahoraFecha.getTime()
        ? new Date(vencimientoAnterior)
        : ahoraFecha;
      const venceEn = sumarMeses(inicio, validacion.plan.meses).toISOString();
      const tipo = validacion.planId.charAt(0).toUpperCase() + validacion.planId.slice(1);

      transaccion.set(pagoRef, { ...basePago, creadoEn: pagoAnterior.creadoEn || ahoraIso, aprobadoEn: ahoraIso, venceEn }, { merge: true });
      transaccion.set(planRef, {
        uid: validacion.profesionalUid,
        profesionalUid: validacion.profesionalUid,
        tipo,
        precio: validacion.plan.precio,
        meses: validacion.plan.meses,
        estado: "Activo",
        activadoEn: ahoraIso,
        venceEn,
        paymentId,
        proveedorPago: "Mercado Pago",
        actualizadoEn: ahoraIso
      }, { merge: true });
      transaccion.set(profesionalRef, {
        plan: tipo,
        planEstado: "Activo",
        planInicioEn: ahoraIso,
        planVenceEn: venceEn,
        planPaymentId: paymentId,
        actualizadoEn: ahoraIso
      }, { merge: true });
      transaccion.set(auditoriaRef, {
        accion: "Plan profesional pagado y activado",
        detalle: `${validacion.profesionalUid}: ${tipo} hasta ${venceEn}`,
        actorUid: "mercado-pago",
        actorEmail: "",
        participantes: [validacion.profesionalUid],
        fecha: ahoraIso
      });
      resultado = { ...resultado, valido: true, tipo, venceEn };
      return;
    }

    if (["cancelled", "refunded", "charged_back"].includes(validacion.estado) && pagoAnterior.estado === "approved") {
      transaccion.set(pagoRef, basePago, { merge: true });
      if (String(planActual.paymentId || "") === paymentId) {
        transaccion.set(planRef, { estado: "Suspendido", actualizadoEn: ahoraIso }, { merge: true });
        transaccion.set(profesionalRef, { planEstado: "Suspendido", actualizadoEn: ahoraIso }, { merge: true });
      }
      transaccion.set(auditoriaRef, {
        accion: "Pago de plan revertido",
        detalle: `${validacion.profesionalUid}: ${paymentId} · ${validacion.estado}`,
        actorUid: "mercado-pago",
        actorEmail: "",
        participantes: [validacion.profesionalUid],
        fecha: ahoraIso
      }, { merge: true });
      resultado = { ...resultado, valido: false, error: "El pago del plan fue revertido." };
      return;
    }

    transaccion.set(pagoRef, { ...basePago, creadoEn: pagoAnterior.creadoEn || ahoraIso }, { merge: true });
    if (pagoAnterior.estado === "approved") {
      resultado = { ...resultado, valido: true, tipo: planActual.tipo || validacion.plan.nombre, venceEn: planActual.venceEn || pagoAnterior.venceEn || "" };
    }
  });

  return resultado;
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

app.get("/movimientos-inventario", async (req, res) => {
  if (!adminDb) {
    return res.status(503).json({
      activo: false,
      movimientos: [],
      error: "El servidor no está disponible."
    });
  }

  const autorizacion = String(req.headers.authorization || "");

  if (!autorizacion.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autorizado." });
  }

  const idToken = autorizacion.slice(7).trim();

  if (!idToken) {
    return res.status(401).json({ error: "No autorizado." });
  }

  try {
    const usuario = await getAdminAuth().verifyIdToken(idToken);
    const adminSnap = await adminDb
      .collection("admins")
      .doc(usuario.uid)
      .get();

    const adminDatos = adminSnap.data() || {};

    if (
      !adminSnap.exists ||
      adminDatos.activo === false ||
      adminDatos.rol !== "admin"
    ) {
      return res.status(403).json({ error: "Acceso prohibido." });
    }

    const snapshot = await adminDb
      .collection(INVENTARIO_MOVIMIENTOS_COLLECTION)
      .orderBy("creadoEnMs", "desc")
      .limit(200)
      .get();

    const movimientos = snapshot.docs.map((documento) => ({
      id: documento.id,
      ...documento.data()
    }));

    return res.json({
      activo: CONTROL_INVENTARIO,
      movimientos
    });
  } catch (error) {
    if (String(error.code || "").startsWith("auth/")) {
      return res.status(401).json({ error: "Sesión no válida." });
    }

    console.error(
      "No se pudieron consultar los movimientos de inventario.",
      { message: error.message }
    );

    return res.status(503).json({
      error: "No se pudieron consultar los movimientos de inventario."
    });
  }
});

async function crearPagoPlan(req, res) {
  if (!credencialDisponible(res)) return;
  const sesion = await exigirProfesionalAutenticado(req, res);
  if (!sesion) return;

  const planId = String(req.body?.planId || "").toLowerCase();
  const plan = PLANES[planId];
  if (!plan) return res.status(400).json({ error: "El plan seleccionado no es válido." });

  try {
    const planActualSnap = await adminDb.collection(PLANES_PROFESIONALES_COLLECTION).doc(sesion.uid).get();
    const planActual = planActualSnap.data() || {};
    const venceActual = Date.parse(planActual.venceEn || "");
    if (planActual.estado === "Activo" && (!Number.isFinite(venceActual) || venceActual > Date.now())) {
      return res.status(409).json({ error: "Ya tienes un plan vigente. Podrás renovarlo cuando se acerque su vencimiento." });
    }

    const origenRetorno = obtenerOrigenRetorno(req.headers.origin);
    const preferencia = {
      items: [{ id: plan.id, title: plan.nombre, quantity: 1, unit_price: plan.precio, currency_id: "PEN" }],
      payer: sesion.email ? { email: sesion.email } : undefined,
      back_urls: {
        success: `${origenRetorno}/mvp-profesionales.html?pagoPlan=retorno`,
        failure: `${origenRetorno}/mvp-profesionales.html?pagoPlan=fallido`,
        pending: `${origenRetorno}/mvp-profesionales.html?pagoPlan=pendiente`
      },
      auto_return: "approved",
      external_reference: sesion.uid,
      metadata: { tipo_pago: "plan_profesional", plan_id: plan.id, profesional_uid: sesion.uid }
    };
    if (MP_NOTIFICATION_URL.startsWith("https://")) preferencia.notification_url = MP_NOTIFICATION_URL;

    const data = await consultarMercadoPago("/checkout/preferences", {
      method: "POST",
      body: JSON.stringify(preferencia)
    });
    const initPoint = data.init_point || data.sandbox_init_point;
    if (!initPoint) throw new Error("Mercado Pago no devolvió un enlace de pago.");
    const solicitadoEn = new Date().toISOString();
    await adminDb.collection(PLANES_PROFESIONALES_COLLECTION).doc(sesion.uid).set({
      uid: sesion.uid,
      profesionalUid: sesion.uid,
      tipo: planId.charAt(0).toUpperCase() + planId.slice(1),
      precio: plan.precio,
      meses: plan.meses,
      estado: "Pendiente de pago",
      solicitadoEn,
      activadoEn: "",
      venceEn: "",
      preferenciaId: data.id || "",
      actualizadoEn: solicitadoEn
    }, { merge: true });
    return res.json({ init_point: initPoint, preferenciaId: data.id || "" });
  } catch (error) {
    console.error("No se pudo crear la preferencia de pago.", { status: error.status || 500, message: error.message });
    return res.status(502).json({ error: "No se pudo iniciar el pago. Inténtalo nuevamente." });
  }
}

app.post("/crear-pago-plan", limitarCreacionPagos, crearPagoPlan);
// Compatibilidad temporal con las páginas web anteriores. También exige sesión Firebase.
app.post("/crear-pago", limitarCreacionPagos, crearPagoPlan);

app.post("/crear-pago-productos", limitarCreacionPagos, async (req, res) => {
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
  const paymentId = String(
    req.query["data.id"] || req.body?.data?.id || ""
  );

  if (
    (!MP_WEBHOOK_SECRET && !MP_WEBHOOK_SECRET_TEST) ||
    !/^\d{1,30}$/.test(paymentId)
  ) {
    return res.sendStatus(400);
  }

  try {
    const secretosWebhook = [
      MP_WEBHOOK_SECRET,
      MP_WEBHOOK_SECRET_TEST
    ].filter(Boolean);

    let firmaValida = false;

    for (const secret of secretosWebhook) {
      try {
        WebhookSignatureValidator.validate({
          xSignature: req.headers["x-signature"],
          xRequestId: req.headers["x-request-id"],
          dataId: paymentId,
          secret
        });

        firmaValida = true;
        break;
      } catch (error) {
        if (!(error instanceof InvalidWebhookSignatureError)) {
          throw error;
        }
      }
    }

    if (!firmaValida) {
      return res.sendStatus(401);
    }

    console.log("Webhook Mercado Pago recibido.", {
      paymentId,
      action: req.body?.action || "",
      fecha: new Date().toISOString()
    });

    // Procesa el pago después de responder a Mercado Pago.
    setImmediate(() => {
      consultarMercadoPago(`/v1/payments/${paymentId}`).then((pago) => {
        return pago.metadata?.tipo_pago === "plan_profesional"
          ? procesarPagoPlanProfesional(pago)
          : procesarPagoInventario(pago);
      }).catch((error) => {
        console.error("No se pudo procesar el pago del webhook.", {
          paymentId,
          message: error.message
        });
      });
    });

    // Mercado Pago recibe la respuesta inmediatamente.
    return res.sendStatus(200);
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return res.sendStatus(401);
    }

    console.error("No se pudo validar el webhook de Mercado Pago.", {
      message: error.message
    });

    return res.sendStatus(500);
  }
});

app.get("/verificar-pago-plan/:paymentId", limitarVerificacionPagos, async (req, res) => {
  if (!credencialDisponible(res)) return;
  const sesion = await exigirProfesionalAutenticado(req, res);
  if (!sesion) return;
  const paymentId = String(req.params.paymentId || "");
  if (!/^\d{1,30}$/.test(paymentId)) return res.status(400).json({ error: "El identificador del pago no es válido." });

  try {
    const pago = await consultarMercadoPago(`/v1/payments/${paymentId}`);
    const propietario = String(pago.metadata?.profesional_uid || pago.external_reference || "").trim();
    if (propietario !== sesion.uid) {
      return res.status(403).json({ error: "El pago no corresponde a esta cuenta profesional." });
    }
    const resultado = await procesarPagoPlanProfesional(pago);
    if (!resultado.valido) {
      return res.status(409).json({ aprobado: false, estado: resultado.estado || "desconocido", error: resultado.error });
    }
    return res.json({ aprobado: true, profesionalUid: sesion.uid, plan: resultado.tipo, venceEn: resultado.venceEn, paymentId });
  } catch (error) {
    console.error("No se pudo verificar el pago.", { status: error.status || 500, message: error.message });
    return res.status(502).json({ error: "No se pudo verificar el pago." });
  }
});

app.get("/verificar-pago/:paymentId", limitarVerificacionPagos, async (req, res) => {
  req.url = `/verificar-pago-plan/${encodeURIComponent(req.params.paymentId || "")}`;
  return res.redirect(307, req.url);
});

app.get("/api/profesionales/contratos/:contratoId/pdf", limitarPdfContratos, async (req, res) => {
  try {
    const usuario = await exigirUsuarioFirebase(req, res);
    if (!usuario) return;
    const contratoId = String(req.params.contratoId || "");
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(contratoId)) return res.status(400).json({ error: "El contrato no es válido." });
    const [contratoSnapshot, adminSnapshot] = await Promise.all([
      adminDb.collection(CONTRATOS_PROFESIONALES_COLLECTION).doc(contratoId).get(),
      adminDb.collection("admins").doc(usuario.uid).get()
    ]);
    if (!contratoSnapshot.exists) return res.status(404).json({ error: "El contrato no existe." });
    const contrato = { id: contratoSnapshot.id, ...contratoSnapshot.data() };
    const participante = [contrato.clienteUid, contrato.profesionalUid].includes(usuario.uid);
    const adminDatos = adminSnapshot.data() || {};
    const administradorActivo = adminSnapshot.exists && adminDatos.activo !== false &&
      ["admin", "superadmin", "moderacion", "soporte", "finanzas"].includes(String(adminDatos.rol || "superadmin").toLowerCase());
    if (!participante && !administradorActivo) return res.status(403).json({ error: "No tienes acceso a este contrato." });
    return generarPdfContrato(res, contrato);
  } catch (error) {
    console.error("No se pudo generar el PDF contractual.", { message: error.message });
    if (!res.headersSent) return res.status(500).json({ error: "No se pudo generar el PDF contractual." });
    return res.end();
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

module.exports = {
  app,
  PLANES,
  CATALOGO,
  resolverCarrito,
  validarComprador,
  validarDatosPagoPedido,
  validarDatosPagoPlan,
  sumarMeses,
  obtenerOrigenRetorno,
  generarPdfContrato,
  crearLimitadorSolicitudes
};
