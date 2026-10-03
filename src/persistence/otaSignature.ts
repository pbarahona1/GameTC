import KEYS from './ota-keys.json';

/**
 * FIRMA DE LAS ACTUALIZACIONES POR INTERNET.
 *
 * El manifiesto publicado es un sobre firmado:
 *   { format: 'urt-ota-signed', keyId, payload, signature }
 * - payload: el manifiesto (JSON) codificado en base64. Se firma ese texto exacto,
 *   así no hay ambigüedad de serialización.
 * - signature: ECDSA P-256 con SHA-256, formato IEEE P1363 (r‖s, 64 bytes), en base64.
 * - keyId: qué clave pública embebida en la app la verifica (permite rotarla).
 *
 * El manifiesto incluye la huella SHA-256 y el tamaño del archivo de la versión, así
 * que la firma protege también el archivo. Sin firma válida no se instala nada.
 */
export const OTA_SIGNED_FORMAT = 'urt-ota-signed';
export const OTA_PUBLIC_KEYS: Readonly<Record<string, string>> = KEYS.keys;

export interface SignedManifest {
  format: typeof OTA_SIGNED_FORMAT;
  keyId: string;
  payload: string;
  signature: string;
}

export type VerifyResult = { ok: true; manifest: unknown; keyId: string } | { ok: false; error: string };

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Verifica el sobre firmado y devuelve el manifiesto que contiene. */
export async function verifySignedManifest(doc: unknown, keys: Readonly<Record<string, string>> = OTA_PUBLIC_KEYS): Promise<VerifyResult> {
  const d = doc as Partial<SignedManifest> | null;
  if (!d || d.format !== OTA_SIGNED_FORMAT || typeof d.payload !== 'string' || typeof d.signature !== 'string' || typeof d.keyId !== 'string') {
    return { ok: false, error: 'El manifiesto de actualización no está firmado.' };
  }
  const spki = keys[d.keyId];
  if (!spki) return { ok: false, error: 'El manifiesto está firmado con una clave desconocida.' };
  try {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle) return { ok: false, error: 'Este dispositivo no puede verificar firmas.' };
    const key = await subtle.importKey('spki', fromB64(spki), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const payload = fromB64(d.payload);
    const sig = fromB64(d.signature);
    if (sig.length !== 64) return { ok: false, error: 'La firma del manifiesto no tiene el formato esperado.' };
    const valid = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, payload);
    if (!valid) return { ok: false, error: 'La firma del manifiesto no es válida: se ignoró la actualización.' };
    return { ok: true, manifest: JSON.parse(new TextDecoder().decode(payload)), keyId: d.keyId };
  } catch {
    return { ok: false, error: 'No se pudo verificar la firma del manifiesto.' };
  }
}
