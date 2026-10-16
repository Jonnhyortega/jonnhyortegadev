// Firma de la cookie de retorno al panel. Usa Web Crypto para funcionar igual en
// Node y en el runtime de la middleware de Vercel (sin dependencias de Node).
const TTL_MS = 120_000;
const encoder = new TextEncoder();

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  if (!/^[A-Za-z0-9_-]+$/.test(text)) return null;
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  try {
    return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function importKey(secret, usages) {
  return globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages,
  );
}

// Valor de la cookie: `${expiresAtMs}.${firma}`.
export async function signPanelReturn(secret, expiresAtMs) {
  const key = await importKey(secret, ['sign']);
  const sig = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(String(expiresAtMs)));
  return `${expiresAtMs}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyPanelReturn(secret, value, nowMs) {
  if (typeof secret !== 'string' || secret === '' || typeof value !== 'string') return false;
  const match = /^(\d{1,15})\.([A-Za-z0-9_-]+)$/.exec(value);
  if (!match) return false;
  const expiresAtMs = Number(match[1]);
  // Vencida, o con una fecha más lejana de lo que el callback pudo emitir.
  if (expiresAtMs <= nowMs || expiresAtMs > nowMs + TTL_MS) return false;
  const sig = fromBase64Url(match[2]);
  if (!sig) return false;
  const key = await importKey(secret, ['verify']);
  return globalThis.crypto.subtle.verify('HMAC', key, sig, encoder.encode(match[1]));
}

export const PANEL_RETURN_TTL_MS = TTL_MS;
