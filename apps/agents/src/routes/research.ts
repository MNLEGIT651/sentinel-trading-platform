import { Router, type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import type { Orchestrator } from '../orchestrator.js';
import { logger } from '../logger.js';

export function researchRouter(orchestrator: Orchestrator): Router {
  const router = Router();

  router.post(
    '/research/ticker',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const { ticker, depth } = req.body as { ticker?: string; depth?: 'quick' | 'full' };

        if (!ticker || typeof ticker !== 'string') {
          res.status(400).json({ error: 'missing_ticker', message: 'ticker is required' });
          return;
        }

        const jobId = randomUUID();
        const resolvedDepth = depth === 'quick' ? 'quick' : 'full';
        const normalizedTicker = ticker.toUpperCase();

        // Fire-and-forget — respond immediately, research runs async
        const prompt =
          resolvedDepth === 'quick'
            ? `Provide a quick summary for ${normalizedTicker}: current price, trend direction, and key levels.`
            : undefined;

        const researchPromise = prompt
          ? orchestrator.runAgent('research', prompt)
          : orchestrator.research(normalizedTicker);

        researchPromise.catch((err: unknown) => {
          logger.error('research.job.failed', {
            jobId,
            ticker: normalizedTicker,
            error: err instanceof Error ? err.message : String(err),
          });
        });

        res.json({
          job_id: jobId,
          status: 'started',
          ticker: normalizedTicker,
          depth: resolvedDepth,
        });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
