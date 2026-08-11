# Profesionales Vigna’s — cierre de producción

Fecha técnica: 11 de agosto de 2026

Rama autorizada: `agent/profesionales-vigna-mvp`

## Estado técnico cerrado

- Identidad, perfil y plan aislados por UID autenticado.
- Pago de planes verificado por propietario e idempotencia.
- Contratos privados, confirmación bilateral y PDF autenticado.
- Catálogo con degradación segura ante consultas secundarias fallidas.
- Roles administrativos segmentados y revocación efectiva con `activo: false`.
- Reglas Firestore/Storage, límites de abuso y encabezados defensivos.
- Libro de Reclamaciones, privacidad, conservación y solicitudes de eliminación.
- PWA, base Capacitor, pruebas móviles y paquete Hosting aislado.
- Despliegue automático desactivado; toda publicación requiere aprobación manual.

## Evidencia automatizada

Antes de publicar deben finalizar correctamente:

```text
git diff --check
npm run check
npm run build:profesionales
npm audit --omit=dev --audit-level=high
```

No se debe usar `npm audit fix --force`: actualmente intenta un cambio mayor de Firebase Admin para resolver dependencias transitivas moderadas.

## Únicas acciones del propietario

1. Aprobar el commit final y ejecutar el despliegue manual de Firestore/Hosting y Render.
2. Solicitar a un abogado peruano la revisión de Términos, Privacidad y Libro de Reclamaciones.
3. Registrar los bancos de datos personales y definir al responsable formal de reclamos.
4. Contratar, solo si se anuncian esas funciones, proveedores de KYC, teléfono/MFA, antimalware y monitoreo.
5. Configurar un respaldo administrado antes de eliminar o anonimizar datos vivos de prueba.
6. Contratar las cuentas Apple/Google y aprobar la publicación móvil cuando corresponda.

## Datos que deben preservarse

- El pago Mercado Pago `172327649259` no debe cobrarse ni procesarse nuevamente.
- El plan de la cuenta profesional de pago debe conservar su UID y vencimiento.
- No debe modificarse `images/categorias/griferias/productos/modelo-9/portada.png`.

La limpieza de pruebas debe hacerse únicamente después del respaldo y mediante una lista explícita de UID. Nunca debe seleccionarse por nombre, correo parcial ni por ser el primer documento de una colección.
