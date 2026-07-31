# Profesionales Vigna’s - MVP de pruebas

Este módulo autocontenido permite validar hoy el flujo completo sin modificar la tienda, los pagos o el módulo profesional legado.

## Acceso

Abrir `mvp-profesionales.html` con Live Server.

## Funciones incluidas

- Búsqueda por profesión, departamento, provincia/distrito y estado.
- Registro detallado de profesional con identidad declarada, múltiples profesiones y una principal.
- Cobertura nacional, por departamentos o por zonas locales.
- Registro detallado de cliente.
- Portafolio antes/después con video opcional declarado.
- Solicitudes de servicio con archivos.
- Cotizaciones económica, recomendada y premium.
- Generación de contrato imprimible y carga del documento firmado.
- Panel profesional y panel administrativo.
- Auditoría básica de todas las operaciones.
- Diseño responsive negro y dorado metálico.

## Persistencia

Esta versión usa `localStorage` (`vigna_profesionales_mvp_v1`) para que el flujo pueda probarse sin tocar los datos reales. Los archivos se guardan como nombres/metadatos, y las imágenes del portafolio se comprimen para demostración.

No debe publicarse como producción. La siguiente etapa conecta el mismo modelo a Firebase Auth, Firestore y Storage con reglas por rol y propietario.

## Reiniciar la demostración

Desde la consola del navegador:

```js
VignaProfesionalesMVP.reset()
```

## Seguridad

- No se muestran documentos ni domicilios privados en perfiles públicos.
- Los estados de aprobación se controlan desde el panel de administración de la demo.
- Las cotizaciones y contratos tienen identificadores y versión.
- Esta rama no cambia `main`, Mercado Pago, inventario ni pedidos.
