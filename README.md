# Ultimate Realistic Tycoon

Simulador móvil de finanzas personales, carrera, empresas, inversiones, bienes raíces, impuestos internacionales, grupos empresariales y un sistema legal ficticio. Cada movimiento de dinero pasa por un **libro mayor de partida doble**: nada aparece ni desaparece sin un asiento contable que lo explique.

**Estado:** versión 1.0 — Fases 1 a 5 implementadas: finanzas personales y carrera; empresas; bolsa (Lite y Pro), bonos, fondos, Mogul Exchange y bienes raíces con hipotecas; economía dinámica, 4 jurisdicciones fiscales, profesionales, holdings y consolidación, sistema legal ficticio y asesor IA avanzado; optimización, personalización y guardado robusto. Ver [`docs/ESTADO.md`](docs/ESTADO.md) para lo implementado, los resultados reales de las pruebas y las limitaciones.

## Requisitos

- Node.js 20 o superior (probado con 22) y npm.
- Para Android: JDK 17 y Android SDK (Android Studio o las herramientas de línea de comandos), **o** GitHub Actions (ver abajo).

## Ejecutar en el navegador

```bash
npm install
npm run dev          # servidor de desarrollo en http://localhost:5173
```

Abrilo con las herramientas de desarrollo en modo móvil (≈ 390 × 844) para la experiencia prevista.

## Pruebas

```bash
npm test             # 130 pruebas en 17 archivos: contabilidad, impuestos, crédito, simulación, empresas,
                     # inversiones, inmuebles, economía, grupos, legal, auditorías con bots aleatorios,
                     # compactación, guardado seguro, insolvencia y rendimiento
npm run typecheck    # TypeScript estricto
```

## Compilar

```bash
npm run build          # versión web en dist/ (la que usa Android)
npm run build:single   # un único index.html autocontenido en dist-single/ (vista previa portable)
```

## Generar la APK de Android

> **Importante:** la APK de esta versión **no fue compilada ni probada** en el entorno donde se desarrolló (no tenía SDK de Android ni acceso para descargarlo). Se verificó la configuración de Capacitor (`capacitor.config.ts`, `webDir: dist`), el proyecto `android/` sincronizado con `npx cap sync android` (4 plugins: app, filesystem, preferences, share; `versionCode 3`, `versionName 1.0.0`, minSdk 22, target/compile 34) y el flujo `.github/workflows/android.yml`. Seguí cualquiera de estas opciones para generarla.

### Opción A — en tu computadora

1. Instalá Android Studio (incluye el SDK) y JDK 17.
2. En la carpeta del proyecto:
   ```bash
   npm install
   npm run build
   npx cap sync android
   ```
3. APK de depuración (instalable directamente en el teléfono):
   ```bash
   cd android
   ./gradlew assembleDebug        # en Windows: gradlew.bat assembleDebug
   ```
   Resultado: `android/app/build/outputs/apk/debug/app-debug.apk`.
4. O abrí el proyecto con `npx cap open android` y usá *Build → Build APK(s)*.
5. Instalación en el teléfono: copiá la APK y abrila (habilitá "instalar apps desconocidas"), o con el teléfono conectado por USB: `adb install -r app-debug.apk`.

### Opción B — sin instalar nada (GitHub Actions)

1. Subí el proyecto a un repositorio de GitHub.
2. Pestaña **Actions → APK Android → Run workflow**.
3. El flujo instala Node 20, JDK 17 y el SDK de Android, ejecuta `npm ci`, **las 130 pruebas**, `npm run build`, `npx cap sync android` y `./gradlew assembleDebug`.
4. Al terminar (≈ 6–10 min), descargá `ultimate-realistic-tycoon-debug-apk` desde los artefactos de la ejecución, descomprimí el ZIP e instalá `app-debug.apk`.

### Problemas frecuentes

- `SDK location not found`: creá `android/local.properties` con `sdk.dir=/ruta/a/Android/Sdk` (Windows: `sdk.dir=C\:\Users\VOS\AppData\Local\Android\Sdk`).
- `Unsupported class file major version`: usá JDK 17 (`java -version`).
- Cambios en el código que no aparecen en la APK: repetí `npm run build && npx cap sync android` antes de compilar.

### APK de publicación (Play Store)

```bash
keytool -genkey -v -keystore urt-release.keystore -alias urt -keyalg RSA -keysize 2048 -validity 10000
cd android && ./gradlew bundleRelease    # AAB para Play Store
```
Configurá la firma en `android/app/build.gradle` (`signingConfigs`). Nunca subas el keystore al repositorio.

## Estructura

```
src/
  engine/            Motor económico puro (sin React, determinista, 100 % testeable)
    ledger/          Plan de cuentas, libro mayor de partida doble y compactación mensual
    time/            Calendario del juego
    finance/         Banca, tarjeta, préstamos, presupuesto, pagos, puntaje crediticio
    career/          Empleo, postulaciones, nómina, desempeño, evaluaciones
    tax/             Impuesto progresivo, retenciones, declaración anual
    skills/          Habilidades (XP) y formación
    reports/         Estados financieros e indicadores
    economy/         Ciclo económico, inflación, tasas, eventos y dificultad
    invest/          Bolsa, órdenes, indicadores, bonos, fondos, Mogul Exchange y cartera común
    realestate/      Zonas, inmuebles, alquileres, hipotecas, obras e informes
    pros/            Profesionales contratables, auditorías y proyecciones
    legal/           Sistema legal y actividades ilegales ficticias
    snapshot.ts      Deshacer liviano de acciones
    business/        Empresas: libro propio, mercado, inventario, personal, marketing,
                     operaciones, finanzas, propiedad, gerente, informes y asesor empresarial
    advisor/         Asesor IA basado en reglas y escenarios hipotéticos
    progression/     Etapas, logros, guía de inicio
    simulation.ts    Orquestador diario
    invariants.ts    Auditoría contable
  content/           Datos del juego: empleos, cursos, sectores, glosario, estilos de vida, bancos
  persistence/       Guardado con checksum, copias, migraciones, progreso offline,
                     almacenamiento nativo espejado y exportación a archivo
  ui/                Interfaz React (pantallas, hojas, componentes, tema)
tests/               Pruebas unitarias e integradas (Vitest)
docs/                Documentación técnica y económica
android/             Proyecto nativo generado por Capacitor
```

## Dónde se guarda la partida

- **Android (APK):** en dos almacenes nativos a la vez: preferencias de la app (SharedPreferences) y un archivo JSON en el directorio privado de la app. Si uno falla o se borra, se lee del otro. No depende del navegador.
- **Navegador:** `localStorage`.
- **En ambos:** guardado comprimido con checksum, 3 copias rotativas (una copia dañada nunca borra a las otras; se carga la más reciente válida; con el almacenamiento lleno se liberan primero las copias más viejas), y *Ajustes → Exportar a archivo* (en Android abre el menú Compartir: Archivos, Drive, correo…) e *Importar desde archivo*.

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — decisiones técnicas, capas y flujo de datos.
- [`docs/REGLAS_ECONOMICAS.md`](docs/REGLAS_ECONOMICAS.md) — todas las fórmulas y reglas de negocio.
- [`docs/ESTADO.md`](docs/ESTADO.md) — funcionalidades implementadas, resultados de pruebas, limitaciones y guía para continuar.
- [`docs/DISENO_FASES_3_5.md`](docs/DISENO_FASES_3_5.md) — decisiones de diseño de las Fases 3 a 5.

## Modelo de negocio

Juego completo sin pagos, sin anuncios y sin cuenta externa. Funciona sin conexión.
