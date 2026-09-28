# Estado del proyecto — versión 1.0 (Fases 1 a 5)

## Verificación realizada (resultados reales en este entorno)

- `npx vitest run`: **130 pruebas en 17 archivos, todas pasan** (≈ 55 s en un núcleo).

  | Archivo | Pruebas | Qué comprueba |
  |---|---|---|
  | ledger | 5 | Partida doble: cuadre, rechazo de asientos inválidos, saldos no negativos, recomputación. |
  | tax | 5 | Tramos progresivos, deducciones, crédito educativo, retenciones vs. declaración. |
  | loans | 5 | Amortización, costo total, anticipos, mora e impago. |
  | card | 4 | Corte, gracia, intereses, mínimo, recargos. |
  | simulation | 11 | 5 años con invariantes cada mes, Δ patrimonio = resultado neto, determinismo, inflación, offline. |
  | save | 6 | Guardar/cargar idéntico, checksum, recuperación de copias, rechazo de estados imposibles, migración v0. |
  | save_v2 | 4 | Guardado con empresas, migraciones hasta v3, almacenamiento espejado. |
  | audit | 10 | Auditoría de la Fase 1 con bots aleatorios (6 semillas × 4 años). |
  | business | 27 | Empresas: fundación, 5 sectores × 2 años, FIFO, proveedores, personal, marketing, préstamos, impuestos, formas legales, **quiebra con responsabilidad limitada e ilimitada**, salida de insolvencia, venta, compra, emisión, liquidación. |
  | audit_business | 4 | Bots empresariales aleatorios (4 semillas × 3 años) con invariantes cada mes. |
  | invest | 10 | Compra/venta con costo FIFO, comisiones, ganancias realizadas y no realizadas; órdenes límite, stop y OCO; dividendos con retención; estimación del analista que mejora con la habilidad pero nunca es exacta; bonos (duración, cupones, nominal); fondos; Mogul Exchange; corto/largo plazo y arrastre de pérdidas. |
  | realestate | 6 | Compra al contado (escritura, alquiler, gastos, impuesto, tasación); hipoteca (cuota, intereses, amortización, venta que cancela); **impago → ejecución con recurso**; local propio de una empresa con depreciación; vivienda propia; tasación. |
  | world | 13 | Ciclo económico de 20 años acotado; recesión que reduce demanda y aumenta despidos; residencia fiscal; impuesto de sociedades por jurisdicción; contador; holding sin doble conteo; auditoría externa; proyección del asesor; evasión y regularización; caso penal por etapas; actividades clandestinas desactivables; asesor con riesgos reales; escenarios. |
  | audit_world | 3 | **Auditoría integral**: bots aleatorios en TODOS los sistemas (bolsa, bonos, fondos, Mogul, inmuebles, hipotecas, empresas, holdings, préstamos intragrupo, profesionales, jurisdicciones, actividades ilegales, multas, casos) durante 3 años × 3 semillas; cada mes: invariantes, Δ patrimonio = resultado y conciliación del flujo de caja. |
  | indicators | 2 | SMA, EMA, RSI, MACD, Bollinger, volatilidad, beta, VaR, caída máxima. |
  | phase5 | 12 | Compactación del libro (informes mensuales idénticos antes y después, personal y empresa; patrimonio intacto); guardado comprimido idéntico al original; payload alterado rechazado; **copia principal dañada → se carga la mejor copia válida sin borrar las demás**; escritura interrumpida recuperada; almacenamiento lleno (libera copias viejas, nunca la principal); instantánea liviana para deshacer; **insolvencia personal** de punta a punta; rendimiento de 10 años. |
  | content | 3 | Integridad del glosario (285 términos) y de todas las referencias de ayuda. |

