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
| Permisos | Solo internet (búsqueda de actualizaciones) |

## Seguridad de los datos (Data safety)

Con la versión actual (sin anuncios, sin compras, sin analíticas):

- ¿La app recopila o comparte datos de los usuarios? **No.** Las partidas quedan en el dispositivo; la consulta de actualizaciones a GitHub no envía datos del usuario.
- ¿Los datos se cifran en tránsito? Sí (HTTPS).
- ¿Se pueden borrar los datos? No hay datos en servidores; el usuario borra partidas en Ajustes o desinstalando.
- Cuenta de usuario: la app no tiene cuentas (no aplica el requisito de borrado de cuenta).

**Si se agregan anuncios (AdMob):** hay que declarar que se recopilan y comparten el ID de publicidad, datos de uso de la app e información del dispositivo con fines de publicidad y análisis, agregar el permiso `AD_ID`, mostrar el formulario de consentimiento (UMP) a usuarios del EEE, Reino Unido y Suiza, y actualizar la política de privacidad **antes** de publicar.

## Clasificación de contenido (IARC)

Responder con la verdad (una respuesta falsa puede hacer que retiren la app):

- Violencia, sexo, lenguaje vulgar, drogas: no.
- Referencias a actividades delictivas: **sí, ficticias y opcionales** (sobornos, evasión, lavado, contrabando, una casa de apuestas clandestina como negocio). Están desactivadas al empezar y tienen castigos.
- Apuestas simuladas (que el jugador apueste): **no**. Hay una bolsa de valores ficticia sin dinero real.
- Compras dentro de la app / anuncios: no (cambia si se agregan).
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
4. URL para Play Console: `https://pbarahona1.github.io/gametc/legal/privacidad.html`.

## Fuentes

- [Ubicaciones admitidas para cuentas de comerciante](https://support.google.com/googleplay/android-developer/answer/9306917)
- [Requisitos de prueba para cuentas personales nuevas](https://support.google.com/googleplay/android-developer/answer/14151465)
- [Requisitos de nivel de API objetivo](https://support.google.com/googleplay/android-developer/answer/11926878)
- [Política de datos del usuario (política de privacidad obligatoria)](https://support.google.com/googleplay/android-developer/answer/10144311)
- [Política de pagos (Google Play Billing)](https://support.google.com/googleplay/android-developer/answer/9858738)
- [Política de actividades ilegales](https://support.google.com/googleplay/android-developer/answer/9878877)
- [Clasificaciones de contenido](https://support.google.com/googleplay/android-developer/answer/9898843)
- [Ley para la Protección de Datos Personales de El Salvador (Decreto 144, 2024)](https://www.asamblea.gob.sv/node/13376)
