# Aplicación móvil VIGNA

La aplicación comparte el código web probado y usa Capacitor para producir proyectos nativos Android e iOS.

## Identidad y estructura

- Identificador de aplicación: `pe.vigna.profesionales`
- Nombre visible: `VIGNA`
- Contenido web empaquetado: `hosting-profesionales`
- Android: `android/`
- iOS: `ios/`
- Fuente de icono y splash: `assets/logo.png`

No se usa una URL remota dentro de Capacitor. Cada paquete incluye una copia local del frontend y continúa conectado a Firebase mediante HTTPS.

## Actualizar los proyectos nativos

Después de modificar la web:

```bash
npm install
npm run check
npm run mobile:sync
```

Si cambia el logotipo:

```bash
npm run mobile:assets
npm run mobile:sync
```

## Android

Requiere Android Studio, JDK y Android SDK. Para abrir el proyecto:

```bash
npm run mobile:open:android
```

Antes de publicar en Google Play se debe definir el número de versión, crear una clave de firma privada y generar un Android App Bundle firmado. La clave, sus contraseñas y `local.properties` nunca deben incluirse en Git.

## iOS

Requiere una Mac con Xcode y una cuenta de Apple Developer. Para abrir el proyecto desde macOS:

```bash
npm run mobile:open:ios
```

Antes de publicar se debe seleccionar el equipo de firma, configurar la versión, crear el registro de la app en App Store Connect y archivar desde Xcode. Los perfiles y certificados privados no deben incluirse en Git.

## Revisión previa a tiendas

Además de las pruebas funcionales actuales, la publicación comercial requiere:

- política de privacidad y datos de soporte públicos;
- fichas, capturas y descripciones para ambas tiendas;
- declaración del uso de datos de Firebase, archivos y notificaciones;
- pruebas en teléfonos Android e iPhone reales;
- cuentas de Google Play Console y Apple Developer;
- configuración de firma y versionado fuera del repositorio.

La publicación en Firebase Hosting es independiente de la publicación en tiendas. Las reglas de Firebase no se modifican al sincronizar Capacitor.
