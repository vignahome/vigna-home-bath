# Publicación de VIGNA en tiendas móviles

## Identidad aprobada

- Nombre visible: `VIGNA`
- Android application ID: `pe.vigna.profesionales`
- iOS bundle ID: `pe.vigna.profesionales`
- Versión inicial: `1.0.0`
- Código de compilación inicial: `1`
- Categoría sugerida: Hogar y vivienda

## Texto breve sugerido

Encuentra profesionales verificados, solicita servicios y gestiona contratos.

## Descripción sugerida

VIGNA conecta clientes con profesionales verificados para solicitar, cotizar y gestionar servicios de forma organizada. Los clientes pueden describir lo que necesitan, comparar alternativas, formalizar contratos y revisar el avance. Los profesionales administran sus especialidades, cobertura, portafolio, cotizaciones y expedientes de servicio. La plataforma incorpora revisión administrativa, notificaciones y evidencias protegidas.

## Declaración funcional para revisión

- La búsqueda pública puede consultarse sin iniciar sesión.
- El registro, las solicitudes y los contratos requieren una cuenta.
- Cámara, fotos, videos y archivos solo se usan cuando la persona decide adjuntar documentación o evidencias.
- Firebase Authentication gestiona el acceso.
- Firestore almacena perfiles, solicitudes, cotizaciones, contratos, notificaciones y auditoría.
- Firebase Storage almacena documentos y evidencias con acceso protegido por reglas.
- La aplicación no vende datos personales ni utiliza archivos privados para publicidad.

## URLs públicas para las consolas

- Política de privacidad: `https://vigna-plomeros.web.app/privacidad-vigna.html`
- Términos de uso: `https://vigna-plomeros.web.app/terminos-vigna.html`
- Soporte: `https://vigna-plomeros.web.app/soporte-vigna.html`
- Eliminación de cuenta: `https://vigna-plomeros.web.app/eliminar-cuenta.html`

Estas URLs estarán disponibles después de publicar Hosting. La eliminación también se inicia dentro de la app desde el pie de página.

## Material que falta aportar en las consolas

- Nombre legal, dirección y datos del titular de las cuentas de desarrollador.
- Capturas finales exigidas por cada tamaño de pantalla.
- Credenciales de revisión para una cuenta de cliente y otra de profesional, sin privilegios administrativos.
- Respuestas definitivas de seguridad de datos de Google Play y privacidad de App Store.

## Android: paquete firmado

1. Crear una clave de carga privada fuera de Git.
2. Copiar `android/keystore.properties.example` como `android/keystore.properties` y reemplazar sus valores.
3. Guardar el archivo `.jks` dentro de `android/` o usar una ruta privada controlada.
4. Ejecutar `npm run mobile:build:android:aab`.
5. El paquete quedará en `android/app/build/outputs/bundle/release/app-release.aab`.
6. Subir primero a la prueba interna de Google Play.

La clave `.jks`, sus contraseñas y `keystore.properties` están excluidos de Git.

## iOS: archivo para App Store Connect

1. Abrir el proyecto en una Mac mediante `npm run mobile:open:ios`.
2. Seleccionar el equipo Apple Developer del titular.
3. Confirmar la versión `1.0.0` y compilación `1`.
4. Configurar la firma automática con el bundle ID aprobado.
5. Ejecutar Product > Archive en Xcode.
6. Validar y distribuir primero a TestFlight.

## Secuencia de publicación recomendada

1. Publicar política de privacidad, soporte y eliminación de cuenta.
2. Crear las fichas en Play Console y App Store Connect.
3. Generar la clave de carga Android y el `.aab`.
4. Archivar iOS desde una Mac.
5. Probar Android internamente y iOS mediante TestFlight.
6. Corregir observaciones antes de solicitar revisión pública.
