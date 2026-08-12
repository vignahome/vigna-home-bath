# Profesionales Vigna’s — matriz de aceptación

Fecha de revisión: 11 de agosto de 2026

Rama de mantenimiento: `agent/profesionales-vigna-mvp`

Integración base: `main`

## Implementado y verificable

- Registro separado de cliente, profesional, especialidades, cobertura y documentos privados.
- Publicación condicionada por aprobación, especialidad verificada y plan vigente.
- Buscador, ranking ponderado, disponibilidad, cobertura e idiomas.
- Portafolio verificable con consentimiento y moderación.
- Solicitud técnica guiada y archivos privados.
- Tres opciones de cotización con desglose, vigencia, exclusiones e historial de versiones.
- Contrato imprimible, anexo Excel opcional, huella SHA-256 y confirmación bilateral.
- Ejecución por hitos, evidencias, pagos declarados y órdenes de cambio.
- Mensajería contractual, adjuntos, pausa, reanudación y cancelación auditadas.
- Acta de entrega, reputación verificada y garantía vinculada al contrato.
- Asistencia, reclamos, notificaciones globales y trazabilidad por participante.
- Roles administrativos, KPI y exportaciones de operación/auditoría.
- Reglas Firestore y Storage sin lectura pública de identidad, contratos o expedientes.
- Proyecto Firebase e índices declarados, publicación aislada y comandos de despliegue reproducibles.
- Diseño adaptable para escritorio, tableta y móvil.
- Planes web cobrados mediante Mercado Pago con verificación de sesión, propietario e idempotencia.
- Identidad del perfil y del plan aislada estrictamente por UID autenticado.
- PDF contractual generado por el servidor, privado, sin caché y accesible solo para las partes o administración.
- Desglose económico calculado, forma de pago, responsabilidades, restricciones, cambios, cancelación y privacidad incorporados al contrato.
- Verificación de correo iniciada al crear cuentas y vencimiento documental registrado.
- Libro de Reclamaciones enlazado con expedientes privados de Asistencia.
- Política inicial de conservación, cancelaciones, pagos, reembolsos y garantías publicada.
- Encabezados defensivos en Hosting/API y límites de abuso para creación/verificación de pagos y descarga de contratos.

Prueba visual local ejecutada en 1440 px, 1024 px y 390 px: sin errores de página, ID duplicados ni desbordamiento horizontal. La prueba detectó y permitió corregir una inicialización de métricas sin reseñas.

## Pendiente externo antes del lanzamiento público

Estos puntos no deben activarse por suposición:

1. Revisión y aprobación de los textos legales por un abogado peruano y definición del titular legal de VIGNA.
2. Inscripción de los bancos de datos personales y evaluación/registro del flujo transfronterizo correspondiente.
3. Alta formal del Libro de Reclamaciones del proveedor y definición del responsable/plazo de respuesta.
4. Proveedor KYC si VIGNA desea afirmar validación oficial de DNI/CE/RUC; mientras tanto la plataforma declara revisión documental administrativa.
5. Verificación de teléfono, doble factor administrativo y proveedores opcionales de correo, SMS o WhatsApp.
6. Escaneo antimalware, monitoreo, backups y plan organizacional de respuesta a incidentes.
7. Firma digital certificada mediante proveedor acreditado si el negocio decide superar la firma manuscrita cargada y confirmada bilateralmente.
8. StoreKit y Google Play Billing, cuentas de desarrollador, firma privada y materiales de tienda para publicar las aplicaciones nativas.
9. Limpieza o anonimización controlada de cuentas, contratos, documentos y notificaciones usados en pruebas.
10. Despliegue manual de servidor, reglas y Hosting después de revisar este commit; los pushes ya no despliegan Firebase automáticamente.

## Criterio de salida

El código y las pruebas automatizadas están preparados para publicación controlada. La apertura comercial debe esperar la revisión legal, los registros de privacidad, la limpieza de datos de prueba y la publicación manual coordinada de servidor, reglas y Hosting.
