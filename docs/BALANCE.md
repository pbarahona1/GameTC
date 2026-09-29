# Balance por estilo de juego (bots)

Generado con `URT_BOTS=1 npx vitest run tests/balance.test.ts` · 15 años de juego · 3 semillas por combinación.

Días de juego (mediana) hasta alcanzar cada etapa. "—" = no la alcanzó en el período.

| Estilo | Origen | E2 | E3 | E4 | E5 | E6 | E7 | Patrimonio final (mediana) | Quiebras | Atrasos |
|---|---|---|---|---|---|---|---|---|---|---|
| ejecutivo | egresado | 30 | 850 | 973 | 1672 | 2799 | — | $727,727 | 0 | 0 |
| ejecutivo | tecnico | 30 | 211 | 545 | 1368 | 2311 | — | $622,200 | 0 | 0 |
| ejecutivo | autodidacta | 30 | 58 | 607 | 1368 | 2464 | — | $632,521 | 0 | 0 |
| ejecutivo | herencia | 30 | 58 | 58 | 1580 | 3376 | — | $424,203 | 0 | 6 |
| inversionista | egresado | 30 | 576 | 973 | 1641 | 2434 | — | $639,481 | 0 | 0 |
| inversionista | tecnico | 30 | 58 | 395 | 1641 | 3225 | — | $469,088 | 0 | 7 |
| inversionista | autodidacta | 30 | 58 | 515 | 1095 | 1856 | — | $1,005,799 | 0 | 0 |
| inversionista | herencia | 30 | 58 | 58 | 1519 | 2676 | — | $574,299 | 0 | 0 |
| inmobiliario | egresado | 30 | 515 | 1185 | 1733 | 2799 | — | $459,006 | 0 | 3 |
| inmobiliario | tecnico | 30 | 58 | 637 | 1519 | 2556 | — | $537,881 | 0 | 1 |
| inmobiliario | autodidacta | 30 | 58 | 637 | 1276 | 2221 | — | $649,547 | 0 | 0 |
| inmobiliario | herencia | 30 | 58 | 58 | 2159 | 3742 | — | $313,294 | 0 | 0 |
| emprendedor | egresado | 30 | 180 | 1672 | 1733 | 2190 | 5386 | $1,049,766 | 0 | 0 |
| emprendedor | tecnico | 30 | 119 | 1276 | 1399 | 1884 | 4747 | $1,315,508 | 0 | 0 |
| emprendedor | autodidacta | 30 | 58 | 1154 | 1276 | 1794 | 4716 | $1,259,735 | 1 | 1 |
| emprendedor | herencia | 30 | 58 | 2311 | 2311 | 3102 | 5356 | $1,052,935 | 0 | 0 |

Etapas: E2 Ingreso estable · E3 Primeros ahorros · E4 Primeras inversiones · E5 Patrimonio sólido · E6 Empresario emergente · E7 Magnate regional.

## Qué hacen los bots

- Todos: buscan el empleo mejor pago cuyos requisitos cumplen (hasta 3 postulaciones), estudian para el puesto que quieren (cursos que dan XP en lo que les falta y títulos si piden educación), guardan una reserva de 3–4 meses, pagan la tarjeta completa y se compran ropa de oficina.
- Ejecutivo: invierte más en formación y la mitad del excedente en el fondo índice.
- Inversionista: todo el excedente al fondo índice.
- Inmobiliario: compra el inmueble más barato con rendimiento bruto ≥ 5,5 % (al contado o con hipoteca del 70 %).
- Emprendedor: cuando junta el capital recomendado + 6 meses de costos, funda una SRL y contrata un gerente con delegación.

## Ajustes de balance de la versión 1.2 (a partir de estas mediciones)

- Inmuebles de entrada: siempre hay a la venta al menos una cochera (≤ $26.000) y un estudio (≤ $60.000), además de 3 opciones ≤ $90.000. Antes lo más barato solía estar en cientos de miles.
- Hipoteca mínima de $15.000: las cocheras y estudios baratos se compran al contado (evita apalancar compras chicas).
- Holding: sin subsidiarias cuesta ~$135/mes (antes ~$750) y cada subsidiaria suma ~$180; aviso claro al crearla y alerta del Asesor si queda vacía.
- Etapa 4: cuentan también inmuebles y cuentas con gestor como inversión (el estilo inmobiliario se trababa).
- Etapa 6: la parte de las ganancias de tus empresas cuenta como ingreso pasivo (el emprendedor tardaba 12–14 años; ahora 5–8).
- Etapa 10: ahora se puede alcanzar (empresas o inmuebles en 2 jurisdicciones).
- Ningún estilo tarda más de 1 año y medio en salir de la supervivencia (prueba automática).
