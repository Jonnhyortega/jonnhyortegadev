import { HttpError } from '../lib/errors.js';
import { safeEqual } from '../lib/crypto.js';
import { SAFE_METHODS } from './jsonOnly.js';

// Origen de la petición: `Origin` si viene; si no, el origen de `Referer`.
function requestOrigin(req) {
  const origin = req.get('origin');
  if (origin !== undefined) return origin;
  const referer = req.get('referer');
  if (referer === undefined) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}

const isSameOrigin = (req, env) => requestOrigin(req) === env.appOrigin;

// Exige que la petición venga del propio sitio (para rutas sin sesión, como
// la recuperación). Si no → 403 {"error":"forbidden"}.
export function requireSameOrigin(env) {
  return (req, res, next) => {
    if (!isSameOrigin(req, env)) return next(new HttpError(403, 'forbidden'));
    next();
  };
}

// En métodos que escriben exige mismo origen y X-CSRF-Token igual al secreto
// CSRF de la sesión. Cualquier fallo → 403 {"error":"forbidden"}.
export function requireCsrf(env) {
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const sameOrigin = isSameOrigin(req, env);
    const tokenOk = safeEqual(req.get('x-csrf-token'), req.session?.csrfSecret);
    if (!sameOrigin || !tokenOk) return next(new HttpError(403, 'forbidden'));
    next();
  };
}
