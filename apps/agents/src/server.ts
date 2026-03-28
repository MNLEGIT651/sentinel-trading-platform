/**
 * Sentinel Agent HTTP Server — Express app exposing 9 REST endpoints.
 *
 * Endpoints:
 *   GET  /health
 *   GET  /status
 *   POST /cycle
 *   POST /halt
 *   POST /resume
 *   GET  /recommendations[?status=pending|all|approved|filled|rejected|risk_blocked]
 *   POST /recommendations/:id/approve
 *   POST /recommendations/:id/reject
 *   GET  /alerts
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { Orchestrator } from './orchestrator.js';
import {
  listRecommendations,
  atomicApprove,
  markFilled,
  markRiskBlocked,
  rejectRecommendation,
  getRecommendation,
  listAlerts,
} from './recommendations-store.js';
import { EngineClient } from './engine-client.js';
import { getNextCycleAt } from './scheduler.js';
import { getLockManager } from './lock-manager.js';
import { authMiddleware } from './auth-middleware.js';

const CYCLE_LOCK_NAME = 'agent_cycle';

// ── Cycle-in-progress check ────────────────────────────────────────
// Now delegates to the distributed lock manager instead of a module-level flag.

export async function isRunning(): Promise<boolean> {
  return getLockManager().isHeld(CYCLE_LOCK_NAME);
}

// ── App factory ────────────────────────────────────────────────────

export function createApp(orchestrator: Orchestrator): Express {
  const app = express();
  const webOrigins = (process.env.WEB_URL ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin: webOrigins,
      methods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
  app.use(express.json());

  // ── Auth (all routes except /health and /status) ─────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const publicPaths = ['/health', '/status'];
    if (publicPaths.includes(req.path)) return next();
    return authMiddleware(req, res, next);
  });

  // ── Health ──────────────────────────────────────────────────────

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      cycleCount: orchestrator.currentState.cycleCount,
      halted: orchestrator.currentState.halted,
      dependencies: {
        engine: Boolean(process.env.ENGINE_URL && process.env.ENGINE_API_KEY),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        supabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    });
  });

  // ── Status ──────────────────────────────────────────────────────

  app.get('/status', async (_req: Request, res: Response) => {
    const state = orchestrator.currentState;

    const agentStatus: Record<string, { status: string; lastRun: string | null }> = {};
    for (const [role, status] of Object.entries(state.agents)) {
      agentStatus[role] = {
        status,
        lastRun: state.lastRun[role as keyof typeof state.lastRun],
      };
    }

    const running = await isRunning();

    res.json({
      agents: agentStatus,
      cycleCount: state.cycleCount,
      halted: state.halted,
      isRunning: running,
      nextCycleAt: getNextCycleAt(),
      lastCycleAt: state.lastCycleAt,
    });
  });

  // ── Cycle control ───────────────────────────────────────────────

  app.post('/cycle', async (_req: Request, res: Response) => {
    if (orchestrator.currentState.halted) {
      return res.status(409).json({
        error: 'halted',
        message: 'Trading is halted. Call POST /resume first.',
      });
    }

    const lockManager = getLockManager();
    const acquired = await lockManager.acquire(CYCLE_LOCK_NAME);
    if (!acquired) {
      return res.status(409).json({
        error: 'cycle_in_progress',
        message: 'A cycle is already running. Try again after it completes.',
      });
    }

    // Fire-and-forget — respond immediately, cycle runs async
    orchestrator
      .runCycle()
      .then(() => {
        return lockManager.release(CYCLE_LOCK_NAME);
      })
      .catch((err: unknown) => {
        console.error('[Server] Unhandled cycle error:', err);
        return lockManager.release(CYCLE_LOCK_NAME);
      });

    res.json({ started: true, message: 'Agent cycle started' });
  });

  app.post('/halt', (_req: Request, res: Response) => {
    void orchestrator.halt('Manual halt via dashboard');
    res.json({ halted: true, message: 'Trading halted' });
  });

  app.post('/resume', (_req: Request, res: Response) => {
    void orchestrator.resume();
    res.json({ halted: false, message: 'Trading resumed' });
  });

  // ── Recommendations ─────────────────────────────────────────────

  const VALID_REC_STATUSES = [
    'pending',
    'approved',
    'rejected',
    'filled',
    'risk_blocked',
    'all',
  ] as const;
  const VALID_REC_STATUS_SET = new Set<string>(VALID_REC_STATUSES);

  app.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = (req.query.status as string) ?? 'pending';
      if (!VALID_REC_STATUS_SET.has(status)) {
        return res.status(400).json({
          error: 'invalid_status',
          message: `status must be one of: ${VALID_REC_STATUSES.join(', ')}`,
        });
      }
      const recommendations = await listRecommendations(status);
      res.json({ recommendations });
    } catch (err) {
      next(err);
    }
  });

  /**
   * Approve a pending recommendation.
   * 1. Atomically claim the row (prevents double-submit).
   * 2. Forward to engine → Alpaca.
   * 3. Mark filled or risk_blocked depending on engine response.
   */
  app.post(
    '/recommendations/:id/approve',
    async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const id = req.params['id'];
        if (!id) return res.status(400).json({ error: 'missing_id' });

        const rec = await getRecommendation(id);
        if (!rec) {
          return res
            .status(404)
            .json({ error: 'not_found', message: `Recommendation ${id} not found` });
        }

        // Atomic claim — returns null if already processed (race-condition safe)
        const claimed = await atomicApprove(id);
        if (!claimed) {
          return res.status(409).json({
            error: 'not_pending',
            message: 'Recommendation is not in pending state',
          });
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
        } catch (engineErr: unknown) {
          const msg = engineErr instanceof Error ? engineErr.message : String(engineErr);

          // 422 = engine risk-blocked the order
          if (msg.includes('422') || msg.toLowerCase().includes('risk')) {
            await markRiskBlocked(id, msg);
            return res.status(422).json({ error: 'risk_blocked', detail: msg });
          }

          // Other engine failure — don't permanently mark; return 502 so UI can retry
          return res.status(502).json({ error: 'engine_error', detail: msg });
        }
      } catch (err) {
        next(err);
      }
    },
  );

  app.post(
    '/recommendations/:id/reject',
    async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
      try {
        const id = req.params['id'];
        if (!id) return res.status(400).json({ error: 'missing_id' });

        const rec = await getRecommendation(id);
        if (!rec) {
          return res
            .status(404)
            .json({ error: 'not_found', message: `Recommendation ${id} not found` });
        }

        const rejected = await rejectRecommendation(id);
        if (!rejected) {
          return res.status(409).json({
            error: 'not_pending',
            message: 'Recommendation is not in pending state',
          });
        }

        res.json({ status: 'rejected' });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Alerts ──────────────────────────────────────────────────────

  app.get('/alerts', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await listAlerts(50);
      res.json({ alerts });
    } catch (err) {
      next(err);
    }
  });

  // ── Global error handler ─────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Server] Unhandled error:', err.message);
    res.status(500).json({ error: 'internal_error', detail: err.message });
  });

  return app;
}
