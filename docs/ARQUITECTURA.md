# Arquitectura técnica

## Tecnología elegida y por qué

| Pieza | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto | Tipos para un dominio con muchas entidades financieras; errores detectados al compilar. |
| Interfaz | React 18 + CSS propio | UI tipo aplicación bancaria: tarjetas, listas, formularios, gráficos. Sin frameworks de estilos pesados. |
| Empaquetado | Vite | Compilación rápida; modo `single` genera un HTML autocontenido. |
| Móvil | Capacitor 6 | Proyecto Android nativo real (APK/AAB), almacenamiento nativo, botón atrás, sin depender de internet. |
| Pruebas | Vitest | Ejecuta el motor económico en Node en milisegundos. |
| Gráficos | SVG propio (`LineChart`) | Liviano, accesible y coherente con el tema. |

Se descartaron Unity y Godot porque el núcleo del juego es contable y de interfaz de datos, no gráfico 3D/2D; su UI de formularios y listas es más costosa de hacer bien y de probar.

## Capas

```
┌────────────── UI (src/ui) ──────────────┐
│ Pantallas · hojas · componentes · tema   │
│ store.ts: reloj, acciones atómicas,      │
│ guardado, ajustes                         │
└───────────────▲──────────────────────────┘
                │ llama funciones puras
┌───────────────┴── Motor (src/engine) ────┐
│ actions (funciones que devuelven         │
│ ActionResult) · simulation · reports ·   │
│ advisor · progression                     │
│            ▼ todo movimiento de dinero    │
│ ledger.post()  ← único punto de cambio   │
└───────────────▲──────────────────────────┘
                │ serializa / valida
┌───────────────┴── Persistencia ──────────┐
│ save.ts (checksum, rotación, invariantes)│
│ migrations.ts · offline.ts · plataforma  │
└──────────────────────────────────────────┘
```

### Reglas de diseño del motor

1. **Pureza y determinismo.** El motor no usa `Date.now()` ni `Math.random()`. El RNG (`mulberry32`) guarda su estado dentro de la partida, por lo que la misma partida con las mismas acciones produce exactamente el mismo resultado (hay una prueba que lo verifica).
2. **Un único punto de cambio de saldos.** `ledger.post()` valida cada asiento (cuadre Debe = Haber, centavos enteros, cuentas existentes, cuentas sin saldo negativo) antes de aplicarlo. Si algo falla, no se modifica nada.
3. **Patrón Command.** Cada acción del jugador (`transfer`, `takeLoan`, `apply`, `enroll`…) es una función `(state, …args) => ActionResult` que valida primero y explica el motivo del rechazo en lenguaje del jugador.
4. **Atomicidad en la UI.** `store.run()` toma una instantánea (`engine/snapshot.ts`) antes de ejecutar una acción y la restaura si ocurre una excepción. Nunca queda una partida a medio modificar. La instantánea separa las listas que solo crecen (asientos, historiales) y las guarda por referencia con su largo: es ~8 veces más rápida que copiar todo el estado.
5. **Subregistros conciliados.** Préstamos, depósitos, impuestos por pagar y devoluciones tienen detalle propio que debe coincidir con su cuenta del mayor (`invariants.ts`).
6. **Simulación por calendario, no por fotograma.** El reloj de la UI avanza días enteros por intervalos (100 ms); cada día ejecuta solo los procesos cuyo calendario corresponde. El costo no depende de los FPS.

### Libro mayor genérico (`ledger/core.ts`)

El motor de partida doble es genérico sobre un plan de cuentas (`Chart<A>`): `gPost` valida y aplica, `gAudit` recalcula desde los asientos y comprueba cuadre, saldos no negativos y ecuación contable. Lo usan:

- `ledger/ledger.ts`: el libro **personal** (misma API que en la Fase 1).
- `business/companyLedger.ts`: un libro **por empresa** (`CO_ACCOUNTS`, 34 cuentas: caja, cuentas por cobrar, inventario, mercadería en tránsito, depósitos, activo fijo, proveedores, atrasos, impuestos, préstamos, capital, retiros, ventas, costos, gastos operativos, depreciación, financieros, impuesto de sociedades).

### Empresas (`engine/business/`)

