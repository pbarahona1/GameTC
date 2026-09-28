export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export const OK = (message?: string): ActionResult => ({ ok: true, message });
export const FAIL = (error: string): ActionResult => ({ ok: false, error });
