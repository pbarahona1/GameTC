/** CLI de scripts/legalPages.ts: genera docs/legal/ (falla si faltan nombre o correo). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { legalReady } from '../src/content/legal';
import { renderLegalPage } from './legalPages';
if (!legalReady()) {
  console.error('Faltan LEGAL.developer o LEGAL.contact en src/content/legal.ts: Google Play exige un contacto real en la política de privacidad.');
  process.exit(1);
}
mkdirSync('docs/legal', { recursive: true });
writeFileSync('docs/legal/privacidad.html', renderLegalPage('privacy'));
writeFileSync('docs/legal/terminos.html', renderLegalPage('terms'));
console.log('Generadas docs/legal/privacidad.html y docs/legal/terminos.html');
