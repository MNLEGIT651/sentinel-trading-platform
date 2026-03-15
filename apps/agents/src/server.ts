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

import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
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

// ── Cycle-in-progress flag ─────────────────────────────────────────
// Module-level so the scheduler can also check it.

let _isRunning = false;

export function isRunning(): boolean {
  return _isRunning;
}

// ── App factory ────────────────────────────────────────────────────

export function createApp(orchestrator: Orchestrator): Express {
  const app = express();

  app.use(
    cors({
      origin: process.env.WEB_URL ?? 'http://localhost:3000',
      methods: ['GET', 'POST', 'OPTIONS'],
    }),
  );
  app.use(express.json());

  // ── Health ──────────────────────────────────────────────────────

  app.get('/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      uptime: Math.round(process.uptime()),
      cycleCount: orchestrator.currentState.cycleCount,
      halted: orchestrator.currentState.halted,
    });
  });

  // ── Status ──────────────────────────────────────────────────────

  app.get('/status', (_req: Request, res: Response) => {
    const state = orchestrator.currentState;

    const agentStatus: Record<string, { status: string; lastRun: string | null }> = {};
    for (const [role, status] of Object.entries(state.agents)) {
      agentStatus[role] = {
        status,
        lastRun: state.lastRun[role as keyof typeof state.lastRun],
      };
    }

    res.json({
      agents: agentStatus,
      cycleCount: state.cycleCount,
      halted: state.halted,
      isRunning: _isRunning,
      nextCycleAt: getNextCycleAt(),
      lastCycleAt: state.lastCycleAt,
    });
  });

  // ── Cycle control ───────────────────────────────────────────────

  app.post('/cycle', (_req: Request, res: Response) => {
    if (orchestrator.currentState.halted) {
      return res.status(409).json({
        error: 'halted',
        message: 'Trading is halted. Call POST /resume first.',
      });
    }
    if (_isRunning) {
      return res.status(409).json({
        error: 'cycle_in_progress',
        message: 'A cycle is already running. Try again after it completes.',
      });
    }

    // Fire-and-forget — respond immediately, cycle runs async
    _isRunning = true;
    orchestrator
      .runCycle()
      .then(() => {
        _isRunning = false;
      })
      .catch((err: unknown) => {
        _isRunning = false;
        console.error('[Server] Unhandled cycle error:', err);
      });

    res.json({ started: true, message: 'Agent cycle started' });
  });

  app.post('/halt', (_req: Request, res: Response) => {
    orchestrator.halt('Manual halt via dashboard');
    res.json({ halted: true, message: 'Trading halted' });
  });

  app.post('/resume', (_req: Request, res: Response) => {
    orchestrator.resume();
    res.json({ halted: false, message: 'Trading resumed' });
  });

  // ── Recommendations ─────────────────────────────────────────────

  app.get('/recommendations', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = (req.query.status as string) ?? 'pending';
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
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

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
          const result = await engine.submitOrder({
            symbol: rec.ticker,
            side: rec.side,
            order_type: rec.order_type,
            quantity: rec.quantity,
            limit_price: rec.limit_price ?? undefined,
            time_in_force: 'day',
          });

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
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;

        const rec = await getRecommendation(id);
        if (!rec) {
          return res.status(404).json({ error: 'not_found' });
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
    res.status(500).json({ error: 'internal_error', message: err.message });
  });

  return app;
}
