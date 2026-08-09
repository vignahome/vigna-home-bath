# Profesionales Vigna’s - MVP de pruebas

Este módulo autocontenido permite validar hoy el flujo completo sin modificar la tienda, los pagos o el módulo profesional legado.

## Acceso local

Abrir `mvp-profesionales.html` con Live Server.

La gestión privada de garantías, reclamos e incidencias se abre desde el menú del MVP o directamente en `garantias-reclamos.html`.

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
- Módulo independiente de garantías y reclamos para cliente, profesional y administración.
- Evidencias privadas vinculadas al contrato mediante Firebase Storage.
- Auditoría básica de todas las operaciones.
- Diseño responsive negro y dorado metálico.

## Persistencia y acceso

El modo conectado usa el proyecto Firebase `vigna-plomeros`: Authentication para las sesiones, Firestore para perfiles, contratos, reclamos y auditoría, y Storage para evidencias privadas. Las reglas limitan cada expediente a su cliente, profesional y administradores autorizados en `admins/{uid}`.

La capa local de demostración se conserva únicamente como respaldo visual cuando Firebase no está disponible.

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
