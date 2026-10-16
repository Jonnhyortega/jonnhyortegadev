import express from 'express';
import { requestId } from './middleware/requestId.js';
import { security } from './middleware/security.js';
import { jsonOnly } from './middleware/jsonOnly.js';
import { notFoundHandler, errorHandler } from './middleware/errors.js';
import { createAdminRouter } from './routes/admin/index.js';
import { createAuthRouter } from './routes/auth.js';
import { createContentRouter } from './routes/content.js';

// `testRoutes` es un Router que existe SOLO para tests (se monta antes del
// 404). `api/index.js` nunca lo pasa.
export function createApp({ env, db, google, now = () => new Date() }, { testRoutes } = {}) {
  const app = express();
  const deps = { env, db, google, now };

  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(requestId);
  app.use(security());
  app.use(express.json({ limit: '64kb', type: 'application/json' }));
  app.use(jsonOnly);

  mountApiRoutes(app, deps);
  if (testRoutes) app.use(testRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

// Los routers de cada módulo se montan aquí.
function mountApiRoutes(app, deps) {
  // Público: funciona en cualquier entorno (sin productionOnly).
  app.use('/api/content', createContentRouter(deps));
  app.use('/api/auth', createAuthRouter(deps));
  app.use('/api/admin', createAdminRouter(deps));
}
