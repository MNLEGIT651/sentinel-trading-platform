import { Router, type Request, type Response, type NextFunction } from 'express';
import {
  listRecommendations,
  atomicApprove,
  markFilled,
  markRiskBlocked,
  rejectRecommendation,
  getRecommendation,
} from '../recommendations-store.js';
import { EngineClient } from '../engine-client.js';
import { startRecommendationWorkflow } from '../workflows/recommendation-lifecycle.js';
import { logger } from '../logger.js';

const VALID_REC_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'filled',
  'risk_blocked',
  'all',
] as const;
const VALID_REC_STATUS_SET = new Set<string>(VALID_REC_STATUSES);

export function recommendationsRouter(): Router {
  const router = Router();

  router.get(
    '/recommendations',
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const status = (req.query.status as string) ?? 'pending';
        if (!VALID_REC_STATUS_SET.has(status)) {
          res.status(400).json({
            error: 'invalid_status',
            message: `status must be one of: ${VALID_REC_STATUSES.join(', ')}`,
          });
          return;
        }
        const recommendations = await listRecommendations(status);
        res.json({ recommendations });
      } catch (err) {
        next(err);
      }
    },
  );

  /**
   * Approve a pending recommendation.
   * 1. Atomically claim the row (prevents double-submit).
   * 2. Forward to engine -> Alpaca.
   * 3. Mark filled or risk_blocked depending on engine response.
   */
  router.post(
    '/recommendations/:id/approve',
    async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params['id'];
        if (!id) {
          res.status(400).json({ error: 'missing_id' });
          return;
        }

        const rec = await getRecommendation(id);
        if (!rec) {
          res.status(404).json({ error: 'not_found', message: `Recommendation ${id} not found` });
          return;
        }

        // Atomic claim — returns null if already processed (race-condition safe)
        const claimed = await atomicApprove(id);
        if (!claimed) {
          res.status(409).json({
            error: 'not_pending',
            message: 'Recommendation is not in pending state',
          });
          return;
        }

        // Submit to engine (which routes to Alpaca paper/live)
        const engine = new EngineClient();
        try {
          const orderParams: Parameters<typeof engine.submitOrder>[0] = {
            symbol: rec.ticker,
            side: rec.side,
            order_type: rec.order_type,
            quantity: rec.quantity,
            time_in_force: 'day',
          };
          if (rec.limit_price !== undefined && rec.limit_price !== null) {
            orderParams.limit_price = rec.limit_price;
          }
          const result = await engine.submitOrder(orderParams);

          await markFilled(id, result.order_id);

          res.json({
            orderId: result.order_id,
            status: result.status,
            fill_price: result.fill_price,
          });

          // Fire-and-forget: start durable workflow for order execution
          const workflowParams: Parameters<typeof startRecommendationWorkflow>[0] = {
            recommendationId: id,
            ticker: rec.ticker,
            side: rec.side as 'buy' | 'sell',
            quantity: rec.quantity ?? 0,
          };
          if (rec.limit_price != null) workflowParams.price = rec.limit_price;
          void startRecommendationWorkflow(workflowParams).catch((err) => {
            logger.error('workflow.start.failed', {
              recommendationId: id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        } catch (engineErr: unknown) {
          const msg = engineErr instanceof Error ? engineErr.message : String(engineErr);

          // 422 = engine risk-blocked the order
          if (msg.includes('422') || msg.toLowerCase().includes('risk')) {
            await markRiskBlocked(id, msg);
            res.status(422).json({ error: 'risk_blocked', detail: msg });
            return;
          }

          // Other engine failure — don't permanently mark; return 502 so UI can retry
          res.status(502).json({ error: 'engine_error', detail: msg });
          return;
        }
      } catch (err) {
        next(err);
      }
    },
  );

  router.post(
    '/recommendations/:id/reject',
    async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params['id'];
        if (!id) {
          res.status(400).json({ error: 'missing_id' });
          return;
        }

        const rec = await getRecommendation(id);
        if (!rec) {
          res.status(404).json({ error: 'not_found', message: `Recommendation ${id} not found` });
          return;
        }

        const rejected = await rejectRecommendation(id);
        if (!rejected) {
          res.status(409).json({
            error: 'not_pending',
            message: 'Recommendation is not in pending state',
          });
          return;
        }

        res.json({ status: 'rejected' });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
