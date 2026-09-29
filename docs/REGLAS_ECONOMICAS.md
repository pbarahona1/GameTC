# Reglas económicas (versión 1.0: Fases 1 a 5)

Todas las cifras están en **centavos enteros** en el motor. Cada cálculo con decimales se redondea una sola vez (`roundCents`, mitad lejos de cero) y el valor redondeado es el que se contabiliza, de modo que la pantalla y el libro mayor siempre coinciden.

## 1. Contabilidad

- **Partida doble.** Todo asiento cumple `Σ Debe = Σ Haber`.
- **Naturaleza de saldos.** Activo y Gasto aumentan con el Debe; Pasivo, Patrimonio e Ingreso con el Haber.
- **Cuentas sin saldo negativo:** efectivo, corriente, ahorro, depósitos, jubilación, devoluciones por cobrar y todos los pasivos. Es la regla que impide gastar dinero que no existe.
- **Ecuación contable (verificada):** `Activo = Pasivo + Patrimonio inicial + (Ingresos − Gastos)`.
- **Patrimonio neto** = Activos − Pasivos (valores contables; los valores de mercado llegan con la bolsa y los inmuebles).
- **Liquidez disponible** = Efectivo + Cuenta corriente + Cuenta de ahorro.
- **Conservación:** en cualquier período, `Δ Patrimonio neto = Resultado neto` (probado en `tests/simulation.test.ts`).

### Plan de cuentas

| Tipo | Cuentas |
|---|---|
| Activo | Efectivo, Cuenta corriente, Cuenta de ahorro, Depósitos a plazo, Fondo de jubilación, Devolución de impuestos por cobrar |
| Pasivo | Tarjeta de crédito, Préstamos personales, Impuestos por pagar, Pagos vencidos |
| Patrimonio | Patrimonio inicial |
| Ingreso | Salario bruto, Bonos y comisiones, Aporte del empleador, Intereses ganados, Otros |
| Gasto | Vivienda, Alimentación, Transporte, Servicios, Ocio, Salud, Educación, Intereses pagados, Comisiones bancarias, Comisiones de apertura, Recargos por mora, Impuesto sobre la renta, Seguridad social, Multas fiscales, Otros |

## 2. Estados financieros

- **Estado de resultados (devengado):** Ingresos brutos − (gastos de vida + financieros + educación + otros) = **Resultado antes de impuestos**; − (impuesto sobre la renta + seguridad social + multas) = **Resultado neto**. Tasa de ahorro contable = Resultado neto ÷ Ingresos brutos.
- **Flujo de caja (método directo):** solo asientos que tocan efectivo y equivalentes (efectivo, corriente, ahorro), clasificados en operación / inversión / financiamiento. Transferencias entre cuentas propias se neutralizan. `Saldo inicial + Variación = Saldo final` (probado).
- **Flujo de caja libre (personal)** = Flujo operativo − inversión en activos productivos (0 en Fase 1).
- **Diferencias explícitas:** una compra con tarjeta es gasto el día de la compra (resultado) y salida de caja cuando pagás la tarjeta (financiamiento). El aporte a jubilación no es gasto: es un traslado a un activo ilíquido.

## 3. Tiempo

- Día 0 = 1 de enero de 2026. El tiempo de juego es independiente del reloj real.
- Velocidades: pausa, 1× (1 día cada 2 s), 2×, 4×, 8×; saltos de 1, 7 y 30 días. Los saltos se detienen ante eventos importantes (ofertas, peligros, logros) si la pausa automática está activa.
- Sin conexión: 1 día cada 10 min reales, tope configurable (por defecto 30 días).

## 4. Banca

| Producto | Regla |
|---|---|
| Cuenta de ahorro | Tasa = max(0,25 %, tasa de política − 2 pp). Interés mensual = Σ saldos diarios × tasa ÷ 365. |
| Cuenta corriente | Sin interés. Comisión de $4/mes si el saldo promedio diario < $1,000. |
| Depósito a plazo | Plazos 3/6/12/24 meses; tasa = max(0,5 %, política − 1 pp + prima {0; 0,4; 0,8; 1,2} pp). Interés simple = capital × tasa × días ÷ 365, se cobra al vencimiento. Mínimo $500. Cancelación anticipada: sin intereses + comisión 0,5 %. |
| Barrido automático | Si la corriente no alcanza para un pago, se transfiere lo que falta desde el ahorro. |

## 5. Pagos y atrasos

Cadena al pagar un gasto: medio elegido → corriente (con barrido) → efectivo → tarjeta (si hay cupo) → **atraso**. En el atraso se paga lo que haya y el resto se registra como pasivo "Pagos vencidos" más un recargo del 5 % (mínimo $15). Con atrasos mayores a dos alquileres, el día 2 del mes se produce un **desalojo** al estilo austero.

## 6. Tarjeta de crédito

- Tasa anual variable = política + 22 pp.
- Corte el día 25; vencimiento 20 días después.
- Pago mínimo = min(saldo, max($25, 2 % del saldo)).
- **Período de gracia:** si el resumen anterior se pagó completo, no hay intereses. Si no, interés = Σ saldos diarios del ciclo × tasa ÷ 365.
- Pagar menos del mínimo: recargo de $29 + pago atrasado en el historial crediticio.
- Débito automático: ninguno / mínimo / total, al vencimiento.
- Aumento de límite: consulta de crédito; requiere puntaje ≥ 680 e ingreso; nuevo límite = min(1,5 × ingreso bruto mensual, 2 × límite actual, $50,000).

