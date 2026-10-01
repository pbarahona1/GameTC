import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifySignedManifest, OTA_PUBLIC_KEYS } from '../src/persistence/otaSignature';

const pair = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const keys = { k1: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
const man = { format: 'urt-ota', version: '9.0.0', build: 90000, minNativeCode: 6, file: 'urt-90000.html', sha256: 'a'.repeat(64), size: 1, date: '2026-10-01', notes: [] };

function envelope(payloadObj: object, keyId = 'k1') {
  const payload = Buffer.from(JSON.stringify(payloadObj));
  const signature = sign('sha256', payload, { key: pair.privateKey, dsaEncoding: 'ieee-p1363' });
  return { format: 'urt-ota-signed', keyId, payload: payload.toString('base64'), signature: signature.toString('base64') };
}

describe('Fase 6 · firma de actualizaciones', () => {
  it('lo que firma el CI (Node) lo verifica la app (WebCrypto)', async () => {
    const r = await verifySignedManifest(envelope(man), keys);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest).toEqual(man);
  });

  it('cualquier cambio en el contenido invalida la firma', async () => {
    const env = envelope(man);
    const forged = { ...env, payload: Buffer.from(JSON.stringify({ ...man, sha256: 'b'.repeat(64) })).toString('base64') };
    const r = await verifySignedManifest(forged, keys);
    expect(r.ok).toBe(false);
  });

  it('la clave pública embebida en la app es una clave P-256 válida', async () => {
    const ids = Object.keys(OTA_PUBLIC_KEYS);
    expect(ids.length).toBeGreaterThan(0);
    // Con una firma ajena, el resultado es "no válida" (la clave se pudo importar), no un error de formato.
    const r = await verifySignedManifest(envelope(man, ids[0]));
    expect(r).toEqual({ ok: false, error: 'La firma del manifiesto no es válida: se ignoró la actualización.' });
  });
});
