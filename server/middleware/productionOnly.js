import { NotFoundError } from '../lib/errors.js';

// Fuera de producción las rutas protegidas no existen (404 genérico).
export function productionOnly(env) {
  return (req, res, next) => {
    if (!env.isProduction) return next(new NotFoundError());
    next();
  };
}
