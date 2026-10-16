import { parse } from 'cookie';
import { NotFoundError } from '../lib/errors.js';
import { getSession, SESSION_COOKIE } from '../services/sessions.js';

// Carga la sesión de la cookie en `req.session` (o null si no hay o no es válida).
export function loadSession({ db, now }) {
  return async (req, res, next) => {
    try {
      const header = req.headers.cookie;
      const token = header ? parse(header)[SESSION_COOKIE] : undefined;
      req.session = token ? await getSession(db, { token, now: now() }) : null;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Sin sesión o con un tipo no permitido responde el 404 genérico: no se
// revela que la ruta existe.
export function requireSession(...kinds) {
  return (req, res, next) => {
    if (!req.session || !kinds.includes(req.session.kind)) return next(new NotFoundError());
    next();
  };
}
