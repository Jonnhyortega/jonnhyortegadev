import { Router } from 'express';
import { productionOnly } from '../../middleware/productionOnly.js';
import { loadSession, requireSession } from '../../middleware/session.js';
import { requireCsrf } from '../../middleware/csrf.js';
import { rateLimit } from '../../middleware/rateLimit.js';
import { createTranslationsRouter } from './translations.js';
import { createThemeRouter } from './theme.js';
import { createProjectsRouter } from './projects.js';
import { SAFE_METHODS } from '../../middleware/jsonOnly.js';

const MIN = 60_000;

// Router de /api/admin. Orden: producción → sesión (full o recovery) → CSRF →
// límite de escrituras → rutas permitidas a recovery → puerta full-only →
// resto. Todo lo que se monte después de la puerta exige sesión `full`.
export function createAdminRouter(deps) {
  const { env, db, now } = deps;
  const router = Router();

  const writeLimit = rateLimit({
    db,
    now,
    name: 'admin-write',
    limit: 60,
    windowMs: MIN,
    keyFrom: (req) => req.session.id,
  });

  router.use(productionOnly(env));
  router.use(loadSession({ db, now }));
  router.use(requireSession('full', 'recovery'));
  router.use(requireCsrf(env));
  router.use((req, res, next) => (SAFE_METHODS.has(req.method) ? next() : writeLimit(req, res, next)));

  router.get('/me', (req, res) => {
    const { kind, csrfSecret, expiresAt } = req.session;
    res.json({ kind, csrfToken: csrfSecret, expiresAt });
  });

  // RUTAS PERMITIDAS A RECOVERY: aquí (y solo aquí) se monta en Task 13
  // `POST /security/recovery-codes`. Ninguna otra ruta va antes de la puerta.

  // Puerta full-only: falla cerrado para cualquier subrouter futuro.
  router.use(requireSession('full'));

  router.use('/translations', createTranslationsRouter(deps));
  router.use('/theme', createThemeRouter(deps));
  router.use('/projects', createProjectsRouter(deps));

  return router;
}
