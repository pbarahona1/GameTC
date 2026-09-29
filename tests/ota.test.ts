import { vi } from 'vitest';
import { createHash } from 'node:crypto';

/**
 * Flujo de actualización por internet con los plugins nativos simulados en memoria
 * (Preferences, Filesystem, WebView, App). Verifica la lógica de JavaScript:
 * descarga, verificación, guardado previo, cambio de versión, confirmación y reversión.
 * (El comportamiento del WebView de Android en sí se prueba en el teléfono.)
 */
const mem = {
  prefs: new Map<string, string>(),
  files: new Map<string, string>(),
  basePath: '',
  persisted: '',
  assetReset: 0,
};

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
  WebView: {
    setServerBasePath: async ({ path }: { path: string }) => { mem.basePath = path; },
    getServerBasePath: async () => ({ path: mem.basePath }),
    persistServerBasePath: async () => { mem.persisted = mem.basePath; },
    setServerAssetPath: async () => { mem.assetReset++; mem.basePath = ''; },
  },
}));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: async ({ key }: { key: string }) => ({ value: mem.prefs.get(key) ?? null }),
    set: async ({ key, value }: { key: string; value: string }) => { mem.prefs.set(key, value); },
  },
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Data: 'DATA' },
  Encoding: { UTF8: 'utf8' },
  Filesystem: {
    mkdir: async () => undefined,
    rmdir: async ({ path }: { path: string }) => { for (const k of [...mem.files.keys()]) if (k.startsWith(path)) mem.files.delete(k); },
    writeFile: async ({ path, data }: { path: string; data: string }) => { mem.files.set(path, data); return { uri: `file:///data/app/files/${path}` }; },
    readFile: async ({ path }: { path: string }) => ({ data: mem.files.get(path) ?? '' }),
    readdir: async () => ({ files: [] }),
    getUri: async ({ path }: { path: string }) => ({ uri: `file:///data/app/files/${path}` }),
  },
}));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ version: '1.2.0', build: '5' }) } }));

const HTML = '<!doctype html><html><body><div id="root"></div><script>/* juego */</script></body></html>';
const sha = createHash('sha256').update(HTML).digest('hex');
const manifest = { format: 'urt-ota', version: '9.9.9', build: 99999, minNativeCode: 5, file: 'web-99999.html', sha256: sha, size: Buffer.byteLength(HTML), date: '2026-09-28', notes: ['Novedad de prueba'] };

function mockFetch(body: string, man = manifest) {
  globalThis.fetch = vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes('manifest.json')) return new Response(JSON.stringify(man), { status: 200 });
    return new Response(body, { status: 200, headers: { 'content-length': String(Buffer.byteLength(body)) } });
  }) as unknown as typeof fetch;
}

(globalThis as unknown as { window: EventTarget }).window = new EventTarget();

beforeEach(() => {
  mem.prefs.clear();
  mem.files.clear();
  mem.basePath = '';
  mem.persisted = '';
  mem.assetReset = 0;
  vi.resetModules();
});