## 7. Préstamos personales

- Cuota fija (sistema francés): `C = P·r ÷ (1 − (1+r)^−n)`, `r = TNA ÷ 12`, redondeada hacia arriba al centavo; la última cuota ajusta el remanente.
- Tasa = política + diferencial del banco + prima de riesgo (puntaje ≥760: 0; ≥700: 1; ≥650: 3; ≥600: 6; <600: 10 pp) − rebaja negociada.

| Banco | Diferencial | Puntaje mín. | Deuda/ingreso máx. | Monto máx. | Comisión | Plazo máx. |
|---|---|---|---|---|---|---|
| Banco Austral | 4 pp | 690 | 36 % | 8 × ingreso | 1 % | 60 m |
| Crédito Andino | 8 pp | 620 | 43 % | 5 × ingreso | 2 % | 48 m |
| FinaRápido | 28 pp | 450 | 50 % | 2 × ingreso ($600 sin ingreso) | 5 % | 24 m |

- **Límites anti "dinero infinito":** máximo 3 préstamos activos; sin ingresos solo FinaRápido y un único préstamo; rechazo con atrasos o impagos; cada solicitud es una consulta que baja el puntaje.
- La comisión de apertura es gasto inmediato (el préstamo reduce tu patrimonio en ese monto).
- Cuota impaga: el interés del mes se capitaliza + recargo de $25. Tres seguidas → **impago**: embargo del 20 % del salario neto en cada nómina hasta cancelar, reputación −10.
- Negociar tasa: probabilidad = 0,2 + 0,006 × Negociación + 0,002 × Inteligencia social (tope 85 %); rebaja = min(1,5 pp, 0,5 pp + Negociación ÷ 100 pp), válida 30 días; un intento cada 30 días por banco.

## 8. Puntaje crediticio (300–850)

`300 + Historial (192) + Utilización (165) + Antigüedad (82) + Mezcla (55) + Consultas (55)`
- Historial: con menos de 6 pagos a tiempo el factor es 0,55 + 0,05 × pagos; cada atraso de los últimos 24 meses resta 0,15 y cada impago 0,5.
- Utilización (saldo ÷ límite): 10 % → 100 %, 30 % → 80 %, 50 % → 55 %, 75 % → 30 %, 90 % → 15 %, 100 % → 5 % (interpolado).
- Antigüedad: 0,3 + meses ÷ 120 (máx. 1). Mezcla: tarjeta 0,5 + préstamo con ≥3 cuotas pagas 0,5. Consultas: 1 − 0,2 × consultas en 12 meses.

## 9. Empleo

- Salario de vacantes = salario base del puesto × índice de precios, redondeado a $10.
- Probabilidad de oferta = 0,35 + 0,004 × Int. social + 0,002 × (reputación + red) + 0,005 × exceso de habilidades requeridas (máx. 20) + 0,003 × meses de experiencia excedente (máx. 0,1) ± suerte (±0,03); acotada a [8 %, 92 %]. Respuesta en 3–10 días; oferta válida 7 días; oferta = salario × (1 − 3 % … +5 %).
- Máximo 5 postulaciones en curso; 30 días de espera tras un rechazo en el mismo puesto.
- Negociación: éxito = 0,55 + 0,005 × Negociación + 0,002 × Int. social − 2,5 × % pedido (acotado 5–90 %). Si se pide ≥15 % y falla, 30 % de que retiren la oferta.
- **Nómina** (último día del mes, prorrateada por días en el primer y último mes): ver Impuestos.
- Comisión (ventas) = sueldo del período × % comisión × desempeño ÷ 50.
- **Desempeño** tiende mensualmente (30 %) a: 50 + 0,8 × promedio de (nivel − requerido) de las habilidades clave (acotado −20…+30) + 0,2 × meses de experiencia (máx. 60) + 0,1 × Disciplina − 0,6 × (estrés − 60)⁺ − 0,4 × (50 − salud)⁺ − 0,5 × (horas semanales − 60)⁺ ± 3.
- Evaluación anual: aumento 6 % (≥85), 4 % (≥70), 2,5 % (≥55), 1 % (≥40), 0 %; bono = sueldo anual × bono objetivo × clamp((desempeño − 30) ÷ 40, 0, 1,5). Ascenso si desempeño ≥ 70 y se cumplen los requisitos del puesto siguiente (sueldo = max(+8 %, sueldo del puesto)).
- Tres meses seguidos con desempeño < 30 → despido con un mes de indemnización.
- Experiencia: +1 mes por sector si trabajaste ≥ 15 días del mes. XP de habilidades por mes proporcional a los días trabajados.

## 10. Impuestos — República de Valdoria

- Renta progresiva anual: 0 % hasta $9,600 · 10 % hasta $24,000 · 20 % hasta $60,000 · 30 % hasta $150,000 · 37 % el resto. Cada tasa solo sobre su tramo.
- Seguridad social: 7 % del bruto (tope $12,000/mes de salario sujeto).
- Aporte del empleado a jubilación: 0–15 % elegible; **deducción** de la base hasta 15 %.
- Aporte del empleador: min(tu aporte, % del puesto) × bruto; ingreso no imponible que va al fondo.
- Retención mensual = impuesto(anual de (bruto − aporte deducible) × 12) ÷ 12. Pagos extraordinarios (bono, indemnización): retención por el impuesto marginal que agregan.
- Declaración el 1 de enero: base = salarios + bonos + intereses − deducción; impuesto por tramos; **crédito educativo** 15 % del gasto en educación (máx. $600, no reembolsable); saldo = impuesto − créditos − retenciones.
- Saldo a pagar vence el 30 de abril (cobro automático si hay fondos); mora: multa 5 % + 1 % cada 30 días. Devolución el 15 de mayo.

