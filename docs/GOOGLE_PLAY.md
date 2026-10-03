# Publicar en Google Play: requisitos y respuestas

Revisado el 2026-10-02 contra la documentación de Google Play. Esto **no es asesoramiento legal**: las políticas cambian y conviene confirmarlas en Play Console al publicar.

## Estado del juego frente a los requisitos

| Requisito | Estado |
|---|---|
| Nivel de API objetivo (apps nuevas: API 36 desde el 31-08-2026) | Cumple: target/compile 36 |
| Formato AAB firmado | Cumple: el CI genera `ultimate-realistic-tycoon-play.aab` |
| Política de privacidad pública (URL) y dentro de la app | Texto listo (`src/content/legal.ts`), visible en la app (Más → Privacidad y términos). La página pública se genera con `npm run legal` cuando estén el nombre y el correo de contacto, y se publica con GitHub Pages |
| Formulario de Seguridad de los datos | Respuestas abajo |
| Cuestionario de clasificación (IARC) | Guía abajo |
| Cuentas personales nuevas: prueba cerrada con **12 testers durante 14 días seguidos** antes de producción | Pendiente (se hace en Play Console) |
| Público objetivo | 13+ (no apto para el programa de Familias) |
| Permisos | Internet; el SDK de AdMob agrega el del ID de publicidad (`AD_ID`) |
| Anuncios | Solo recompensados, opcionales, con consentimiento UMP en EEE/Reino Unido/Suiza; anuncios de prueba fuera de `main` |

## Seguridad de los datos (Data safety)

La app tiene **anuncios recompensados opcionales de Google AdMob** (solo si el jugador toca «Ver anuncio»). Respuestas, según la guía de AdMob para el formulario:

- En «Configuración de la app → Anuncios»: **Sí, contiene anuncios.**
- ¿Recopila o comparte datos? **Sí** (lo hace el SDK de Google Mobile Ads).
- Datos y fines (recopilados **y** compartidos con Google; no se venden):
  - **ID del dispositivo u otros IDs** (ID de publicidad): publicidad o marketing, análisis, prevención de fraude.
  - **Ubicación aproximada** (derivada de la IP): publicidad o marketing, análisis, prevención de fraude.
  - **Actividad en la app → interacciones con la app**: publicidad o marketing, análisis.
  - **Información y rendimiento de la app → registros de fallos y diagnósticos**: análisis, prevención de fraude.
- Datos cifrados en tránsito: **sí**. Se pueden solicitar borrados: el desarrollador no guarda datos; los del SDK los gestiona Google (enlazar su política).
- Partidas: quedan en el dispositivo, no se recopilan.
- La app no tiene cuentas (no aplica el borrado de cuenta).

Revisar la guía vigente de Google antes de enviar: <https://support.google.com/admob/answer/11994880>.

## Clasificación de contenido (IARC)

Responder con la verdad (una respuesta falsa puede hacer que retiren la app):

- Violencia, sexo, lenguaje vulgar, drogas: no.
- Referencias a actividades delictivas: **sí, ficticias y opcionales** (sobornos, evasión, lavado, contrabando, una casa de apuestas clandestina como negocio). Están desactivadas al empezar y tienen castigos.
- Apuestas simuladas (que el jugador apueste): **no**. Hay una bolsa de valores ficticia sin dinero real.
- Anuncios: **sí** (recompensados y opcionales). Compras dentro de la app: no.
- Se espera una clasificación para adolescentes (p. ej. PEGI 12–16 / ESRB Teen); la decide el cuestionario.

## Monetización: lo que hay que saber

1. **El Salvador no admite cuentas de comerciante en Google Play.** Un desarrollador con dirección en El Salvador puede publicar apps **gratuitas**, pero **no puede vender la app ni compras dentro de la app**. Para cobrar haría falta una cuenta de desarrollador a nombre de una persona o empresa con dirección, banco y datos fiscales en un país admitido (Guatemala, Honduras, Costa Rica, Panamá, México, Estados Unidos, entre otros). Unos términos y condiciones no resuelven esto.
2. **Compras dentro de la app:** para bienes digitales (quitar anuncios, desbloqueos, moneda del juego) es obligatorio Google Play Billing; no se puede cobrar por fuera.
3. **Anuncios (AdMob):** es un servicio aparte de la cuenta de comerciante; confirmar en AdMob que acepta pagos a El Salvador (transferencia). Requiere política de privacidad actualizada, consentimiento UMP, Data safety actualizado, permiso `AD_ID`, y respetar la política de anuncios de Play (nada de anuncios a pantalla completa inesperados ni que tapen controles; los recompensados, siempre opcionales).
4. **Impuestos:** los ingresos por ventas o anuncios pueden tributar en El Salvador; consultarlo con un contador.

## Ficha de la tienda (borrador)

- Nombre: Ultimate Realistic Tycoon
- Descripción corta: Simulador de finanzas, empresas e inversiones con contabilidad real. Sin conexión.
- Aclarar en la descripción que todo es ficticio, sin dinero real, y que no es asesoramiento financiero.
- Categoría: Juegos → Simulación.

## Páginas públicas (GitHub Pages)

1. Completar `developer` y `contact` en `src/content/legal.ts`.
2. `npm run legal` → genera `docs/legal/privacidad.html` y `docs/legal/terminos.html`; commit y push a `main`.
3. En GitHub: Settings → Pages → Deploy from a branch → `main` / `/docs`.
4. URL para Play Console: `https://pbarahona12.github.io/gametc/legal/privacidad.html`.

## Fuentes

- [Ubicaciones admitidas para cuentas de comerciante](https://support.google.com/googleplay/android-developer/answer/9306917)
- [Requisitos de prueba para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Requisitos de nivel de API objetivo](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Política de datos del usuario (política de privacidad obligatoria)](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Política de pagos (Google Play Billing)](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Política de actividades ilegales](https://support.google.com/googleplay/android-developer/answer/9878877)
- [Clasificaciones de contenido](https://support.google.com/googleplay/android-developer/answer/9898843)
- [Ley para la Protección de Datos Personales de El Salvador (Decreto 144, 2024)](https://www.asamblea.gob.sv/node/13376)
