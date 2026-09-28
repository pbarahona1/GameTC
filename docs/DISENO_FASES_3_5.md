# Diseño técnico — Fases 3, 4 y 5

Decisiones que guían la implementación (se mantiene actualizado).

## Principios
- Un solo núcleo contable (`ledger/core.ts`). Libro personal + un libro por empresa. Nada cambia saldos fuera de `post()`/`coPost()`.
- Todo subregistro (acciones, bonos, fondos, Mogul, inmuebles, hipotecas, multas, préstamos intragrupo) tiene invariante de conciliación en `invariants.ts`.
- `SAVE_VERSION = 3` (migración 2→3 crea todas las secciones nuevas).

## Valuación personal
- Inversiones personales (acciones, bonos, fondos, Mogul, inmuebles) se llevan a **valor razonable**.
- Revaluación: diaria para títulos (un asiento por día como máximo, solo si hay cambio), mensual para inmuebles (tasación).
- Revaluación → cuenta de ingreso `unrealized_gains` (no tributa).
- Venta: 1) se revierte la revaluación acumulada de la porción vendida (vuelve a costo), 2) se registra `realized_gains` = precio bruto − costo. Comisiones → `brokerage_fees`.
- Base de ganancia de capital = ganancias realizadas − comisiones de títulos del año (subregistro `ytd`).
- Empresas: inmuebles al costo menos depreciación (modelo de costo), coherente con su libro.

## Jurisdicciones
- `tax.jurisdiction` (residencia personal), cambio efectivo el 1 de enero siguiente.
- Cada empresa tiene `jurisdiction` (impuesto societario, dividendos). Cada inmueble tiene jurisdicción (impuesto inmobiliario, transferencia, recurso hipotecario).

## Macro v2 (mensual)
- Fase del ciclo (expansión, auge, desaceleración, recesión, recuperación) → PIB, desempleo, confianza, costos de proveedores, inflación mensual, tasa (revisión trimestral).
- Eventos aleatorios con efectos y duración.
- Efectos: empleo (probabilidad de oferta, despidos), demanda empresarial, costos de insumos, bolsa, inmuebles, bonos, crédito.

## Grupos
- Holding = empresa con sector `holding` (sin operaciones). `parentId` en subsidiarias.
- La participación de una subsidiaria se registra en la cuenta `subsidiaries` del libro de la matriz (método de participación → `subsidiary_results`, exento).
- `business_equity` personal = Σ carrying de empresas sin matriz.
- Consolidado: suma de libros del grupo, eliminando inversión en subsidiarias vs patrimonio, préstamos intragrupo y resultados intragrupo; interés minoritario.

## Legal (ficticio)
- `undeclared_cash` (efectivo no declarado) y `illicit_income`. Actos con evidencia, gravedad, testigos y prescripción.
- Sospecha (heat), detección mensual probabilística, auditorías fiscales, denuncias, casos (investigación → imputación → juicio/acuerdo → sentencia), multas por pagar, embargos, prisión ficticia.
- Abogado: revisa, prepara defensa, negocia acuerdo; nunca garantiza absolución (probabilidad acotada 5–95 %).

## Fase 5 (implementado)
- Compactación de libros en baldes mensuales por cuenta y flujo de caja (personal: año en curso + anterior; empresas del jugador: 13 meses; empresas simuladas: 2 meses). Ver `ledger/compaction.ts`.
- Historial de precios: diario 260 días, semanal 520 semanas.
- Guardado comprimido con gzip nativo (`CompressionStream`) + base64 y checksum sobre el contenido original; se descartó LZ-string para no agregar dependencias.
- Deshacer liviano (`snapshot.ts`), división de código, ajustes de accesibilidad, notificaciones, velocidad y dificultad.
