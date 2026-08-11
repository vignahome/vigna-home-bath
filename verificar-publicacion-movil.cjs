const fs = require("node:fs");

const leer = (archivo) => fs.readFileSync(archivo, "utf8");
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(`Publicación móvil incompleta: ${mensaje}`);
};

const paquete = JSON.parse(leer("package.json"));
const gradle = leer("android/app/build.gradle");
const androidIgnore = leer("android/.gitignore");
const info = leer("ios/App/App/Info.plist");
const proyectoIos = leer("ios/App/App.xcodeproj/project.pbxproj");

exigir(gradle.includes('applicationId "pe.vigna.profesionales"'), "el identificador Android cambió");
exigir(gradle.includes('versionCode 1') && gradle.includes('versionName "1.0.0"'), "la versión Android inicial no es 1.0.0 (1)");
exigir(gradle.includes("keystore.properties") && gradle.includes("signingConfig signingConfigs.release"), "Android no admite firma externa segura");
exigir(androidIgnore.includes("*.jks") && androidIgnore.includes("keystore.properties"), "la clave o sus credenciales podrían entrar en Git");
exigir(fs.existsSync("android/keystore.properties.example"), "falta el ejemplo de configuración de firma");
exigir(!fs.existsSync("android/keystore.properties"), "keystore.properties contiene secretos y no debe quedar en el repositorio de trabajo");
exigir(info.includes("NSCameraUsageDescription"), "falta explicar el uso de la cámara en iOS");
exigir(info.includes("NSMicrophoneUsageDescription"), "falta explicar el uso del micrófono en iOS");
exigir(info.includes("NSPhotoLibraryUsageDescription"), "falta explicar el acceso a fotos en iOS");
exigir((proyectoIos.match(/MARKETING_VERSION = 1\.0\.0;/g) || []).length === 2, "la versión iOS inicial no es 1.0.0");
exigir(paquete.scripts["mobile:build:android:aab"], "falta el comando para generar el Android App Bundle");
exigir(fs.existsSync("TIENDAS-MOVILES.md"), "falta la ficha y lista de publicación");

console.log("Publicación móvil: identidad, versión, permisos y firma segura verificados.");
require("./verificar-privacidad-cuentas.cjs");
if (!require("node:fs").existsSync("DECLARACIONES-PRIVACIDAD-TIENDAS.md")) throw new Error("Faltan las declaraciones de privacidad para tiendas.");
