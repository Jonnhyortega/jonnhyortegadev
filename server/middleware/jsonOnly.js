import { HttpError } from '../lib/errors.js';

export const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// En métodos que escriben, el cuerpo (si lo hay) debe ser application/json.
// Las peticiones sin cuerpo ni Content-Type (p. ej. DELETE, logout) pasan.
export function jsonOnly(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || 'transfer-encoding' in req.headers;
  const hasType = Boolean(req.headers['content-type']);
  if (!hasBody && !hasType) return next();
  if (!req.is('application/json')) return next(new HttpError(415, 'unsupported_media_type'));
  next();
}
