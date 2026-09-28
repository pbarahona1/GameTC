import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { GLOSSARY_BY_ID, GLOSSARY } from '../src/content/glossary';
import { ACCOUNTS } from '../src/engine/ledger/accounts';
import { JOBS, JOB_BY_ID } from '../src/content/jobs';
import { COURSES } from '../src/content/courses';
import { SKILL_BY_ID } from '../src/content/skills';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('Contenido y ayuda contextual', () => {
  it('todo término referenciado desde el código existe en el glosario', () => {
    const missing = new Set<string>();
    for (const f of files('src').filter((x) => /\.(ts|tsx)$/.test(x))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/term[=:]\s*[{]?\s*['"]([a-z_]+)['"]/g)) if (!GLOSSARY_BY_ID[m[1]]) missing.add(`${m[1]} (${f})`);
    }
    for (const a of Object.values(ACCOUNTS) as Array<{ term?: string }>) if (a.term && !GLOSSARY_BY_ID[a.term]) missing.add(a.term);
    expect([...missing]).toEqual([]);
  });

  it('cada entrada del glosario tiene definición, ejemplo e impacto', () => {
    for (const g of GLOSSARY) {
      expect(g.short.length).toBeGreaterThan(10);
      expect(g.example.length).toBeGreaterThan(10);
      expect(g.impact.length).toBeGreaterThan(10);
    }
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length);
  });

  it('empleos y cursos referencian habilidades y ascensos válidos', () => {
    for (const j of JOBS) {
      if (j.promotesTo) expect(JOB_BY_ID[j.promotesTo]).toBeDefined();
      for (const k of [...j.keySkills, ...Object.keys(j.skillXp), ...Object.keys(j.requires.skills ?? {})]) expect(SKILL_BY_ID[k as keyof typeof SKILL_BY_ID]).toBeDefined();
    }
    for (const c of COURSES) for (const k of Object.keys(c.xp)) expect(SKILL_BY_ID[k as keyof typeof SKILL_BY_ID]).toBeDefined();
  });
});