| Módulo | Responsabilidad |
|---|---|
| `types.ts` | Modelo de datos: lotes FIFO, órdenes, cuentas por pagar/cobrar, atrasos, empleados, activos, campañas, préstamos, delegación, ofertas. |
| `market.ts` | Modelo de elección de demanda, competidores IA, índice sectorial, estacionalidad. |
| `inventory.ts` | Proveedores, órdenes, recepción con demoras, pago a plazo, caducidad FIFO, reorden automático. |
| `staff.ts` | Candidatos, contratación, capacitación, salarios, moral, rotación, indemnización, nómina. |
| `marketing.ts` | 7 canales, 6 públicos, estudio de mercado, conocimiento de marca. |
| `operations.ts` | Operación diaria según modelo de negocio, precios, plan de producción, equipos, reputación. |
| `finance.ts` | Préstamos empresariales, impuesto de sociedades con arrastre de pérdidas, insolvencia. |
| `ownership.ts` | Fundar, comprar, aportar, retirar, dividendos, emitir acciones, vender, liquidar; método de participación. |
| `manager.ts` | Delegación semanal al gerente (reorden, precios, personal) con error según su habilidad. |
| `reports.ts` | Estado de resultados, balance, flujo de caja, métricas, valoración, consolidado. |
| `advisor.ts` | Alertas empresariales basadas en datos + análisis de cartera. |
| `simulate.ts` | Orquestación diaria/mensual/anual y mercado de empresas en venta. |

**Vínculo con las finanzas personales (método de participación).** La inversión del jugador en cada empresa es la cuenta personal `business_equity`. Su valor contable (`co.carrying`) = máx(0, patrimonio de la empresa × % de propiedad) + plusvalía de compra. Se revalúa a fin de mes y tras cada aporte/retiro, contra `business_results`. Así el patrimonio personal refleja las empresas sin duplicar sus cuentas, y un invariante exige `business_equity = Σ co.carrying`.

**Invariantes por empresa** (`invariants.ts → checkCompanies`): auditoría completa del libro de cada empresa + conciliación de lotes de inventario, órdenes prepagadas en tránsito, cuentas por pagar, por cobrar, atrasos, activos fijos (valor en libros), préstamos e impuestos declarados con sus cuentas.

**Empresas en venta.** Se generan simulando empresas NPC con gerente y delegación total durante 6–18 meses (modo proyección, sin registros). Por eso sus números de venta son historia simulada real, no inventada.

### Sistemas de las Fases 3 y 4

| Carpeta / módulo | Responsabilidad |
|---|---|
| `economy/economy.ts` | Macro v2 mensual: ciclo de 5 fases, PIB, desempleo, confianza, inflación, tasa (regla de Taylor), eventos. Expone **lectores únicos** (demanda, costo de insumos, mercado laboral, diferencial de crédito, deriva bursátil e inmobiliaria, vacancia) que usan todos los demás sistemas. |
| `economy/difficulty.ts` | Cuatro dificultades: multiplicadores de incertidumbre y exigencia (no cambian la contabilidad). |
| `invest/portfolio.ts` | Contabilidad común de TODOS los valores: compra/venta con lotes FIFO, revaluación diaria a mercado, ganancias realizadas por plazo, comisiones. Lite, Pro, bonos, fondos y Mogul usan esta misma función: no hay contabilidad duplicada. |
| `invest/stocks.ts` | Bolsa: precios, resultados, dividendos, splits, quiebras, IPO, órdenes (mercado, límite, stop, stop‑límite, take profit, trailing, OCO), estimación del analista. |
| `invest/bonds.ts`, `funds.ts`, `mogul.ts` | Bonos (precio por flujos descontados, duración, impago), fondos (valor liquidativo desde subyacentes reales), Mogul Exchange (participaciones fraccionadas en empresas simuladas, edificios y regalías). |
| `invest/indicators.ts` | SMA, EMA, RSI, MACD, Bollinger, volatilidad, beta, caída máxima, VaR, Herfindahl, correlación. |
| `realestate/` | Zonas, publicaciones, compra personal o empresarial, alquileres, inquilinos, desalojos, mantenimiento, impuestos, obras, hipotecas (fija/variable, ejecución, recurso) e informe por inmueble. |
| `tax/` + `content/jurisdictions.ts` | Motor fiscal guiado por datos: 4 jurisdicciones, residencia, ganancias de capital con arrastre, alquileres, dividendos, deducciones según contador/habilidad. |
| `pros/` | Mercado de profesionales, contrataciones, honorarios, informe contable, proyección Monte Carlo, auditorías reales de libros, desfalcos. |
| `business/groups.ts` | Holdings, subsidiarias en cadena (método de participación), préstamos intragrupo espejados, políticas de grupo, consolidación con eliminaciones y riesgos. |
| `legal/` | Actos ilegales ficticios, sospecha, detección, casos por etapas, probabilidad de condena acotada 5–95 %, multas, embargos, prisión, inspecciones, abogados. |
| `advisor/advisorWorld.ts` | Reglas del asesor para inversiones, inmuebles, legal, impuestos y economía (con datos reales). |
| `ledger/compaction.ts` | Compactación de libros en baldes mensuales (Fase 5). |
| `snapshot.ts`, `clone.ts` | Deshacer liviano y copia profunda compatible con WebView antiguos. |
| `advisor/businessForecast.ts` (1.1) | Proyección de negocios: futuros simulados sobre copias de la partida, resumen por percentiles, sesgo según la habilidad, comparación con la realidad. |
| `invest/managed.ts` (1.1) | Gestor de inversiones: cuentas gestionadas como clase de inversión `managed` (misma contabilidad común), selección de acciones por habilidad, rebalanceo, comisiones y ganchos de dividendos, splits y repartos. |

