const assert = require("node:assert/strict");
const { PassThrough } = require("node:stream");
const { generarPdfContrato } = require("./server.js");

(async () => {
  const salida = new PassThrough();
  const bloques = [];
  const cabeceras = {};
  salida.type = () => salida;
  salida.setHeader = (nombre, valor) => { cabeceras[nombre] = valor; };
  salida.on("data", (bloque) => bloques.push(bloque));
  const terminado = new Promise((resolve, reject) => salida.on("finish", resolve).on("error", reject));
  generarPdfContrato(salida, {
    id: "CT-REGRESION", version: 1, solicitudId: "SV-1", cotizacionId: "CO-1", cotizacionVersion: 1,
    creadoEn: "2026-08-11T00:00:00.000Z", clienteNombre: "Cliente Prueba", clienteTipoDocumento: "DNI", clienteDocumento: "00000001",
    profesionalNombre: "Profesional Prueba", profesionalTipoDocumento: "DNI", profesionalDocumento: "00000002",
    descripcionSolicitud: "Instalación y prueba final.", detalle: "Trabajo completo y verificable.", opcion: "Recomendada", total: 160,
    desglose: { materiales: 40, manoObra: 100, otros: 20 }, formaPago: "50% al inicio y 50% contra entrega.",
    ubicacion: { departamento: "Lima", provincia: "Lima", distrito: "Surco", direccion: "Dirección contractual", fecha: "2026-08-15" },
    garantiaDias: 90, condiciones: "Condiciones de prueba.", estado: "Pendiente de firma"
  });
  await terminado;
  const pdf = Buffer.concat(bloques);
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-", "la salida no es un PDF real");
  assert.ok(pdf.length > 1500, "el PDF contractual está vacío");
  assert.match(String(cabeceras["Content-Disposition"]), /contrato-CT-REGRESION\.pdf/, "falta nombre de descarga estable");
  assert.equal(cabeceras["Cache-Control"], "private, no-store, max-age=0", "el documento privado admite caché");
  console.log("PDF contractual: generación autenticable y salida privada verificadas.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
