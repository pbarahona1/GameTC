# Ultimate Realistic Tycoon

Simulador móvil de finanzas personales, carrera, empresas, inversiones, bienes raíces, impuestos internacionales, grupos empresariales y un sistema legal ficticio. Cada movimiento de dinero pasa por un **libro mayor de partida doble**: nada aparece ni desaparece sin un asiento contable que lo explique.

**Estado:** versión 1.2 — sobre todo lo anterior suma **tiendas** (ropa, vehículos, tecnología, hogar y lujo) con efectos reales, un **personaje** dibujado que se viste con lo que comprás e **imagen personal** (entrevistas, negociaciones, trato en tiendas), **tarjetas Clásica/Oro/Platino/Black** con reintegros y cuotas, **noticias y rumores calibrados** que se pueden analizar, **grupos rivales** que compiten por empresas, inmuebles, empleados y proveedores, **misiones por capítulos**, secciones recomendadas por etapa (sin bloquear), cocheras y estudios baratos, holding sin subsidiarias más barata, **zoom táctil** en Trading Pro, íconos nuevos, **actualizaciones dentro de la app** y firma fija para instalar encima sin perder la partida. Ver [`docs/ESTADO.md`](docs/ESTADO.md) para lo implementado, los resultados reales de las pruebas y las limitaciones.

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
npm test             # 180 pruebas en 21 archivos: contabilidad, impuestos, crédito, simulación, empresas,
                     # inversiones, inmuebles, economía, grupos, legal, auditorías con bots aleatorios,
                     # compactación, guardado seguro, insolvencia, rendimiento, tiendas, tarjetas,
                     # noticias calibradas, rivales, misiones, actualizaciones y balance por estilo
npm run typecheck    # TypeScript estricto
URT_BOTS=1 npx vitest run tests/balance.test.ts   # bots de balance completos → docs/BALANCE.md
```

## Compilar

```bash
npm run build          # versión web en dist/ (la que usa Android)
npm run build:single   # un único index.html autocontenido en dist-single/ (vista previa portable)
```

## Generar la APK de Android

> La APK se compila en GitHub Actions. No se probó en un teléfono físico desde el entorno de desarrollo. Proyecto Capacitor 6 (`webDir: dist`, plugins app, filesystem, preferences, share; `versionCode 5`, `versionName 1.2.0`, minSdk 22, target/compile 34), ícono y pantalla de inicio propios (`npm run icons` los regenera) y **firma fija** para instalar encima sin perder la partida. Guía completa: [`docs/PUBLICAR.md`](docs/PUBLICAR.md).

### Opción A — sin instalar nada (GitHub Actions, recomendada)

1. Cada push a `main` (o **Actions → APK Android → Run workflow**) corre las pruebas, compila y firma la APK.
2. Descargala desde **Releases** (`https://github.com/pbarahona1/gametc/releases/latest`, directo desde el teléfono) o desde los artefactos de la ejecución.
3. Se instala **encima** de la versión anterior (misma firma): la partida se conserva. Solo al pasar de la 1.1 a la 1.2 hay que exportar la partida, reinstalar e importarla (la 1.1 tenía una firma al azar).
4. Si configurás los secretos de firma de publicación, el mismo flujo genera el **AAB firmado para Play Store** (ver `docs/PUBLICAR.md`).

### Opción B — en tu computadora

1. Instalá Android Studio (incluye el SDK) y JDK 17.
2. En la carpeta del proyecto:
   ```bash
   npm install
   npm run build
   npx cap sync android
   cd android && ./gradlew assembleDebug        # en Windows: gradlew.bat assembleDebug
   ```
   Resultado: `android/app/build/outputs/apk/debug/app-debug.apk` (firmada con la llave fija del repositorio).
3. Instalación: abrí la APK en el teléfono (habilitá "instalar apps desconocidas") o `adb install -r app-debug.apk`.

### Actualizaciones sin reinstalar

La app busca versiones nuevas del juego en `ota/manifest.json` y las instala en segundos, verificadas con SHA-256 y con vuelta atrás automática si algo falla. Para publicar una: subí la versión en `package.json`, anotá las novedades en `src/content/changelog.json`, ejecutá `npm run ota` y hacé push.

### Problemas frecuentes

- `SDK location not found`: creá `android/local.properties` con `sdk.dir=/ruta/a/Android/Sdk` (Windows: `sdk.dir=C\:\Users\VOS\AppData\Local\Android\Sdk`).
- `Unsupported class file major version`: usá JDK 17 (`java -version`).
- Cambios en el código que no aparecen en la APK: repetí `npm run build && npx cap sync android` antes de compilar.
- "La app no está instalada" al actualizar: la APK anterior tenía otra firma (1.1 o anterior). Exportá la partida, desinstalá, instalá la nueva e importala.

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
    advisor/         Asesor IA basado en reglas, escenarios y proyección de negocios
    lifestyle/       Tiendas, posesiones, imagen personal y sus efectos (1.2)
    world/           Noticias calibradas, rivales, exclusividades y ofertas por empleados (1.2)
    progression/     Etapas, logros, misiones por capítulos y secciones recomendadas
    simulation.ts    Orquestador diario
    invariants.ts    Auditoría contable
  content/           Datos del juego: empleos, cursos, sectores, glosario, estilos de vida, bancos
  persistence/       Guardado con checksum, copias, migraciones, progreso offline,
                     almacenamiento nativo espejado, exportación a archivo y actualizaciones (ota.ts)
  ui/                Interfaz React (pantallas, hojas, componentes, tema)
tests/               Pruebas unitarias e integradas (Vitest) y bots de balance (tests/bots)
docs/                Documentación técnica, económica, balance y publicación
ota/                 Actualización por internet publicada (manifiesto + página)
scripts/             Generación de íconos y del paquete de actualización
android/             Proyecto nativo generado por Capacitor
```

## Dónde se guarda la partida

- **Android (APK):** en archivos privados de la app (principal, temporal y copias) y una segunda copia de la partida principal en las preferencias del sistema. Si uno falla o se borra, se lee del otro. No depende del navegador.
- **Navegador:** `localStorage`.
- **Actualizaciones:** la partida vive fuera de la página del juego, así que actualizar no la toca; antes de cambiar de versión se guarda una copia extra "antes de actualizar".
- **En ambos:** guardado comprimido con checksum, 3 copias rotativas (una copia dañada nunca borra a las otras; se carga la más reciente válida; con el almacenamiento lleno se liberan primero las copias más viejas), y *Ajustes → Exportar a archivo* (en Android abre el menú Compartir: Archivos, Drive, correo…) e *Importar desde archivo*.

## Documentación

- [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) — decisiones técnicas, capas y flujo de datos.
- [`docs/REGLAS_ECONOMICAS.md`](docs/REGLAS_ECONOMICAS.md) — todas las fórmulas y reglas de negocio.
- [`docs/ESTADO.md`](docs/ESTADO.md) — funcionalidades implementadas, resultados de pruebas, limitaciones y guía para continuar.
- [`docs/DISENO_FASES_3_5.md`](docs/DISENO_FASES_3_5.md) — decisiones de diseño de las Fases 3 a 5.
- [`docs/BALANCE.md`](docs/BALANCE.md) — cuánto tarda cada estilo de juego en llegar a cada etapa (bots) y los ajustes hechos.
- [`docs/PUBLICAR.md`](docs/PUBLICAR.md) — firma, APK, AAB para Play Store y actualizaciones por internet.

## Modelo de negocio

Juego completo sin pagos, sin anuncios y sin cuenta externa. Funciona sin conexión.
