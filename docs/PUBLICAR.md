# Publicar y actualizar Ultimate Realistic Tycoon

Esta guía explica las tres formas de hacer llegar una versión nueva al teléfono **sin perder la partida**, y cómo preparar el paquete para Play Store.

## 1. Por qué antes había que desinstalar (y por qué ya no)

Android solo instala una APK encima de otra si las dos están firmadas con **la misma llave**. Hasta la versión 1.1, cada compilación de GitHub Actions generaba una llave de depuración nueva y al azar, así que cada APK nueva obligaba a desinstalar la anterior (y desinstalar borra los datos de la app, incluida la partida).

Desde la 1.2:

- **Firma fija de instalación:** `android/app/urt-debug.keystore` está en el repositorio (a propósito: es una llave de depuración, no la de publicación). Todas las APK que genere el flujo de GitHub tienen la misma firma y **se instalan encima**, conservando la partida.
- **Actualizaciones por internet:** los cambios del juego (casi todos: reglas, pantallas, contenido) llegan dentro de la app, sin APK nueva (ver punto 3).

### Paso único al pasar de la 1.1 a la 1.2

La APK 1.1 que tenés instalada tiene una firma al azar que nadie conserva, así que **esta única vez** hay que reinstalar:

1. En la 1.1: **Ajustes → Exportar a archivo** y guardá el `.json` en Descargas o Drive.
2. Desinstalá la 1.1 e instalá la 1.2.
3. En la pantalla de inicio de la 1.2 tocá **¿Ya tenías una partida? → Elegir archivo de partida**. Se verifica la contabilidad y se actualiza la partida a la versión nueva.

A partir de ahí no hace falta repetirlo.

## 2. APK instalable (GitHub Actions)

Cada push a `main` ejecuta `.github/workflows/android.yml`:

1. Pruebas automáticas (`npm test`).
2. `npm run build` y `npx cap sync android`.
3. `./gradlew assembleDebug` con la firma fija → `ultimate-realistic-tycoon.apk`.
4. La publica como **artefacto** de la ejecución y como **Release** de GitHub (`v<versión>`), para descargarla directo desde el teléfono en `https://github.com/pbarahona1/gametc/releases/latest`.

## 3. Actualizaciones por internet (sin reinstalar)

La app consulta `ota/manifest.json` en este repositorio (vía `raw.githubusercontent.com`). Si hay una versión mayor que la instalada y compatible con la APK, muestra **"Versión X disponible"**. Al aceptar:

1. descarga la página nueva y comprueba tamaño y huella SHA-256;
2. la guarda en los archivos privados de la app;
3. guarda la partida y una copia extra "antes de actualizar";
4. abre la versión nueva **sin hacerla permanente**;
5. la versión nueva, cuando carga la partida y funciona unos segundos sin errores, se confirma sola.

Si la versión nueva falla al iniciar, vuelve sola a la anterior y no se vuelve a ofrecer automáticamente. Si cambió el formato de la partida y hubo que volver atrás, la versión anterior carga la copia "antes de actualizar".

### Publicar una actualización por internet

```bash
# 1. Subí la versión en package.json (por ejemplo 1.2.1) y agregá sus novedades en src/content/changelog.json
# 2. Generá el paquete:
npm run ota          # compila dist-single/index.html → ota/web-<build>.html + ota/manifest.json
# 3. Commit y push a main.
```

La prueba `tests/v12.test.ts` verifica que el manifiesto coincida con el archivo publicado (tamaño y SHA-256) y con `package.json`.

**Cuándo NO alcanza con una actualización por internet:** si cambia algo nativo (un plugin de Capacitor nuevo, permisos, ícono, nombre de la app). En ese caso subí `versionCode`/`versionName` en `android/app/build.gradle` y `otaMinNativeCode` en `package.json` al nuevo `versionCode`: la app mostrará "necesita instalar la APK nueva" con el enlace a Releases. Esa APK se instala encima (misma firma) y conserva la partida.

## 4. Paquete para Play Store (AAB firmado)

Play Store pide un **Android App Bundle (AAB)** firmado con tu **llave de subida**. Esa llave es privada: **nunca va al repositorio**.

1. Creá la llave (o usá la que te entregamos aparte):
   ```bash
   keytool -genkeypair -keystore urt-upload-key.jks -storetype PKCS12 -alias urt-upload -keyalg RSA -keysize 4096 -validity 10000
   base64 -w0 urt-upload-key.jks > URT_KEYSTORE_BASE64.txt
   ```
2. En GitHub: **Settings → Secrets and variables → Actions → New repository secret**, creá:
   - `URT_KEYSTORE_BASE64`: el contenido de `URT_KEYSTORE_BASE64.txt`.
   - `URT_KEYSTORE_PASSWORD`: la contraseña del almacén.
   - `URT_KEY_ALIAS`: `urt-upload` (o el alias que hayas usado).
   - `URT_KEY_PASSWORD` (opcional): si la clave tiene otra contraseña.
3. En el próximo push, el flujo genera `app-release.aab` firmado (artefacto `play-store-aab-<versión>`). Sin los secretos, avisa y no lo genera.
4. En Play Console activá **Play App Signing** y subí ese AAB. Guardá la llave `.jks` y su contraseña en un lugar seguro: la necesitás para cada actualización en Play Store (si la perdés, Google permite reemplazar la llave de subida).

> Las APK instaladas a mano (firma fija de depuración) y la versión de Play Store tienen firmas distintas: no se instalan una encima de la otra. Para pasar de una a otra, exportá la partida e importala.
