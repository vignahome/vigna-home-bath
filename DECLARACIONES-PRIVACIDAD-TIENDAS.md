# Declaraciones de privacidad para las tiendas

Documento operativo para VIGNA `1.0.0` (`pe.vigna.profesionales`). Debe compararse con la compilación final antes de responder en las consolas.

## Google Play: seguridad de datos

- La aplicación recopila datos y los transmite cifrados mediante HTTPS a Firebase.
- Los datos están vinculados a la cuenta; VIGNA no los usa para seguimiento entre aplicaciones o sitios.
- No se venden datos personales.
- Existe solicitud de eliminación dentro de la app y en una URL pública externa.
- La búsqueda pública funciona sin cuenta. Registro, solicitudes y contratos requieren autenticación.

### Categorías que deben declararse

| Categoría de Play | Datos utilizados por VIGNA | Finalidad |
| --- | --- | --- |
| Información personal | nombre, correo, teléfono/WhatsApp, documento, datos profesionales | cuenta, verificación, contacto y prevención de fraude |
| Ubicación aproximada | departamento, provincia, distrito, cobertura escrita | encontrar profesionales compatibles; no se usa GPS |
| Información financiera | montos, condiciones y pagos declarados; no números de tarjeta | cotizaciones, contratos y seguimiento |
| Fotos y videos | portafolio, documentos y evidencias elegidos por el usuario | verificación y ejecución del servicio |
| Archivos y documentos | certificados, contratos, anexos y comprobantes | verificación y expediente contractual |
| Mensajes | comunicaciones y solicitudes contractuales | coordinación, soporte y auditoría |
| Actividad en la app | solicitudes, cotizaciones, estados y actuaciones | funcionamiento, seguridad y soporte |
| Identificadores | UID de Firebase y folios internos | autenticación y asociación de registros |

No declarar acceso a contactos, ubicación precisa, salud, calendario, historial web, identificador publicitario ni información de pago de tarjetas mientras la compilación no incorpore esas funciones.

## App Store: etiquetas de privacidad

Marcar como datos vinculados con la identidad, usados para funcionalidad de la app:

- Información de contacto: nombre, correo y teléfono.
- Identificadores: ID de usuario.
- Contenido del usuario: fotos/videos, archivos, mensajes y atención al cliente.
- Compras: historial contractual y pagos declarados, sin información de tarjeta.
- Otra información: profesión, cobertura, documentos de verificación y calificaciones.
- Ubicación aproximada: solo la ubicación escrita por el usuario.

No marcar “Datos usados para rastrearte”. No declarar publicidad de terceros ni publicidad propia.

## Permisos móviles

- Cámara: adjuntar fotos o evidencias solo cuando el usuario lo solicita.
- Fotos: seleccionar documentos, portafolio y evidencias.
- Micrófono: adjuntar video con audio cuando el usuario lo decide.
- La aplicación debe seguir funcionando en las secciones que no requieren archivos si se rechaza el permiso.

## Notas sugeridas para revisión

VIGNA conecta clientes con profesionales verificados. La búsqueda pública no requiere inicio de sesión. Las cuentas permiten solicitar servicios, cotizar, formalizar contratos y conservar evidencias. La cámara, la fototeca y el micrófono solo se usan cuando el usuario adjunta contenido voluntariamente.

La eliminación se encuentra al final de la pantalla en “Eliminar mi cuenta”. El usuario inicia sesión, confirma la solicitud definitiva y puede consultar su estado. La administración elimina o anonimiza los datos que no deban conservarse y documenta cualquier conservación contractual o legal restringida.

Proporcionar al revisor dos cuentas sin privilegios administrativos:

1. Cliente con una solicitud de ejemplo.
2. Profesional aprobado con plan de revisión y una solicitud compatible.

No incluir credenciales reales ni de administración en este repositorio.
