import { randomUUID } from 'node:crypto';

// Asigna un id por petición (siempre generado aquí, nunca tomado del cliente).
export function requestId(req, res, next) {
  req.id = randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}