## 11. Presupuesto, estilo de vida e inflación

| Estilo | Total mensual (año 1) | Estrés/mes | Salud |
|---|---|---|---|
| Austero | $585 | +3 | −1 |
| Modesto | $890 | 0 | 0 |
| Cómodo | $1,815 | −3 | +1 |
| Acomodado | $3,610 | −5 | +2 |
| Lujoso | $9,220 | −7 | +2 |

- Mudanza: medio mes del nuevo alquiler.
- Seguro médico privado $70/mes (indexado) si el empleo no lo incluye.
- **Inflación:** cada 1 de enero los gastos recurrentes suben la inflación del año anterior; la nueva inflación revierte a 3 % (`π' = π + 0,35 (3 % − π) ± 1,2 pp`, 0–12 %); tasa de política = 1,5 % + π + 0,5 (π − 2 %). Tarjeta y ahorro son variables; préstamos y depósitos, fijos.

## 12. Atributos personales (mensual)

- **Estrés**: `estrés += presión − 0,2 × (estrés − 15)`; presión = 0,6 × estrés del puesto + estilo de vida + 0,4 × (horas − 50)⁺ × (1 − 0,003 × Disciplina) + 4 si deuda/ingreso > 40 % + 5 con atrasos + 4 sin empleo y liquidez < $1,500.
- **Salud** tiende (10 %/mes) a 80 + 5 × salud del estilo − 0,8 × (estrés − 50)⁺.
- **Reputación** tiende (5 %/mes) a 12 × nivel del puesto + 2 × certificados + 3 × reputación del estilo.
- **Red de contactos**: +0,2 × nivel del puesto por mes; + estudios formales al completarlos.
- **Imprevisto médico** (día 15): probabilidad = 1,5 % + 0,3 % × (60 − salud)⁺ − suerte; costo $40–150 con seguro, $300–2,500 sin seguro.

## 13. Habilidades y formación

- 14 habilidades, niveles 1–100. XP al siguiente nivel = round(20 × nivel^1,35).
- Fuentes: trabajo (XP mensual del puesto), estudio (XP repartida por día, × (1 + 0,003 × Disciplina)), práctica (acciones del juego).
- **Anti-grinding:** la misma práctica el mismo día rinde 100 %, 50 %, 25 % y luego 0. Repetir un curso completado rinde 20 %; un título no se repite.
- Suerte: rasgo fijo 30–70, efecto ±3 pp en algunas probabilidades.
- Formación: hasta 2 estudios simultáneos; títulos con matrícula cada 30 días (si no se puede pagar, baja del curso).

## 14. Progresión

- 12 etapas con criterios múltiples (patrimonio, fondo de emergencia, crédito, ingresos pasivos, solvencia…). La etapa alcanzada no retrocede. Ningún criterio exige una ruta concreta.
- Nivel profesional = 1 + ⌊√(puntos de carrera ÷ 40)⌋; puntos/mes = nivel del puesto × 10 × desempeño ÷ 50.

## 15. Asesor IA

Reglas deterministas sobre `computeMetrics()`:
- **Pista de efectivo** = liquidez ÷ déficit mensual esperado, con rango (gastos −5 % / +10 %; más amplio si Educación financiera < 15; escenario pesimista con Gestión del riesgo ≥ 10).
- Alertas de atrasos, impagos, vencimiento de tarjeta, intereses de tarjeta, utilización > 30 %, deuda/ingreso > 36 %, fondo de emergencia, dinero ocioso (costo de oportunidad), exceso de ahorro vs. depósito, impuestos, estrés, seguro, desempeño y estilo de vida > 70 % del neto.
- Cada alerta separa **hechos** (libro mayor), **estimaciones** (con supuestos) y **opciones** (ventajas y riesgos), e indica qué pasa si no se hace nada.
- Escenarios "¿qué pasaría si…?" simulan una copia de la partida sin eventos aleatorios.

## 16. Empresas (Fase 2)

### Libertad y creación
- Fundar o comprar una empresa **no exige** empleo, ahorro ni etapa previa: solo el capital necesario (y, para la consultora, Contabilidad 10 o el certificado "Contable básico", porque presta un servicio profesional).
- El asistente de fundación muestra el **desglose exacto** del capital inicial: constitución, depósito de alquiler, equipamiento obligatorio, contratación de los primeros empleados, inventario inicial y capital de trabajo, y permite **simular 12 meses** (copia de la partida, sin azar) antes de confirmar.
- Período de puesta en marcha: 7 días sin ventas.

### Sectores y modelos de negocio
| Sector | Modelo | Particularidad |
|---|---|---|
| Cafetería | Gastronomía | Insumos perecederos, recetas, capacidad de cocina, demanda por día de semana. |
| Minimercado | Comercio | Reventa con márgenes bajos, mermas, rotación de inventario. |
| Fábrica de muebles | Manufactura | Producción por plan, mano de obra calificada, ventas a crédito (cuentas por cobrar). |
| SaaS | Suscripción | Usuarios, cancelaciones (6 %/mes base), capacidad de servidores y soporte, sin inventario. |
| Consultora | Servicios | Horas facturables, capacidad = consultores, sin inventario. |

