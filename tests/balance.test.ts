import { writeFileSync } from 'node:fs';
import { runBot, median, BotStyle, BotResult } from './bots/strategies';
import { STAGES } from '../src/engine/progression/progression';
import type { BackgroundId } from '../src/content/backgrounds';

/**
 * Balance por estilo de juego. En la integración continua corre una versión corta
 * (asegura que ningún estilo quede trabado al principio). Con URT_BOTS=1 corre la
 * versión completa y escribe docs/BALANCE.md.
 */
const FULL = !!process.env.URT_BOTS;
const STYLES: BotStyle[] = ['ejecutivo', 'inversionista', 'inmobiliario', 'emprendedor'];
const BGS: BackgroundId[] = FULL ? ['egresado', 'tecnico', 'autodidacta', 'herencia'] : ['egresado', 'herencia'];
const SEEDS = FULL ? ['b1', 'b2', 'b3'] : ['b1'];
const YEARS = FULL ? 15 : 4;

describe('Balance · bots por estilo de juego', () => {
  const results: BotResult[] = [];
  for (const style of STYLES) for (const bg of BGS) for (const seed of SEEDS) {
    it(`${style} · ${bg} · ${seed}`, () => {
      const r = runBot(style, bg, `${seed}-${style}-${bg}`, YEARS);
      results.push(r);
      // Todos salen de la supervivencia (etapa 2+) en menos de un año y medio.
      expect(r.stageDays[2] ?? Infinity).toBeLessThan(540);
      expect(r.finalNetWorth).toBeGreaterThan(0);
    });
  }
  afterAll(() => {
    if (!FULL) return;
    const lines: string[] = ['# Balance por estilo de juego (bots)', '', `Generado con \`URT_BOTS=1 npx vitest run tests/balance.test.ts\` · ${YEARS} años de juego · ${SEEDS.length} semillas por combinación.`, '',
      'Días de juego (mediana) hasta alcanzar cada etapa. "—" = no la alcanzó en el período.', ''];
    const head = ['Estilo', 'Origen', ...[2, 3, 4, 5, 6, 7].map((n) => `E${n}`), 'Patrimonio final (mediana)', 'Quiebras', 'Atrasos'];
    lines.push(`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`);
    for (const style of STYLES) for (const bg of BGS) {
      const rs = results.filter((r) => r.style === style && r.background === bg);
      const cells = [2, 3, 4, 5, 6, 7].map((n) => {
        const reached = rs.map((r) => r.stageDays[n]).filter((d): d is number => d !== undefined);
        return reached.length * 2 >= rs.length ? String(median(reached)) : '—';
      });
      const nw = median(rs.map((r) => r.finalNetWorth)) ?? 0;
      lines.push(`| ${style} | ${bg} | ${cells.join(' | ')} | $${Math.round(nw / 100).toLocaleString('en-US')} | ${rs.reduce((a, r) => a + r.bankruptcies, 0)} | ${rs.reduce((a, r) => a + r.arrearsEvents, 0)} |`);
    }
    lines.push('', 'Etapas: ' + STAGES.slice(1, 7).map((s) => `E${s.n} ${s.name}`).join(' · ') + '.');
    lines.push('', '## Qué hacen los bots', '',
      '- Todos: buscan el empleo mejor pago cuyos requisitos cumplen (hasta 3 postulaciones), estudian para el puesto que quieren (cursos que dan XP en lo que les falta y títulos si piden educación), guardan una reserva de 3–4 meses, pagan la tarjeta completa y se compran ropa de oficina.',
      '- Ejecutivo: invierte más en formación y la mitad del excedente en el fondo índice.',
      '- Inversionista: todo el excedente al fondo índice.',
      '- Inmobiliario: compra el inmueble más barato con rendimiento bruto ≥ 5,5 % (al contado o con hipoteca del 70 %).',
      '- Emprendedor: cuando junta el capital recomendado + 6 meses de costos, funda una SRL y contrata un gerente con delegación.',
      '', '## Ajustes de balance de la versión 1.2 (a partir de estas mediciones)', '',
      '- Inmuebles de entrada: siempre hay a la venta al menos una cochera (≤ $26.000) y un estudio (≤ $60.000), además de 3 opciones ≤ $90.000. Antes lo más barato solía estar en cientos de miles.',
      '- Hipoteca mínima de $15.000: las cocheras y estudios baratos se compran al contado (evita apalancar compras chicas).',
      '- Holding: sin subsidiarias cuesta ~$135/mes (antes ~$750) y cada subsidiaria suma ~$180; aviso claro al crearla y alerta del Asesor si queda vacía.',
      '- Etapa 4: cuentan también inmuebles y cuentas con gestor como inversión (el estilo inmobiliario se trababa).',
      '- Etapa 6: la parte de las ganancias de tus empresas cuenta como ingreso pasivo (el emprendedor tardaba 12–14 años; ahora 5–8).',
      '- Etapa 10: ahora se puede alcanzar (empresas o inmuebles en 2 jurisdicciones).',
      '- Ningún estilo tarda más de 1 año y medio en salir de la supervivencia (prueba automática).');
    writeFileSync('docs/BALANCE.md', lines.join('\n') + '\n');
  });
});
