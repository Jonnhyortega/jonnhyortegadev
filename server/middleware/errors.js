import { HttpError, NotFoundError } from '../lib/errors.js';

export function notFoundHandler(req, res, next) {
  next(new NotFoundError());
}

// Mapea errores conocidos a {error: code}; cualquier otro es un 500 genérico.
// Solo se registra requestId y stack: nunca body ni headers.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.code });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'invalid_json' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'payload_too_large' });
  }

  console.error(`[${req.id}]`, err?.stack ?? String(err));
  return res.status(500).json({ error: 'internal_error' });
}