### Demanda (modelo de elección)
- Atractivo = e^(−elasticidad × (precio/referencia − 1)) × (0,4 + calidad/100) × (0,5 + reputación/100) × (0,08 + 0,92 × conocimiento/100) × (1 + bonos).
- Cuota esperada = atractivo propio ÷ (propio + competidores IA + otras empresas del jugador + opción externa). La opción externa (no comprar) pesa 30 % de un competidor neutro.
- Demanda del día = mercado diario × factor día de semana × factor mensual × sensibilidad a la tasa de política (1 − s × (tasa − 5 %), 0,5–1,3) × índice sectorial (paseo aleatorio mensual).
- Ventas = mín(demanda, stock, capacidad). Lo que no se vende por falta de stock o capacidad se registra como **ventas perdidas**.
- **Calidad** = 45 + (calidad de insumos − 60) × 0,4 + (habilidad del personal productivo − 50) × 0,3 + bonos de equipos × estado + I+D (± gerente); en SaaS baja si hay más usuarios que capacidad.
- Competidores IA: ajustan precios y calidad cada mes; un rival débil (reputación < 30) puede salir y, si quedan pocos rivales, entra uno nuevo.

### Inventario y proveedores
- 2–3 proveedores por insumo con precio, calidad, confiabilidad, plazo de entrega, pedido mínimo y días de pago (algunos exigen red de contactos). Pago anticipado o a plazo (cuenta por pagar). Si no se paga al vencimiento, el proveedor se bloquea y la deuda pasa a atrasos con recargo del 3 %.
- Lotes FIFO con valor exacto; caducidad según vida útil del insumo × equipos de conservación; mermas diarias reducidas por equipos; costo de almacenamiento mensual.
- Reglas de reorden (punto de pedido y cantidad), ejecutadas semanalmente o por el gerente.

### Personal
- Candidatos con habilidad y salario pedido (salario de mercado según habilidad e índice de precios). Honorario de selección 25 % del salario mensual. Carga patronal 12 %.
- Capacitación: $300, 10 días (no trabaja), sube habilidad.
- **Moral** mensual tiende a 62 + (salario/mercado − 1) × 100 + 5 por cada RR. HH. − 10 si la utilización > 95 % − 40 con sueldos impagos. Renuncia: (40 − moral) % si moral < 40; si no, 1 % (0,5 % con RR. HH.).
- Despido: indemnización = salario × máx(0,5, años de antigüedad) y −4 de moral al resto.
- Roles comunes: gerente, contador, vendedor, marketing, RR. HH., soporte, logística, investigador; cada sector suma roles productivos propios.

### Marketing
- 7 canales (digital, redes, tradicional, patrocinio, contenido, promoción, fidelización) × 6 públicos con ajuste por sector.
- Conocimiento diario: +eficiencia × ajuste × especialista × (gasto real/100)^0,6 × (1 − conocimiento/100) × ruido; olvido 1 %/día (0,5 % con contenidos).
- Estudio de mercado: $600, válido 90 días; revela precios y calidad de la competencia.

### Contabilidad, impuestos y propiedad
- Cada empresa tiene su **libro mayor propio**. En el patrimonio personal figura como *participación en empresas* por el método de participación (patrimonio × % + plusvalía).
- **Formas legales:**
  | Forma | Constitución | Impuesto | Responsabilidad |
  |---|---|---|---|
  | Individual | $50 | Resultado a tu declaración personal | Ilimitada |
  | Sociedad colectiva | $250 + $20/mes | Personal; un socio aporta y recibe 40 % | Ilimitada |
  | SRL | $400 + $35/mes | 25 % empresa + 10 % dividendos | Limitada |
  | Corporación | $2,000 + $150/mes | 25 % + 10 %; puede emitir acciones (5–30 % por ronda, mínimo 51 % propio) | Limitada |
- Impuesto de sociedades: 25 % de la ganancia anual, con arrastre de pérdidas de 5 años; se declara el 1 de enero y se paga el 30 de abril; si no hay caja, multa del 5 % y pasa a atrasos.
- Retiros y dividendos: máximo = caja − reserva (días de nómina + costos fijos según la política) − atrasos; con responsabilidad limitada, además, no más que las ganancias acumuladas distribuibles. Política automática opcional (mensual/trimestral/anual).
- Venta: oferta = valoración × 0,85–1,10 (× 0,6 si insolvente), comisión 3 %, impuesto a la ganancia de capital 15 % sobre (precio − invertido neto).
- Compra: precio pedido + 3 % de costos de adquisición; una contraoferta cuya probabilidad depende del descuento y de Negociación.
- **Valoración** = el mayor de: EBITDA anual × múltiplo (3–5 según sector) + caja − deuda; valor de activos (caja + 90 % cobrar + 70 % inventario + 60 % equipos − deuda); en SaaS, ingresos recurrentes × 24 × calidad/70 − deuda.