**Una sola contabilidad.** Todos los movimientos pasan por `post()` (personal) o `coPost()` (empresa). Los subregistros (tenencias y lotes, bonos, fondos, Mogul, inmuebles, hipotecas, multas, subsidiarias, préstamos intragrupo) se concilian con su cuenta en `invariants.ts → checkPhase34`. La auditoría integral con bots aleatorios exige cada mes: invariantes, Δ patrimonio = resultado del mes y conciliación del flujo de caja.

### Orden del día (`simulation.ts`)

1. 1 de enero: cierre fiscal de las empresas, declaración personal (con cambio de residencia pendiente) y actualización macroeconómica anual.
2. Día 1 de cada mes: paso macroeconómico (`monthlyMacro`).
3. Vencimiento de tarjeta, postulaciones, formación, gastos recurrentes, cuotas, depósitos, impuestos, evaluación anual; día 15: imprevistos.
4. Empresas (`companiesDay`), mercado de empresas en venta (cada 60 días), inversiones (`investmentsDay`: bolsa, bonos, fondos, Mogul, revaluación), inmuebles (`realEstateDay`), legal (`legalDay`).
5. Cierre del día: saldos diarios para intereses, corte de tarjeta.
6. Último día del mes: desfalcos, cierre de empresas (por profundidad en el grupo: subsidiarias primero, luego políticas de grupo, préstamos intragrupo y revaluación en cadena), honorarios profesionales, detección legal, nómina, intereses, atributos, puntaje, foto mensual, progreso y **compactación de libros**.

## Guardado

- Sobre JSON `{format, version, savedAt, day, name, checksum, payload, encoding?}` con checksum FNV‑1a del contenido **sin comprimir**. Con `encoding: 'gzip-b64'` el payload va comprimido con gzip nativo (`CompressionStream`) y en base64 (~3–4 veces más chico); si la plataforma no lo soporta se guarda en texto plano. Las exportaciones a archivo son texto plano legible.
- Escritura en dos pasos: ranura temporal → principal.
- Tres copias rotativas separadas por ≥ 30 días de juego (o partida distinta).
- Carga: la copia válida **más reciente** entre principal y temporal (una escritura interrumpida no pierde el último guardado); si ninguna sirve, las copias de la más nueva a la más vieja. Cada una pasa descompresión → checksum → migración → forma → invariantes contables. Una copia dañada nunca borra a las demás.
- Almacenamiento lleno: se liberan primero las copias de seguridad más viejas (nunca la principal) y se reintenta; si aun así no entra, se informa el error y la partida anterior queda intacta.
- Nunca se guarda un estado que viole los invariantes (imposible "duplicar dinero" editando saldos).
- Plataforma (`platformStorage.ts`):
  - Android/iOS (1.1): `NativeKV` escribe todas las claves como archivos `saves/<clave>.json` en `Directory.Data` (`@capacitor/filesystem`) y una segunda copia SOLO de la partida principal en `@capacitor/preferences` (Android carga las preferencias enteras en memoria al abrir la app, así que no conviene llenarlas). Lee de archivos primero y luego de preferencias (compatible con instalaciones 1.0).
  - Navegador: `localStorage`; memoria como último recurso (se avisa).
