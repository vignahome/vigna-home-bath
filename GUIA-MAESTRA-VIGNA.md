# Guía maestra de construcción — VIGNA Home & Bath

## Visión oficial

Convertir VIGNA en una plataforma completa para manejar la operación desde un solo lugar:

- Sitio web público premium.
- Tienda online con carrito avanzado.
- Panel de administración para gestionar el negocio.
- Gestión de pedidos e inventario.
- Dashboard con estadísticas de ventas y productos.
- Integración con medios de pago.

Esta guía reúne el alcance completo del proyecto. Las funciones se habilitarán por etapas, pero no se eliminarán las demostraciones ya existentes.

## 1. Tienda pública

- Inicio premium adaptable a computadora, tableta y celular.
- Menú claro con acceso a productos, combos, proyectos, empresa, contacto y profesionales.
- Categorías del catálogo en tres columnas por línea en celulares.
- Catálogo alimentado desde archivos de datos, sin duplicar productos en HTML.
- Buscador por nombre, código, color y características.
- Filtros de color y precio, orden por nombre o precio y contador de resultados.
- Manejo visual de imágenes o videos no disponibles.
- Ficha individual con galería, características, especificaciones, ficha técnica, video y relacionados.
- Carrito persistente con cantidades, subtotales, total, eliminación y vaciado.
- Cotización por WhatsApp con detalle completo del pedido.

## 2. Compra directa

- Página de checkout con resumen del pedido y datos de entrega.
- Validación de artículos, cantidades y precios exclusivamente en el servidor.
- Pago seguro mediante Mercado Pago sin almacenar tarjetas en VIGNA.
- Retorno de pago aprobado, pendiente o rechazado.
- Verificación del pago con Mercado Pago antes de confirmar el pedido.
- Número de pedido y confirmación para el comprador.
- Preparación para costo de envío, comprobantes, historial y notificaciones.

## 3. Clientes

- Registro e inicio de sesión con Firebase.
- Panel del cliente y datos de perfil.
- Solicitudes de servicio y seguimiento de estado.
- Notificaciones cuando un profesional acepte un trabajo.
- Historial de solicitudes y, posteriormente, historial de pedidos.

## 4. Profesionales VIGNA — módulo externo pausado

- El acceso de demostración permanece visible, pero no se modifica durante esta etapa.
- Este sistema será tratado como un proyecto externo a la tienda principal.
- Su registro, panel, solicitudes, ranking y planes se retomarán solamente después de terminar la plataforma comercial VIGNA.

## 5. Administración

- Acceso administrativo protegido.
- Revisión y aprobación de profesionales.
- Gestión de estados, niveles, solicitudes y suscripciones.
- Gestión centralizada del catálogo sin editar manualmente archivos de código.
- Alta, edición, desactivación, precios, categorías e imágenes de productos.
- Gestión de pedidos, clientes, catálogo y estados de pago.

## 6. Pedidos, inventario y estadísticas

- Registro de cada pedido con comprador, artículos, pago, entrega y estado.
- Estados: pendiente, pagado, preparando, enviado, entregado y cancelado.
- Control de existencias y alertas de inventario bajo.
- Movimientos de entrada, venta, devolución y ajuste.
- Dashboard con ventas, pedidos, ticket promedio y productos más vendidos.
- Filtros por fecha, categoría, producto y estado.

## 7. Calidad y publicación

- Diseño responsive y accesible, navegación por teclado y textos alternativos.
- SEO básico, títulos y descripciones por página.
- Imágenes optimizadas y carga diferida.
- Credenciales fuera de GitHub y precios protegidos en el servidor.
- Pruebas de enlaces, recursos, JavaScript, catálogo, carrito y checkout.
- Publicación de la web estática y despliegue separado del servidor Node.js.
- Pruebas de Mercado Pago antes de habilitar cobros reales.

## Orden actual de trabajo

1. Terminar y probar la tienda pública.
2. Terminar carrito y checkout directo.
3. Publicar y probar el servidor de pagos.
4. Completar cuentas y panel de clientes.
5. Construir pedidos, inventario y dashboard administrativo.
6. Realizar pruebas finales y publicar la plataforma comercial completa.
7. Retomar el módulo externo de profesionales en una etapa independiente.
