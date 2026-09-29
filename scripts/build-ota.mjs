// Publica la versión web actual como actualización por internet (OTA).
//   npm run ota
// 1. Compila la página única (dist-single/index.html).
// 2. La copia a ota/web-<build>.html y borra las anteriores.
// 3. Escribe ota/manifest.json con versión, tamaño, huella SHA-256 y novedades.
// Después hay que hacer commit y push: la app lee el manifiesto desde GitHub.
import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const changelog = JSON.parse(readFileSync('src/content/changelog.json', 'utf8'));
const [a, b, c] = pkg.version.split(/[.-]/).map((x) => parseInt(x, 10) || 0);
const build = a * 10000 + b * 100 + c;

if (!process.argv.includes('--no-build')) execSync('npm run build:single', { stdio: 'inherit' });
const html = readFileSync('dist-single/index.html');
if (!html.includes('<div id="root">')) throw new Error('dist-single/index.html no parece el juego');
if (!html.toString('utf8').includes(`"${pkg.version}"`)) throw new Error('la página compilada no contiene la versión de package.json');

mkdirSync('ota', { recursive: true });
for (const f of readdirSync('ota')) if (/^web-\d+\.html$/.test(f)) unlinkSync(`ota/${f}`);
const file = `web-${build}.html`;
writeFileSync(`ota/${file}`, html);

const entry = changelog.find((e) => e.version === pkg.version);
const manifest = {
  format: 'urt-ota',
  version: pkg.version,
  build,
  minNativeCode: pkg.otaMinNativeCode ?? 0,
  file,
  sha256: createHash('sha256').update(html).digest('hex'),
  size: html.length,
  date: new Date().toISOString().slice(0, 10),
  notes: entry ? entry.items : [],
};
writeFileSync('ota/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`OTA ${manifest.version} (build ${build}) · ${(html.length / 1024).toFixed(0)} KB · ${manifest.sha256.slice(0, 12)}…`);
