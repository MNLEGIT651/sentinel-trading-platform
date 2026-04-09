import { Router, type Request, type Response, type NextFunction } from 'express';
import { listAlerts } from '../recommendations-store.js';

export function alertsRouter(): Router {
  const router = Router();

  router.get('/alerts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rawLimit = parseInt(req.query.limit as string, 10);
      const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 100) : 50;
      const lastCreatedAt = req.query.lastCreatedAt as string | undefined;
      const lastId = req.query.lastId as string | undefined;

      // Both cursor fields are required together
      if ((lastCreatedAt && !lastId) || (!lastCreatedAt && lastId)) {
        res
          .status(400)
          .json({ error: 'Both lastCreatedAt and lastId are required for cursor pagination.' });
        return;
      }

      const cursor = lastCreatedAt && lastId ? { lastCreatedAt, lastId } : undefined;
      const page = await listAlerts(limit, cursor);
      res.json(page);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