- Rendimiento medido (prueba `phase5`, Node, un núcleo): **10 años de juego con empleo, empresa, acciones, fondo e inmueble en ≈ 2,9 s** (≈ 1.280 días/s). Estado ≈ 2,15 MB; guardado comprimido ≈ 0,68 MB; libro personal: 1.515 asientos detallados + 3.541 resumidos en baldes mensuales. Instantánea para deshacer ≈ 3,7 ms frente a ≈ 30 ms de una copia completa (partida de 4 años con dos empresas).
- `npx tsc -b`: sin errores (TypeScript estricto).
- `npm run build`, `npm run build:single` y `npx cap sync android`: correctos.
- Recorrido automatizado en Chromium emulando un teléfono (390 × 844, táctil, tema oscuro) sobre la compilación de un solo archivo: crear partida; comprar acciones en Bolsa Lite, analizar, abrir Trading Pro; comprar bonos, invertir en un fondo y en Mogul Exchange; inspeccionar un inmueble e intentar comprarlo (rechazo correcto por fondos, con el detalle del efectivo necesario); crear una holding; recorrer Economía, Impuestos, Profesionales (contratar un contador), Legal, Informes y el Asesor. **Sin errores de consola.** Auditoría de botones en Invertir (7 secciones), mercado inmobiliario, Economía, Impuestos, Profesionales, Legal y creación de holding: todos los botones de acción tienen ⓘ; solo quedan sin ⓘ los de navegación ("← Más", "← Volver").
- **No verificado aquí:** la APK **no se compiló ni se ejecutó** en este entorno (no hay SDK de Android y la red no permite descargarlo). Se verificaron la configuración de Capacitor, el proyecto Android sincronizado y el flujo de GitHub Actions. No hubo pruebas en un teléfono físico.

## Errores encontrados y corregidos durante las Fases 3–5

1. Empresas en venta y de Mogul que nacían insolventes: los marcadores de ausencia/capacitación/averías empezaban en 0 y, con días virtuales negativos, anulaban la productividad. Ahora se construyen en su día de inicio y los marcadores empiezan en `día − 1`.
2. El gerente NPC contrataba mal (contaba fines de semana en la utilización) y no ajustaba producción ni marketing: corregido.
3. Asiento vacío al vender una empresa sin plusvalía: se filtran líneas en cero.
4. Depósito de efectivo no declarado clasificado como "interno" aunque movía caja: rompía la conciliación del flujo; ahora es operativo.
5. El asesor y el gerente fallaban con holdings (sin productos ni mercado): protegidos.
6. Honorarios legales podían dejar la cuenta en negativo: ahora usan la cadena de pagos con atrasos.
7. Las inspecciones registraban un motivo y mostraban otro al azar: unificado.
8. El guardado superaba el cupo de `localStorage` en partidas largas (error no controlado): compactación, compresión y manejo del cupo.
9. El escenario de baja de tasas podía llevar la tasa a negativo: acotado en 0.

## Implementado y funcionando

**Fases 1 y 2** (ver versiones anteriores): libro mayor de partida doble, banca, tarjeta, préstamos, puntaje, presupuesto, 29 empleos, impuestos, 14 habilidades, 33 formaciones, progresión, asesor; empresas completas en 5 sectores con contabilidad propia.

**Fase 3 — Inversiones y bienes raíces**
- Bolsa con 20 empresas ficticias en 10 sectores: precios diarios por oferta y demanda (mercado, sector, valor justo, momento, ruido), resultados trimestrales, dividendos, splits, quiebras e IPO, noticias.
- **Bolsa Lite** (compra/venta simple, gráficos de 3 meses/1 año/todo, fundamentos, análisis) y **Trading Pro** (velas con volumen, SMA/EMA/Bollinger, RSI/MACD, 7 tipos de órdenes incluida OCO, órdenes abiertas e historial, análisis de riesgo de la cartera, comparador con correlación). Ambas sobre el mismo mercado y la misma contabilidad.
- Cartera: composición, ganancias realizadas y no realizadas, dividendos, riesgo (volatilidad, beta, VaR, caída máxima, concentración), proyección a 12 meses, últimas operaciones.
- Bonos soberanos y corporativos con calificación, rendimiento, duración, cupones, vencimiento e impago.
- 6 fondos de inversión con explicación de funcionamiento y riesgos.
- **Mogul Exchange**: participaciones fraccionadas en empresas simuladas, edificios y regalías, con valoración detallada, repartos, rendimiento y riesgo.
- Bienes raíces: 7 zonas, viviendas, locales, oficinas y terrenos; compra personal o por empresa; contraoferta; inspección; hipotecas de 3 bancos (fija/variable, LTV, cuota/ingresos); alquiler, inquilinos, morosidad, desalojo, vacancia, administración propia o inmobiliaria; mantenimiento, reparaciones, impuesto; renovaciones y construcción; uso propio; venta publicada o rápida; ejecución hipotecaria con o sin recurso; informe de rentabilidad por inmueble.