### Préstamos empresariales
- Banco Austral PyME: empresa con ≥ 180 días, EBITDA/cuotas ≥ 1,25, tasa = política + 5 pp, comisión 1 %.
- Crédito Andino Empresas: empresas nuevas con **garantía personal** (puntaje ≥ 640), tasa = política + 9 pp, comisión 2 %. Si la empresa no paga, paga el dueño.

### Insolvencia y quiebra
- Obligaciones impagas → atrasos con recargo del 3 %. Con atrasos, la empresa entra en insolvencia; tras **60 días** sin regularizar, quiebra y liquidación forzosa.
- Recupero en quiebra: inventario 30 %, equipos 40 %, cobrar 70 %, depósito 50 %. Liquidación voluntaria: 50 / 60 / 95 / 100 %.
- Responsabilidad ilimitada (individual/sociedad): el faltante lo paga el dueño con su patrimonio personal. Responsabilidad limitada: se pierde lo aportado, salvo préstamos con garantía personal.

### Asesor empresarial
- Alertas: riesgo de insolvencia/quiebra con días estimados, pista de caja (rango ± 15–20 % a partir de la quema de los últimos 90 días), pérdidas recurrentes, exceso de inventario, stock por vencer, ventas perdidas, salarios altos, caída de ventas, precio bajo el costo, moral baja, pagos a proveedores sin caja, equipos deteriorados y concentración de la cartera.
- Cada proyección indica sus **limitaciones**: supone precios, demanda y costos como los últimos meses; no anticipa estacionalidad futura, cambios de la competencia ni eventos.
- Delegación: el gerente decide semanalmente reorden, precios y personal; su error disminuye con su habilidad.

## 17. Economía dinámica (Fase 4)

Paso mensual (`economy/economy.ts`, día 1 de cada mes):

- **Ciclo en 5 fases** con duración mínima y máxima: expansión (14–42 meses), auge (5–16), desaceleración (4–12), recesión (6–18), recuperación (5–14). Transiciones: expansión → auge (35 %) o desaceleración (65 %); desaceleración → recesión (50 %, multiplicado por la dificultad) o expansión; auge → desaceleración; recesión → recuperación → expansión.
- **PIB, desempleo y confianza** convergen gradualmente al objetivo de la fase (con ruido): p. ej. recesión −2,2 % PIB, 8,5 % desempleo, confianza 0,84.
- **Inflación** anualizada: converge 12 % por mes hacia `3 % + 0,4 × (PIB − 2,5 %) + 0,5 × (costo de proveedores − 1) + eventos` (con ruido, entre −1 % y 15 %); el índice de precios se actualiza cada mes y los gastos anuales se indexan el 1/1 con la inflación realmente ocurrida.
- **Tasa de política** revisada en enero, abril, julio y octubre con una regla de Taylor: `2 % + inflación + 0,5 × (inflación − 2 %) + 0,5 × (PIB − 2,5 %)`, entre 0,25 % y 15 %, con pasos de a 0,25 pp y como máximo 0,75 pp por revisión.
- **Eventos** (12 tipos: shock del petróleo, crisis bancaria, burbuja o corrección inmobiliaria, huelga, ola de consumo, pánico o rally bursátil, mala cosecha, boom exportador…) con duración de 1 a 14 meses y efectos declarados sobre demanda por sector, costo de proveedores, bolsa, vivienda, desempleo, inflación, diferencial de crédito y vacancia.
- **Efectos coherentes** (lectores únicos usados por todos los sistemas): demanda de las empresas (× confianza × ciclicidad del sector × eventos), costo de insumos, factor del mercado laboral (postulaciones y despidos), diferencial de crédito (préstamos e hipotecas), deriva y volatilidad de la bolsa, deriva de precios inmobiliarios y vacancia.
- **Dificultad** (fácil, normal, difícil, realista): multiplica volatilidad, probabilidad de recesión, frecuencia de eventos, intensidad de controles y exigencia de puntaje de los bancos. Nunca cambia las reglas contables.

## 18. Bolsa de valores (Fase 3)

- 20 empresas ficticias en 10 sectores. Precio diario solo en días hábiles: `r = β·r_mercado + deriva sectorial + reversión al valor justo + momento + ruido`.
- **Valor justo** = BPA × P/E justo; el P/E justo depende del sector, del crecimiento esperado, de la tasa de interés (tasas altas → P/E más bajos) y de la salud de la empresa.
- **Resultados trimestrales** cada 91 días: la sorpresa frente al BPA esperado mueve el precio; si hay beneficios se paga dividendo (el precio cae en la fecha de corte por lo pagado); retención según la residencia fiscal.
- **Split 2:1** si el precio supera $400. **Quiebra**: salud muy baja + pérdidas → precio cercano a cero, suspensión y exclusión a los 60 días (la inversión se pierde). Nuevas empresas salen a bolsa para reemplazarla.
- **Órdenes**: mercado, límite, stop, stop-límite, take profit, trailing stop y soporte + objetivo (OCO). Se evalúan contra el mínimo y máximo del día; con mercado cerrado se ejecutan en la apertura.
- **Costos**: diferencial compra/venta según liquidez, impacto de mercado para órdenes grandes (proporcional a la cantidad sobre el volumen medio) y comisión de 0,2 % (mínimo $1).
- **Contabilidad personal**: las acciones se valúan a mercado cada día contra "Ganancias no realizadas"; al vender se revierte lo no realizado y se registra la ganancia realizada = importe bruto − costo FIFO; la comisión es gasto. Para impuestos: corto plazo (< 1 año, según cada lote) o largo plazo.
- **Predicción**: el valor justo estimado tiene un error de ±35 % × (1 − habilidad/120), mínimo ±6 %, que mejora con la habilidad Predicción bursátil (estudio y práctica) o con un asesor. Aunque el valor justo fuera exacto, el precio depende de noticias, ciclo y ánimo del mercado: ninguna predicción es segura.
- **Indicadores** (Trading Pro): SMA, EMA, Bollinger, RSI, MACD, volatilidad anual, beta, caída máxima, VaR 95 % a 1 mes, Herfindahl y correlación, calculados con los precios reales del juego.

