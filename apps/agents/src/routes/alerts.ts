import { Router, type Request, type Response, type NextFunction } from 'express';
import { listAlerts } from '../recommendations-store.js';

export function alertsRouter(): Router {
  const router = Router();

  router.get('/alerts', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await listAlerts(50);
      res.json({ alerts });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
