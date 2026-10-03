# Publicar y actualizar Ultimate Realistic Tycoon

Esta guía explica cómo llega una versión nueva al teléfono **sin perder la partida**, qué hace el CI y qué secretos necesita.

## 1. Resumen

| Qué | Dónde | Quién lo publica | Firma |
|---|---|---|---|
| APK de actualización (`ultimate-realistic-tycoon.apk`) | Releases de GitHub `v<versión>` | CI, solo desde `main` | Llave fija `android/app/urt-debug.keystore` (la de las instalaciones existentes) |
| AAB para Play Store y APK de publicación | Releases (y artefacto del CI) | CI, solo desde `main` | Llave de publicación (secretos `URT_KEYSTORE_*`) |
| Actualización por internet (OTA) | Rama `ota-channel` | CI, solo desde `main` | ECDSA P-256 (secreto `URT_OTA_SIGNING_KEY`) |
| Puente para APK 1.2 | Carpeta `ota/` de `main` | A mano (`npm run ota:legacy`) | Sin firma (la 1.2 no verifica) |

**Única fuente de la versión:** `package.json` → `version` (versionName, número de la OTA y de la Release), `nativeCode` (versionCode de Android) y `otaMinNativeCode` (APK mínima que puede recibir la OTA). `android/app/build.gradle` los lee de ahí.

## 2. Qué hace el CI (`.github/workflows/android.yml`)

En **cualquier rama y en pull requests** (permisos de solo lectura):

1. Valida el *Gradle wrapper* y que la versión tenga su entrada en `src/content/changelog.json`.
2. `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, prueba e2e (`npm run e2e`, Playwright) y `npx cap sync android`.
3. `./gradlew assembleDebug` → APK de actualización (llave fija).
4. Si están los secretos de publicación: `bundleRelease` y `assembleRelease` firmados; la llave se escribe en un archivo temporal que se borra al terminar.
5. Huellas `SHA256SUMS` y artefacto `android-<versión>`.

Ningún paso crítico usa `continue-on-error`: si algo falla, el CI falla.

Solo en **push a `main`** (job `publicar`, único con permiso de escritura):

1. Crea la Release `v<versión>` con la APK, el AAB (si hay llave), y `SHA256SUMS`. **Si la Release ya existe no se reemplaza**: el CI avisa y hay que subir la versión en `package.json`.
2. Si existe `URT_OTA_SIGNING_KEY`: compila la página única, firma el manifiesto, lo verifica con la clave pública embebida en la app y lo publica en la rama `ota-channel`. Si el canal ya tiene esa versión (o una mayor), no la reemplaza. **Sin la clave, no se publica nada por internet.**

Compilaciones reproducibles: `npm ci` con `package-lock.json`, Node y Java fijos, `SOURCE_DATE_EPOCH` y APK sin el bloque cifrado de dependencias.

## 3. Secretos de GitHub

**Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Contenido |
|---|---|
| `URT_KEYSTORE_BASE64` | El `.jks` de la llave de subida/publicación en base64 (`base64 -w0 urt-upload-key.jks`). |
| `URT_KEYSTORE_PASSWORD` | Contraseña del almacén. |
| `URT_KEY_ALIAS` | Alias de la clave (por ejemplo `urt-upload`). |
| `URT_KEY_PASSWORD` | Opcional: contraseña de la clave si es distinta. |
| `URT_OTA_SIGNING_KEY` | La clave privada ECDSA P-256 de las actualizaciones, en PEM (`-----BEGIN PRIVATE KEY-----…`). |

Las claves privadas **nunca** van al repositorio (`.gitignore` excluye `*.jks`, `*.pem`, `URT_KEYSTORE_BASE64.txt`, `LEEME_*`, `release-key/`, `ota-key/`). Guardalas también fuera de GitHub (gestor de contraseñas): si perdés la de OTA, hay que publicar una APK con una clave pública nueva.

### Crear o rotar la clave de las actualizaciones por internet

```bash
openssl ecparam -name prime256v1 -genkey -noout | openssl pkcs8 -topk8 -nocrypt -out urt-ota-signing-key.pem
openssl pkey -in urt-ota-signing-key.pem -pubout -outform DER | base64 -w0   # clave pública (SPKI)
```

1. Agregá la clave pública en `src/persistence/ota-keys.json` con un id nuevo (sin borrar la anterior).
2. Publicá esa versión (llega firmada con la clave vieja, que la app actual conoce).
3. Recién entonces cambiá el secreto `URT_OTA_SIGNING_KEY` por la clave nueva. Más adelante podés quitar la pública vieja.

## 4. Actualizaciones por internet (sin reinstalar)

La app lee `https://raw.githubusercontent.com/pbarahona1/gametc/ota-channel/manifest.json`. Es un **sobre firmado** (`format: urt-ota-signed`): el manifiesto va en base64 y la firma ECDSA P-256 (SHA-256) cubre ese texto exacto. El manifiesto incluye tamaño y huella SHA-256 del archivo, así que la firma protege también la página. La app verifica la firma con WebCrypto y la clave pública embebida; si no es válida, no ofrece nada.