## 19. Bonos, fondos y Mogul Exchange (Fase 3)

- **Bonos** soberanos de las 4 jurisdicciones y corporativos de empresas cotizadas. Nominal $1.000, cupón semestral. Rendimiento exigido = tasa de política + prima por plazo + diferencial de crédito (corporativos: según salud y apalancamiento del emisor; Isla Coral: riesgo soberano). Precio = valor presente de los flujos (precio sucio). **Duración** modificada informada. **Impago**: si el emisor quiebra, se recupera el 40 % del nominal.
- **Fondos** (6): índice, tecnología, dividendos, bonos soberanos, monetario e inmobiliario (REIT). Valor liquidativo diario desde sus subyacentes reales (índice, acciones, bonos, tasa, índices de zonas) menos comisión anual. Mínimo $50; REIT con 1 % de entrada; los que reparten lo hacen cada trimestre.
- **Mogul Exchange** (participaciones fraccionadas desde 0,01): empresas pequeñas simuladas con el MISMO motor empresarial, edificios alquilados (ocupación real de la zona) y regalías con decaimiento. Valor por participación recalculado cada mes (valoración empresarial, tasación + caja, o valor presente de regalías); repartos mensuales de la caja. Tope de 49 % por inversor, comisión 0,5 %, diferencial según liquidez. Si el activo quiebra se liquida y se reparte lo recuperado.

## 20. Bienes raíces (Fase 3)

- 7 zonas en 4 jurisdicciones con precios y alquileres por m², vacancia natural, riesgo de morosidad, sesgo y volatilidad propios. Índices de zona mensuales = deriva inmobiliaria del ciclo + sesgo + ruido.
- **Tasación** = m² × precio de zona × índice × categoría × conservación. **Alquiler de mercado** análogo.
- **Publicaciones**: viviendas, locales, oficinas y terrenos; 35 % con inquilino, 14 % con vicios ocultos (la inspección técnica los revela; con abogado, además negocia la rebaja).
- **Compra**: personal o por una empresa. Gastos: impuesto de transferencia de la jurisdicción + 1 % de escribano. Contraoferta con probabilidad que baja cuanto más baja la oferta y sube con negociación e inmobiliaria (una sola vez).
- **Operación mensual**: cobro del alquiler según la confiabilidad del inquilino y el desempleo; 3 meses impagos → desalojo (costo legal; dura 90 días, o 30–75 con abogado según su calidad); renovación o salida al vencer; búsqueda de inquilino según vacancia, precio pedido y administración (inmobiliaria: 8 % del alquiler, 50 % más rápido); mantenimiento (0,1 % mensual del edificio, más si la conservación es baja); reparaciones aleatorias; impuesto inmobiliario trimestral; desgaste de la conservación.
- **Contabilidad**: personal a tasación (revaluación mensual contra ganancias no realizadas); empresa al costo menos depreciación (edificio en 40 años). Uso propio: vivir en la vivienda elimina el alquiler personal; el local propio elimina el alquiler de la empresa.
- **Hipotecas** (3 bancos): LTV máximo (terrenos menos), puntaje mínimo, relación cuota/ingresos (se cuenta el 70 % del alquiler esperado), empresas: cobertura ≥ 1,2× o patrimonio. Tasa fija (= política + diferencial + plazo) o variable (se revisa cada 12 cuotas). Cuota francesa. 3 cuotas impagas → **ejecución**: remate al 75 % de la tasación − 5 % de costos; en jurisdicciones con recurso, el saldo restante se sigue debiendo.
- **Obras**: renovación ligera (4 %, +15 de conservación) o integral (12 %, conservación 100 y +1 categoría, requiere desocupado); construcción sobre terreno (80 % de la superficie, costo por m² según tipo, 9–15 meses).
- **Informe por inmueble**: rentabilidad bruta y neta, cap rate, cash-on-cash, ocupación, flujo mensual, rendimiento total desde la compra, historial mensual.

## 21. Jurisdicciones fiscales (Fase 4)

Cuatro países ficticios (Valdoria, Isla Coral, Norvalia, Meridia), cada uno con: tramos de renta, seguridad social, ganancias de capital cortas y largas (y años de arrastre de pérdidas), retención de dividendos, reglas de alquileres (depreciación deducible, intereses hipotecarios, compensación de pérdidas), impuesto de sociedades, impuesto inmobiliario y de transferencia, recurso hipotecario, intensidad de controles y probabilidad de auditoría, costo de vida, costo de mudanza y patrimonio mínimo.

