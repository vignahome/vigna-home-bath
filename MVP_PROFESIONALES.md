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
- Profesiones independientes con experiencia, estado y certificados privados por especialidad.
- Cobertura estructurada por departamentos, provincias, distritos, exclusiones y radio.
- Ranking ponderado por reputación, experiencia, respuesta, actividad y completitud.
- Planes mensual, semestral y anual con solicitud y activación administrativa.
- Portafolio antes/proceso/después, materiales, consentimiento y moderación administrativa.
- Solicitudes guiadas con situación actual, resultado, restricciones, fechas y materiales.
- Cotizaciones económica, recomendada y premium con desglose, vigencia, exclusiones e historial de versiones.
- Garantía con plazo estructurado desde la cotización y vencimiento calculado al cierre conforme.
- Generación de contrato imprimible, huella SHA-256 y confirmación bilateral de una misma versión.
- Anexo Excel opcional del contrato para detallar productos, materiales y ejecución paso a paso, con plantilla descargable y acceso privado para las partes y administración.
- Panel profesional y panel administrativo.
- Mensajería privada por contrato con adjuntos y expediente inmutable.
- Solicitudes formales de pausa, reanudación y cancelación con resolución auditada.
- Roles administrativos de superadmin, moderación, soporte y finanzas.
- KPI de conversión, cierre, reputación y planes, con exportaciones CSV y JSON.
- Módulo independiente de Asistencia para garantías y reclamos de cliente, profesional y administración.
- Evidencias privadas vinculadas al contrato mediante Firebase Storage.
- Centro global de notificaciones en la página principal, alimentado por toda la actividad auditada del usuario y por toda la plataforma para administración.
- Sincronización automática de paneles cuando llega una actividad nueva, con filtro opcional de notificaciones no leídas.
- Acciones directas desde cada notificación hacia su expediente, cotización o contrato específico.
- Estado leído/no leído sincronizado entre dispositivos, con respaldo local si Firebase no está disponible.
- Reglas reforzadas para impedir alterar precios, participantes o campos ajenos durante la contratación.
- Bloqueo de reclamos fuera de garantía o duplicados mientras exista otro expediente activo del contrato.
- Auditoría de operaciones y actuaciones contractuales.
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
- Los certificados, documentos, contratos, conversaciones y evidencias usan rutas privadas y reglas por participante.
- Ningún participante puede confirmar la firma contractual de la otra parte.
- Esta rama no cambia `main`, Mercado Pago, inventario ni pedidos.

## Validación

Ejecutar en Windows PowerShell:

```powershell
npm.cmd run check
```

El comando valida sintaxis e integraciones de Asistencia, ejecución contractual, perfiles, portafolio, cotizaciones, firma bilateral, comunicación, administración y certificados.

Consulta `PROFESIONALES-ACEPTACION.md` para conocer los elementos terminados y las decisiones externas pendientes.