- Exportar a archivo (`exportToFile`): en Android se escribe en la caché y se abre el menú Compartir; en navegador se descarga. Importar desde archivo o texto pegado, con la misma verificación (checksum, migración, invariantes).
- `SAVE_VERSION = 4` (1.1: habilidad Proyección de negocios, cuentas con gestor, proyecciones guardadas en empresas). Antes, `SAVE_VERSION = 3`. La migración 1→2 agrega las cuentas personales de empresas; la 2→3 crea bolsa, bonos, inmuebles, fondos, Mogul, profesionales, legal, jurisdicciones y macro v2 (`initWorldV3`). El campo `ledger.archive` (Fase 5) es opcional: partidas sin compactar se leen igual.

## Progreso sin conexión

`offline.ts`: 1 día de juego cada 10 minutos reales con la app cerrada, tope configurable (0/7/30/90 días; 30 por defecto). Se simula con el mismo `advanceDay` que el juego en vivo y se muestra un informe de ausencia. Si el reloj del sistema retrocede, no hay progreso.

## Rendimiento (Fase 5)

- Saldos cacheados en `ledger.balances`; la auditoría completa solo se ejecuta al guardar/cargar y en pruebas.
- **Compactación** (`ledger/compaction.ts`): baldes mensuales con totales exactos por cuenta y flujo de caja por clase y concepto. Detalle conservado: personal = año en curso + anterior; empresas del jugador = 13 meses; empresas de terceros simuladas = 2 meses. `gPeriodTotals`, `balanceAt` y los flujos de caja leen baldes + asientos. Probado: informes mensuales idénticos antes y después de compactar.
- Límites de historiales: registro, ventas diarias, historial de precios (260 días + 520 semanas), bonos, fondos, zonas, macro, operaciones.
- Medido en las pruebas (Node, un núcleo): **10 años con empresa, acciones, fondo e inmueble ≈ 3 s** (≈ 1.200 días/s); estado ≈ 2,2 MB, guardado comprimido ≈ 0,7 MB.
- División de código: pantallas cargadas bajo demanda (`React.lazy`) y bloques separados para React y el glosario en la versión Android.

## Interfaz

- Diseño móvil primero: columna de 560 px máximo, navegación inferior de 6 secciones (Inicio, Carrera, Finanzas, Invertir, Negocios, Más), hojas modales inferiores, objetivos táctiles ≥ 44 px, áreas seguras (`env(safe-area-inset-*)`).
- Tema claro/oscuro por tokens CSS (sistema, claro u oscuro), tamaño de texto (4 niveles), alto contraste, paleta para daltonismo, reducción de animaciones y densidad compacta (atributos en `<html>`).
- Ganancias/pérdidas con color **y** símbolo (▲▼) para accesibilidad.
- Ayuda contextual: componente `InfoButton` enlazado al glosario; punto dorado en conceptos no consultados; modo aprendizaje con explicaciones en línea.

## Cómo agregar un sistema nuevo

1. Agregar cuentas al plan (`ledger/accounts.ts`), o un libro propio con `ledger/core.ts` si la entidad tiene contabilidad independiente (como las empresas).
2. Modelar el estado en `state.ts` y subir `SAVE_VERSION` con su migración en `persistence/migrations.ts`.
3. Escribir la lógica como funciones puras que solo muevan dinero vía `post()`.
4. Registrar su proceso diario/mensual en `simulation.ts`.
5. Agregar invariantes de conciliación en `invariants.ts`.
6. Agregar reglas al asesor, criterios de progreso y términos al glosario.
7. Pruebas: unidad (fórmulas) + integración (años simulados con invariantes).
