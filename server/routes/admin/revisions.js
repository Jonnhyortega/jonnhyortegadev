import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../lib/errors.js';
import { listRevisions, restoreRevision } from '../../services/content.js';
import { auditFor } from './audit.js';

const entitySchema = z.enum(['translations', 'theme', 'projects']);
const uuid = z.string().uuid();

export function createRevisionsRouter(deps) {
  const { db, now } = deps;
  const router = Router();

  router.get('/:entity', async (req, res, next) => {
    try {
      const entity = entitySchema.safeParse(req.params.entity);
      if (!entity.success) throw new NotFoundError();
      const rows = await listRevisions(db, entity.data);
      res.json(rows.map(({ id, createdAt }) => ({ id, createdAt })));
    } catch (err) {
      next(err);
    }
  });

  router.post('/:id/restore', async (req, res, next) => {
    try {
      if (!uuid.safeParse(req.params.id).success) throw new NotFoundError();
      const restored = await restoreRevision(db, {
        id: req.params.id,
        now: now(),
        audit: auditFor(deps, req, 'revision_restored', {}),
      });
      res.json(restored);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
