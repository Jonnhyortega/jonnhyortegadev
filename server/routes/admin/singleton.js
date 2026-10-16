import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { withVersion } from '../../schemas/projects.js';
import { getEntity } from '../../services/content.js';
import { NotFoundError } from '../../lib/errors.js';
import { auditContent } from './audit.js';

// GET/PUT para una entidad de fila única (textos, tema) con control de versión.
export function createSingletonRouter(deps, { entity, schema, write }) {
  const router = Router();

  router.get('/', async (req, res, next) => {
    try {
      const row = await getEntity(deps.db, entity);
      if (!row) throw new NotFoundError();
      res.json(row);
    } catch (err) {
      next(err);
    }
  });

  router.put('/', validate(withVersion(schema)), async (req, res, next) => {
    try {
      const { data, version } = req.body;
      const saved = await write(deps.db, { data, version, now: deps.now() });
      await auditContent(deps, req, 'content_updated', { entity, action: 'update' });
      res.json(saved);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