Si hay una versión mayor y compatible con la APK (`minNativeCode`), al aceptar:

1. descarga la página (con tiempo máximo, detección de descargas detenidas y reintentos) y comprueba tamaño y huella;
2. la guarda en los archivos privados de la app;
3. guarda la partida y una copia "antes de actualizar";
4. abre la versión nueva **sin hacerla permanente**;
5. cuando la versión nueva carga la partida, lo anota de inmediato y, tras unos segundos sin errores, se confirma.

Si la versión nueva falla antes de confirmarse, vuelve sola a la anterior y no se ofrece de nuevo automáticamente. Si la app se cierra justo durante la confirmación (la versión ya había funcionado), al reabrirla **se retoma** la versión nueva en lugar de marcarla como fallida; tras 3 arranques sin confirmarse, se revierte.

Para publicar una actualización por internet: subí `version` en `package.json`, agregá sus novedades en `src/content/changelog.json` y hacé push a `main`. Si cambió algo nativo (Capacitor, plugins, permisos, ícono, nombre), subí también `nativeCode` y `otaMinNativeCode`: la app mostrará "necesita instalar la APK nueva" con el enlace a Releases.

### Puente para la 1.2

La 1.2 lee `ota/manifest.json` de `main` y no verifica firmas. La 1.3 usa Capacitor 8, que necesita la APK nueva, así que el puente (`npm run ota:legacy`) solo le avisa a la 1.2 que instale la APK de la Release; nunca le instala una página por internet. Se regenera una sola vez, al publicar la 1.3.

## 5. Firma de las APK y partidas existentes

Android solo instala una APK encima de otra si ambas tienen **la misma firma**; desinstalar borra la partida guardada en el teléfono.

- Las instalaciones actuales (1.2) tienen la firma de la llave fija del repositorio. La APK `ultimate-realistic-tycoon.apk` de cada Release se firma con esa llave para que **se instale encima y conserve la partida**.
- Esa llave es pública (está en el repositorio): sirve para actualizar instalaciones existentes, **no** para distribuir públicamente. Para Play Store se usa el AAB con la llave de publicación.
- Pasar las instalaciones manuales a la llave de publicación exige, una sola vez: **Ajustes → Exportar partida**, desinstalar, instalar la APK de publicación e importar la partida. Esa decisión (y cuándo hacerla) está pendiente del dueño del proyecto.

## 6. Play Store

1. Configurá los secretos `URT_KEYSTORE_*` (sección 3).
2. En el próximo push a `main`, la Release incluye `ultimate-realistic-tycoon-play.aab` firmado.
3. En Play Console activá **Play App Signing** y subí ese AAB. Requisitos actuales que cumple el proyecto: `targetSdkVersion 36`, `minSdkVersion 24`, AGP 8.13.0, Gradle 8.14.3, Java 21, solo el permiso `INTERNET`.

> La versión de Play Store (firmada por Google) y las APK instaladas a mano tienen firmas distintas: no se instalan una encima de la otra. Para pasar de una a otra, exportá la partida e importala.