describe('Actualizaciones por internet (flujo con plugins simulados)', () => {
  it('encuentra, descarga, verifica, guarda la partida y cambia de versión sin hacerla permanente', async () => {
    mockFetch(HTML);
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    const c = await ota.checkForUpdate(false);
    expect(c.kind).toBe('available');
    let saved = false;
    const err = await ota.applyUpdate(manifest as never, async () => { saved = true; return true; });
    expect(err).toBeNull();
    expect(saved).toBe(true);
    expect(mem.files.get('ota/99999/index.html')).toBe(HTML);
    expect(mem.basePath).toBe('/data/app/files/ota/99999');
    expect(mem.persisted).toBe('');
    const prefs = JSON.parse(mem.prefs.get('urt.ota')!);
    expect(prefs.pending.build).toBe(99999);
    expect(prefs.pending.notes).toEqual(['Novedad de prueba']);
  });

  it('rechaza un archivo alterado y no toca nada', async () => {
    mockFetch(HTML.replace('juego', 'otro'));
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    let saved = false;
    const err = await ota.applyUpdate(manifest as never, async () => { saved = true; return true; });
    expect(err).toMatch(/No se instaló/);
    expect(saved).toBe(false);
    expect(mem.basePath).toBe('');
    expect(mem.prefs.get('urt.ota') ?? '').not.toContain('pending');
  });

  it('si no se pudo guardar la partida antes, no cambia de versión', async () => {
    mockFetch(HTML);
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    const err = await ota.applyUpdate(manifest as never, async () => false);
    expect(err, String(err)).toMatch(/no se pudo guardar la partida/);
    expect(mem.basePath).toBe('');
  });

  it('la versión nueva se confirma sola cuando la partida cargó bien', async () => {
    vi.useFakeTimers();
    const { WEB_BUILD } = await import('../src/version');
    mem.basePath = '/data/app/files/ota/x';
    mem.prefs.set('urt.ota', JSON.stringify({ failed: [], pending: { build: WEB_BUILD, version: 'nueva', path: mem.basePath, prevPath: '', fromVersion: '1.1.0', at: 1, notes: ['a'] } }));
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    expect(ota.otaStore.get().confirmed).toBe(false);
    ota.markHealthy();
    await vi.advanceTimersByTimeAsync(7000);
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));
    expect(mem.persisted).toBe('/data/app/files/ota/x');
    const prefs = JSON.parse(mem.prefs.get('urt.ota')!);
    expect(prefs.pending).toBeUndefined();
    expect(prefs.justUpdated.to).toBeDefined();
    expect(ota.otaStore.get().confirmed).toBe(true);
  });

  it('si la versión nueva no puede leer la partida, vuelve sola a la anterior y la marca como fallida', async () => {
    const { WEB_BUILD } = await import('../src/version');
    mem.basePath = '/data/app/files/ota/x';
    mem.prefs.set('urt.ota', JSON.stringify({ failed: [], pending: { build: WEB_BUILD, version: 'nueva', path: mem.basePath, prevPath: 'public', fromVersion: '1.1.0', at: 1, notes: [] } }));
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    ota.failBoot('no pudo leer la partida');
    await new Promise((r) => setTimeout(r, 20));
    expect(mem.assetReset).toBe(1);
    const prefs = JSON.parse(mem.prefs.get('urt.ota')!);
    expect(prefs.failed).toContain(WEB_BUILD);
    expect(prefs.pending).toBeUndefined();
    expect(mem.persisted).toBe('');
  });

  it('un error de JavaScript antes de confirmarse también vuelve a la versión anterior', async () => {
    const { WEB_BUILD } = await import('../src/version');
    mem.basePath = '/data/app/files/ota/x';
    mem.prefs.set('urt.ota', JSON.stringify({ failed: [], pending: { build: WEB_BUILD, version: 'nueva', path: mem.basePath, prevPath: '/data/app/files/ota/viejo', fromVersion: '1.1.0', at: 1, notes: [] } }));
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    window.dispatchEvent(new Event('error'));
    await new Promise((r) => setTimeout(r, 20));
    expect(mem.basePath).toBe('/data/app/files/ota/viejo');
    expect(JSON.parse(mem.prefs.get('urt.ota')!).failed).toContain(WEB_BUILD);
  });

  it('si arranca la versión vieja con una actualización pendiente, esa actualización falló y no se vuelve a ofrecer sola', async () => {
    mem.prefs.set('urt.ota', JSON.stringify({ failed: [], pending: { build: 99999, version: '9.9.9', path: '/x', prevPath: '', fromVersion: '1.2.0', at: 1, notes: [] } }));
    mockFetch(HTML);
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    expect(JSON.parse(mem.prefs.get('urt.ota')!).failed).toContain(99999);
    expect((await ota.checkForUpdate(false)).kind).toBe('failed-before');
    expect((await ota.checkForUpdate(true)).kind).toBe('available');
  });

  it('una versión que necesita una APK nueva no se instala por internet', async () => {
    mockFetch(HTML, { ...manifest, minNativeCode: 9 });
    const ota = await import('../src/persistence/ota');
    await ota.otaBoot();
    expect((await ota.checkForUpdate(false)).kind).toBe('needs-apk');
  });
});