- **Residencia personal**: define los impuestos personales y el costo de vida; el cambio se paga hoy y rige desde el 1 de enero; se bloquea con procesos judiciales abiertos.
- **Empresas**: tributan donde están registradas; una empresa registrada fuera de tu residencia paga un costo administrativo mensual.
- **Inmuebles**: impuesto inmobiliario y de transferencia donde está el inmueble.
- **Deducciones**: el porcentaje de deducciones documentales que se aprovecha depende de la habilidad contable o de un contador contratado.
- **Declaración anual** (1/1): renta ordinaria (sueldo, intereses, cupones, alquiler neto) + ganancias de capital separadas por plazo con compensación y arrastre de pérdidas + dividendos con retención final.

## 22. Profesionales (Fase 4)

Contador, asesor financiero, abogado, auditor y gerente. Cada uno con experiencia, especialidad, honorario, reputación pública y calidad real oculta (la reputación la estima con error). Mercado renovado cada 60 días. Efectos:

- **Contador**: aprovecha el 100 % de las deducciones, prepara el informe de obligaciones, reduce el riesgo de errores en las declaraciones de las empresas y de desfalcos.
- **Asesor**: mejora la precisión de las estimaciones bursátiles (nunca exacta) y proyecta la cartera con Monte Carlo sobre los datos reales; cobra el mayor entre su anticipo y 1 % anual de la cartera.
- **Abogado**: revisa contratos (vicios ocultos), impugna inspecciones, revisa expedientes, prepara la defensa, negocia acuerdos y apela. No garantiza la absolución.
- **Auditor** (por encargo): verifica de verdad los libros de la empresa, detecta desfalcos e irregularidades (y debe informarlas). Una auditoría limpia sube la valoración y mejora el crédito durante 12 meses.
- **Gerente**: se incorpora como empleado de la empresa con su habilidad real.

## 23. Grupos empresariales (Fase 4)

- **Holding**: sociedad sin operación comercial cuyo activo son sus subsidiarias. Las subsidiarias deben ser SRL o corporaciones.
- **Método de participación en cadena**: la matriz registra sus subsidiarias en "Inversiones en subsidiarias" y el resultado en "Resultado de subsidiarias" (exento). En el balance personal solo figuran las empresas de primer nivel (sin doble conteo).
- **Préstamos intragrupo** espejados en ambos libros con intereses mensuales; **honorarios de gestión** (0–10 % de ventas); **dividendos hacia la matriz** exentos; **centralización de caja** (excedentes prestados a la matriz); **delegación común**.
- **Consolidación**: suma de los libros eliminando inversiones en subsidiarias, saldos y resultados intragrupo y resultado de subsidiarias; interés minoritario separado.
- **Riesgos**: por empresa (endeudamiento, caja, atrasos, exposición intragrupo) y consolidados (endeudamiento, caja, garantías personales). Si la matriz quiebra, sus subsidiarias se venden forzosamente al 60 % de su valoración.

## 24. Sistema legal y actividades ilegales ficticias (Fase 4)

Todo es abstracto y ficticio; se puede desactivar. Cada acto registra beneficio, monto, pruebas (0–100), gravedad (1–5), testigos, jurisdicción y prescripción (6 años), y sube la **sospecha**.

- **Detección mensual** por acto: base del tipo × controles de la jurisdicción × dificultad × (0,5 + sospecha/100) × (1 + 0,12 × testigos × descontento de empleados) × (0,5 + pruebas/100), tope 50 %. Además, auditoría fiscal anual (1/2) con probabilidad según la jurisdicción.
- **Proceso**: investigación (la acusación crece con las pruebas; si queda < 35 se archiva) → imputación con oferta de acuerdo (70 % de multa + restitución y 40 % de la prisión) → juicio → sentencia. Los casos fiscales leves se resuelven administrativamente (impuesto + intereses + 50 % de multa).
- **Probabilidad de condena** = logística((acusación − defensa)/14), con defensa = abogado (10 + calidad × 0,35; defensor público 12) + preparación × 0,5 + habilidad legal × 0,1; siempre entre 5 % y 95 %.
- **Sentencia**: multa = 1,5 × beneficio + 10 % del monto + $2.000 × gravedad; restitución de impuestos con 6 % anual; prisión (penal) = 4 meses × gravedad × (1 + 0,3 × antecedentes), en suspenso si ≤ 12 meses y sin antecedentes; decomiso del efectivo no declarado; suspensión de licencias de empresas por fraude, soborno o lavado; pérdida de reputación; antecedentes (afectan empleo y crédito).
- **Multas**: pago, plan de 12 cuotas (+10 %) o embargo de cuentas e inversiones al vencer. **Prisión**: sin empleo ni operaciones; las empresas siguen con su gerente; libertad anticipada posible tras 2/3.
- **Regularización voluntaria** de evasiones no descubiertas: impuesto + 20 % + intereses, sin causa penal.

## 25. Asesor IA avanzado (Fase 4)

Todas las alertas salen de datos reales de la partida: insolvencia personal (liquidez vs. obligaciones), quiebra empresarial, deuda/activos, cuotas/ingresos, concentración (Herfindahl), caída de rentabilidad y de cartera, riesgos inmobiliarios (vacancia, LTV, tasa variable, flujo negativo, morosos), impuestos pendientes y reserva para ganancias de capital, riesgos legales (casos, sospecha, multas, prisión), oportunidades de jurisdicción y fase del ciclo. **Escenarios** sobre una copia de la partida: recesión, suba de tasas, caída de la bolsa, compra de un inmueble con hipoteca, vender toda la cartera, además de los de Fases 1–2.

