import { Router } from 'express';
import { getPublicContent } from '../services/content.js';

// Router público de solo lectura. Nunca devuelve 500: si la BD falla, 503 y
// el front cae a los valores por defecto.
export function createContentRouter({ db }) {
  const router = Router();

  router.get('/', async (req, res) => {
    try {
      const content = await getPublicContent(db);
      res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
      res.json(content);
    } catch (error) {
      console.error(`[${req.id}] contenido no disponible:`, error?.message ?? 'error');
      res.set('Cache-Control', 'no-store');
      res.status(503).json({ error: 'unavailable' });
    }
  });

  return router;
}