**Fase 4 — Mundo, impuestos, profesionales, grupos, legal y asesor avanzado**
- Economía dinámica con 5 fases, PIB, desempleo, inflación, tasa por regla de Taylor, confianza, costos de proveedores y 12 eventos, con efectos sobre empresas, empleo, crédito, bolsa, bonos, fondos e inmuebles. Pantalla Economía y chip en Inicio.
- 4 jurisdicciones con reglas propias; residencia fiscal; comparación de carga; obligaciones de los próximos 12 meses; informe del contador.
- Profesionales contratables (contador, asesor, abogado, auditor, gerente) con experiencia, especialidad, costo, reputación y calidad oculta.
- Holdings y subsidiarias en cadena, préstamos intragrupo, honorarios de gestión, dividendos hacia la matriz, centralización de caja, delegación común, estados consolidados con eliminaciones, riesgos individuales y consolidados, transferencia al grupo y salida del grupo.
- Sistema legal ficticio y opcional: soborno, evasión (personal y empresarial), cifras infladas, retiro no declarado, negocios clandestinos, depósitos y lavado; sospecha, detección, auditoría anual, investigación, imputación con acuerdo, juicio, sentencia, apelación, multas con plan de pagos o embargo, decomiso, suspensión de licencias, antecedentes, prisión con libertad anticipada, inspecciones, regularización voluntaria. Abogados que revisan, preparan, negocian y apelan sin garantizar la absolución.
- Asesor IA avanzado con alertas de insolvencia personal, quiebra, deuda, concentración, caída de cartera, riesgos inmobiliarios, impuestos, legal y ciclo; escenarios nuevos (recesión, tasas, caída de bolsa, compra de inmueble, vender cartera).

**Fase 5 — Optimización, personalización y guardado**
- Compactación del libro mayor en baldes mensuales (saldos e informes exactos), límites de historiales, instantánea liviana para deshacer, división de código.
- Guardado comprimido con checksum, carga de la copia válida más reciente, manejo de almacenamiento lleno, copias que nunca se destruyen entre sí, exportación/importación (texto plano o comprimido), migraciones hasta v3, validación completa al cargar.
- Ajustes: tema, tamaño de texto, densidad, alto contraste, paleta para daltonismo, reducir animaciones, velocidad base, qué eventos pausan el tiempo, confirmaciones, categorías de alertas del asesor, progreso sin conexión, dificultad económica y actividades ilegales (también al crear la partida).
- Compatibilidad con WebView antiguos: copia profunda sin `structuredClone`, guardado sin compresión si no hay `CompressionStream`.

## Limitaciones conocidas

- APK no compilada ni probada en dispositivo desde este entorno (ver README → "Generar la APK").
- Los informes de períodos antiguos que cortan un mes ya compactado se prorratean por días (los meses completos son exactos). El detalle de asientos de más de ~1–2 años se ve resumido por mes.
- La competencia IA es reactiva pero simple; no compite por empleados ni proveedores.
- La bolsa es un modelo estadístico por empresa (no hay libro de órdenes de otros participantes); el impacto de mercado y el diferencial lo aproximan.
- Mogul Exchange ofrece un conjunto acotado de activos (6 al iniciar, reemplazados al liquidarse); los bonos corporativos solo existen para empresas cotizadas.
- Las actividades ilegales son deliberadamente abstractas (decisiones y riesgos, sin métodos reales).
- La accesibilidad de los gráficos SVG para lectores de pantalla se limita a descripciones generales (`aria-label`).
- Personalización cosmética (logotipos, oficinas, vehículos, lujo) no incluida: se priorizaron sistemas funcionales.
- El tamaño de texto usa `zoom` de CSS (bien soportado en Chrome/WebView; en navegadores sin soporte se ignora).

## Guía para continuar el desarrollo

1. `npm install && npm test && npm run dev`.
2. Leé `docs/ARQUITECTURA.md` → "Cómo agregar un sistema nuevo".
3. Regla de oro: **ningún sistema cambia saldos fuera de `post()` / `coPost()`**; toda compra o venta de valores pasa por `invest/portfolio.ts`; cada subregistro agrega su conciliación en `invariants.ts`.
4. Todo cambio del formato de partida sube `SAVE_VERSION` y agrega una migración con su prueba.
5. Cada regla nueva se documenta en `docs/REGLAS_ECONOMICAS.md`, en el glosario (con `how`) y, si genera riesgos, en el asesor.
6. Los efectos macro se leen siempre desde los lectores de `economy/economy.ts` para mantener la coherencia entre sistemas.
