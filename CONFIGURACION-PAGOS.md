# Configuración segura de pagos VIGNA

La web pública puede permanecer en GitHub Pages, pero `server.js` debe publicarse en un servicio compatible con Node.js. Consulta también `PUESTA-EN-MARCHA.md` para activar pedidos, inventario, panel administrativo y Webhooks.

1. Copia `.env.example` como `.env` únicamente en el servidor.
2. Genera un Access Token nuevo de Mercado Pago y guárdalo como `MP_ACCESS_TOKEN`.
3. Publica el servidor y coloca su dirección HTTPS en `vigna-config.js`.
4. Ejecuta `npm install`, `npm run check` y `npm start`.

Nunca publiques el Access Token en GitHub ni lo coloques en HTML o JavaScript del navegador.