## 26. Fase 5: rendimiento y guardado

- **Compactación del libro mayor**: los asientos antiguos se resumen en baldes mensuales con el movimiento exacto de cada cuenta y el flujo de efectivo por clase y concepto. Retención de detalle: personal = año en curso + anterior; empresas del jugador = 13 meses; empresas simuladas de terceros = 2 meses. Los saldos nunca cambian; los informes de meses completos son exactos (probado); un mes antiguo cortado por la consulta se prorratea por días.
- **Guardado comprimido** (gzip nativo + base64) con checksum sobre el contenido original; lectura de partidas sin comprimir y exportaciones en texto plano.
- **Deshacer liviano**: `store.run` separa las listas que solo crecen (asientos, historiales) antes de copiar el estado; la copia es ~8 veces más rápida que copiar todo.

## 27. Proyección de negocios (versión 1.1)

- Habilidad nueva **Proyección de negocios** (🔮). Nivel efectivo = Proyección + 15 % de Administración + 10 % de Contabilidad (máx. 100).
- Proyectar un negocio (nuevo, en venta o propio) simula **5 + nivel/10 futuros** (máx. 15) de 12 meses sobre copias de la partida con distinto azar y las reglas reales. Se resumen por mes los percentiles 10 / 50 / 90 de ventas, ganancia y caja, la probabilidad de seguir abierta sin atrasos y el resultado del año.
- **Sesgo de lectura** (determinista por semana): error ±45 % × (1 − nivel/110), mínimo ±5 %. Se aplica como sesgo de demanda de hasta ±75 % de ese error; la ganancia se mueve con un margen de contribución del 30 % y la caja acumula esa diferencia. Los rangos se ensanchan en ±error/2 del escenario central. La probabilidad de sobrevivir cuenta como fracaso un futuro cuya caja, leída con tu sesgo, se vuelve negativa.
- **Experiencia**: cada proyección da 60 XP (con rendimientos decrecientes en el día); cada mes dirigiendo una empresa da 12 XP; al guardar la proyección al fundar o comprar, a los 3, 6 y 12 meses se compara con la realidad (80–200 XP según cuánto enseñó el error) y se informa si quedó dentro del rango.
- Cursos: libro (1.300 XP), curso (3.200 XP) y certificación (6.500 XP, requiere nivel 15).

## 28. Gestor de inversiones (versión 1.1)

- Profesional contratable (sin honorario fijo): comisión de gestión anual **0,6 %–2,0 %** (según reputación) cobrada mensualmente sobre el valor, y comisión de éxito **8 %–20 %** de la ganancia por encima del máximo histórico por unidad, cobrada cada 31/12 y al cerrar.
- La cuenta funciona como un fondo privado: unidades con valor inicial $100; aportes emiten unidades al valor del día; retiros venden a prorrata (el que retira paga los costos) y registran la ganancia de capital con lotes FIFO. Mínimo de apertura $2.500.
- **Decisiones reales** en el mercado del juego (rebalanceo mensual o al aportar): perfil conservador (25 % acciones / 55 % fondo de bonos / 20 % monetario), moderado (60/30/10) o agresivo (90/5/5). Elige 4, 6 u 8 acciones (según el tamaño de la cuenta) por retorno esperado = 0,1 × ln(valor justo estimado / precio) + deriva del mercado; el valor justo lo estima con error ±60 % × (1 − habilidad/110), mínimo ±6 %; descarta empresas con salud estimada < 25. Si no encuentra suficientes acciones atractivas, completa con el Fondo Índice.
- **Habilidad** = calidad × 0,85 + mín(30, experiencia) × 0,5. Con habilidad ≥ 60 reduce acciones 15 pp en desaceleración o recesión; con habilidad < 35 compra de más en el auge (+10 pp) y vende en el pánico (−20 pp en recesión).
- Costos de operar: medio diferencial de cada acción + 0,1 %. Dividendos, splits y repartos de fondos se reflejan en la cuenta; acciones que dejan de cotizar se pierden.
- En pruebas con 6 mercados distintos durante 2 años, un gestor de calidad 95 superó en promedio a uno de calidad 15, pero no en todos los casos.

## 29. Capacitación y experiencia de profesionales (versión 1.1)

- **Capacitar** (contador, asesor, abogado, gestor): cuesta $700 × (1 + 0,5 × capacitaciones previas); sube la calidad real en (100 − calidad) × 12 % (mín. 1, máx. 98); una vez cada 90 días.
- Cada diciembre, todo profesional contratado suma 1 año de experiencia y (100 − calidad) × 3 % de calidad.

## 30. Ajustes de mercado y habilidades (versión 1.1)

- Reversión de las acciones a su valor justo: 0,15 % diario de la brecha logarítmica (antes 0,4 %). Los precios siguen tendiendo a sus fundamentos, pero más lentamente, lo que hace el mercado más realista y la ventaja de estimar bien más modesta. La estimación del analista a 3 meses usa 10 % de la brecha.
- **Bolsa de valores** (habilidad): reduce hasta 40 % el diferencial e impacto de mercado de tus órdenes (−0,4 % por nivel).
- **Marketing** (habilidad): +0,4 % de conocimiento de marca por nivel en las campañas de tus empresas (máx. +40 %).
- Mercado inmobiliario: siempre hay al menos dos publicaciones de hasta $90.000 (monoambientes de 22–38 m² en las zonas más baratas).
