import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// Token aleatorio criptográficamente seguro, en base64url.
export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

// Hash con clave de una IP: permite limitar por IP sin guardarla en claro.
export function hmacIp(secret, ip) {
  return createHmac('sha256', secret).update(String(ip)).digest('hex');
}

// Comparación en tiempo constante; false si las longitudes difieren.
export function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
