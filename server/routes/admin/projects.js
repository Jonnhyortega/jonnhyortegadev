import { Router } from 'express';
import { z } from 'zod';
import { NotFoundError } from '../../lib/errors.js';
import { validate } from '../../middleware/validate.js';
import { projectInputSchema, withVersion } from '../../schemas/projects.js';
import {
  createProject,
  deleteProject,
  listProjects,
  reorderProjects,
  updateProject,
} from '../../services/content.js';
import { auditFor } from './audit.js';

const orderSchema = z.object({ ids: z.array(z.string().uuid()).max(50) }).strict();
const uuid = z.string().uuid();

export function createProjectsRouter(deps) {
  const { db, now } = deps;
  const router = Router();
  const audit = (req, action) =>
    auditFor(deps, req, 'content_updated', { entity: 'projects', action });

  // Un id que no es UUID es un 404 genérico (no filtra la estructura).
  router.param('id', (req, res, next, id) => {
    if (!uuid.safeParse(id).success) return next(new NotFoundError());
    next();
  });

  router.get('/', async (req, res, next) => {
    try {
      res.json(await listProjects(db));
    } catch (err) {
      next(err);
    }
  });

  router.post('/', validate(projectInputSchema), async (req, res, next) => {
    try {
      const created = await createProject(db, {
        data: req.body,
        now: now(),
        audit: audit(req, 'create'),
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  // Debe ir antes de `/:id` (R6).
  router.put('/order', validate(orderSchema), async (req, res, next) => {
    try {
      const ordered = await reorderProjects(db, req.body.ids, {
        now: now(),
        audit: audit(req, 'reorder'),
      });
      res.json(ordered);
    } catch (err) {
      next(err);
    }
  });

  router.put('/:id', validate(withVersion(projectInputSchema)), async (req, res, next) => {
    try {
      const { data, version } = req.body;
      const updated = await updateProject(db, req.params.id, {
        data,
        version,
        now: now(),
        audit: audit(req, 'update'),
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await deleteProject(db, req.params.id, { now: now(), audit: audit(req, 'delete') });
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
