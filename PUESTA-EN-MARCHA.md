# Puesta en marcha de la plataforma comercial VIGNA

El código de la tienda, checkout, cuentas, pedidos, inventario, dashboard y pagos queda preparado. Para activarlo en producción deben completarse estos pasos en orden.

## 1. Pruebas locales

```bash
npm install
npm run check
npm start
```

La web se abre con Live Server y el servidor de pagos utiliza el puerto configurado en `.env`.

## 2. Seguridad de credenciales

- Renovar el Access Token de Mercado Pago que anteriormente estuvo publicado.
- No enviar ni pegar credenciales en chats, HTML, JavaScript del navegador o GitHub.
- Mantener `.env` y la cuenta de servicio de Firebase fuera del repositorio.
- Utilizar `.env.example` únicamente como plantilla.

## 3. Firebase comercial

1. Crear o elegir la cuenta administrativa en Firebase Authentication.
2. Crear el documento `admins/{UID_DE_LA_CUENTA}` en Firestore.
3. Revisar `firestore.rules` antes de publicarlo, especialmente porque el módulo externo de profesionales permanece en demostración.
4. Crear una cuenta de servicio para el servidor y guardarla codificada en Base64 como `FIREBASE_SERVICE_ACCOUNT_BASE64`.
5. Nunca colocar esa cuenta de servicio en la web pública.

## 4. Inventario

1. Entrar a `admin.html` con la cuenta registrada en `admins`.
2. Abrir **Inventario** y pulsar **Sincronizar catálogo**.
3. Completar las existencias y mínimos de cada producto.
4. Activar `CONTROL_INVENTARIO=true` en el servidor solamente cuando todos los artículos estén revisados.

## 5. Servidor comercial

`server.js` debe publicarse en un servicio compatible con Node.js. GitHub Pages solo aloja la parte visual y no ejecuta el servidor.

Variables necesarias:

- `MP_ACCESS_TOKEN`
- `PUBLIC_BASE_URL=https://vignahome.com`
- `ALLOWED_ORIGINS=https://vignahome.com`
- `MP_NOTIFICATION_URL=https://URL-DEL-SERVIDOR/webhook-mercadopago`
- `MP_WEBHOOK_SECRET`
- `FIREBASE_SERVICE_ACCOUNT_BASE64`
- `CONTROL_INVENTARIO=true`
- `PORT`

## 6. Conexión de la web

Después de publicar el servidor, colocar su dirección HTTPS en `vigna-config.js`:

```js
window.VIGNA_CONFIG = Object.freeze({
  apiPagosUrl: "https://URL-DEL-SERVIDOR"
});
```

## 7. Mercado Pago

1. Utilizar primero credenciales y compradores de prueba.
2. Configurar la URL de Webhooks y copiar su clave secreta al servidor.
3. Probar estados aprobado, pendiente y rechazado.
4. Confirmar que un pago aprobado aparece en `admin.html` y descuenta inventario una sola vez.
5. Cambiar a producción únicamente después de completar todas las pruebas.

## 8. Revisión comercial pendiente

Antes de vender públicamente se deben definir y publicar los datos comerciales reales, costo y cobertura de entrega, tiempos, cambios, devoluciones, garantía, comprobantes y política de privacidad.
