import { HttpError } from '../lib/errors.js';
import { consume } from '../services/rateLimit.js';

// Limita peticiones por clave (p. ej. IP hasheada o sesión) con estado en Postgres.
export function rateLimit({ db, now, name, limit, windowMs, keyFrom }) {
  return async (req, res, next) => {
    try {
      const result = await consume(db, {
        key: `${name}:${keyFrom(req)}`,
        limit,
        windowMs,
        now: now(),
      });
      if (!result.allowed) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
        throw new HttpError(429, 'rate_limited');
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
