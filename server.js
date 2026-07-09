require("dotenv").config({
  path: "./.env"
});

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

app.post("/crear-pago", async (req, res) => {
  try {
    const { plan, precio, meses, verificacion, plomeroId } = req.body;

    const preference = {
      items: [
        {
          title: plan,
          quantity: 1,
          unit_price: Number(precio),
          currency_id: "PEN"
        }
      ],
      back_urls: {
        success: `http://127.0.0.1:5500/plomeros.html?pago=aprobado&plan=${encodeURIComponent(plan)}&meses=${meses}&verificacion=${encodeURIComponent(verificacion)}&plomeroId=${plomeroId}`,
        failure: "http://127.0.0.1:5500/plomeros.html?pago=fallido",
        pending: "http://127.0.0.1:5500/plomeros.html?pago=pendiente"
      },
      //auto_return: "approved",
      external_reference: plomeroId
    };

    const respuesta = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });

    const data = await respuesta.json();

    console.log("MERCADO PAGO RESPUESTA:", data);

    if (!respuesta.ok) {
      return res.status(500).json(data);
    }

    res.json({
      init_point: data.init_point || data.sandbox_init_point
    });

  } catch (error) {
    console.error("ERROR SERVER:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log("Servidor Mercado Pago activo en http://localhost:3000");
});