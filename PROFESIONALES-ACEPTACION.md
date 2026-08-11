# Profesionales Vigna’s — matriz de aceptación

Fecha de revisión: 10 de agosto de 2026  
Rama autorizada: `agent/profesionales-vigna-mvp`

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

Prueba visual local ejecutada en 1440 px, 1024 px y 390 px: sin errores de página, ID duplicados ni desbordamiento horizontal. La prueba detectó y permitió corregir una inicialización de métricas sin reseñas.

## Pendiente de confirmación o proveedor externo

Estos puntos no deben activarse por suposición:

1. Texto legal definitivo: términos, privacidad, consentimiento, retención y eliminación de datos.
2. Política comercial: comisión, reembolsos, penalidades, cancelaciones y responsabilidad por materiales.
3. Proveedor de cobro de planes y, si se adopta, pagos protegidos o escrow.
4. Proveedor KYC para validación real de DNI/CE/RUC y vigencia de certificados.
5. Proveedores de correo, SMS o WhatsApp y plantillas aprobadas.
6. Mapas/geocodificación y reglas finales de distancia o recargos.
7. Cuentas administrativas y asignación nominal de roles en `admins/{uid}`.
8. Índices compuestos adicionales que Firebase solicite al ejercitar consultas con datos reales.
9. Publicación de reglas y hosting: preparada y autorizada, pendiente únicamente de una sesión autenticada con permisos sobre `vigna-plomeros`.
10. Prueba de aceptación con usuarios reales y aprobación expresa para fusionar con `main`.

## Criterio de salida

El código puede continuar sobrescribiéndose en esta rama. No se considera producción hasta resolver los puntos anteriores, ejecutar `npm run deploy:firebase` desde una sesión autorizada y completar una prueba con cuentas reales de cliente, profesional y administración.
