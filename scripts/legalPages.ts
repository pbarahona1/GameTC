/**
 * Genera las páginas públicas de privacidad y términos (docs/legal/) desde
 * src/content/legal.ts, la misma fuente que usa la app. Con GitHub Pages activado
 * (rama main, carpeta /docs) quedan en:
 *   https://pbarahona12.github.io/gametc/legal/privacidad.html
 *   https://pbarahona12.github.io/gametc/legal/terminos.html
 * Uso: npm run legal (scripts/legal.ts).
 */
import { LEGAL, PRIVACY, TERMS, LICENSES, type LegalSection } from '../src/content/legal';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderLegalPage(kind: 'privacy' | 'terms'): string {
  const title = kind === 'privacy' ? `Política de privacidad · ${LEGAL.app}` : `Términos y condiciones · ${LEGAL.app}`;
  const sections: LegalSection[] = kind === 'privacy' ? PRIVACY : TERMS;
  const body = sections.map((s) => `<h2>${esc(s.title)}</h2>\n${s.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('\n')}`).join('\n');
  const licenses = kind === 'terms'
    ? `<h2>Licencias de terceros</h2>\n<ul>${LICENSES.map((l) => `<li>${esc(l.name)} — ${esc(l.license)} — <a href="${esc(l.url)}">${esc(l.url)}</a></li>`).join('')}</ul>`
    : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root { color-scheme: light dark; --bg: #f6f7f4; --fg: #171b21; --muted: #5d6671; --accent: #856419; }
@media (prefers-color-scheme: dark) { :root { --bg: #0e1216; --fg: #ebe7dd; --muted: #9aa3ad; --accent: #d2a94f; } }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
main { max-width: 720px; margin: 0 auto; padding: 32px 16px 48px; }
h1 { font-size: 1.6rem; line-height: 1.25; margin: 0 0 4px; }
h2 { font-size: 1.1rem; margin: 28px 0 6px; color: var(--accent); }
p, li { margin: 0 0 10px; }
.meta { color: var(--muted); font-size: 0.9rem; }
a { color: var(--accent); }
</style>
</head>
<body>
<main>
<h1>${esc(kind === 'privacy' ? 'Política de privacidad' : 'Términos y condiciones')}</h1>
<p class="meta">${esc(LEGAL.app)} (${esc(LEGAL.packageId)}) · ${esc(LEGAL.developer)} · actualizado el ${esc(LEGAL.updated)}</p>
${body}
${licenses}
<p class="meta">Contacto: <a href="mailto:${esc(LEGAL.contact)}">${esc(LEGAL.contact)}</a> · <a href="${kind === 'privacy' ? 'terminos.html' : 'privacidad.html'}">${kind === 'privacy' ? 'Términos y condiciones' : 'Política de privacidad'}</a></p>
</main>
</body>
</html>
`;
}

