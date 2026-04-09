/**
 * Sentinel Agent HTTP Server — Express app exposing 12 REST endpoints.
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
 *   GET  /agent-runs[?role=...&status=...&limit=20]
 *   GET  /agent-runs/:id
 *   POST /research/ticker
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
import { logger } from './logger.js';
import { getSupabaseClient } from './supabase-client.js';
import { randomUUID } from 'node:crypto';
import { startRecommendationWorkflow } from './workflows/recommendation-lifecycle.js';
import { CORRELATION_HEADER, withCorrelationId } from './correlation.js';

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

  // ── Correlation ID ──────────────────────────────────────────────
  // Extract from incoming header or generate, then run the rest of
  // the request inside an AsyncLocalStorage scope so every logger
  // call and outgoing EngineClient request includes the same ID.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = (req.headers[CORRELATION_HEADER] as string | undefined) ?? randomUUID();
    res.setHeader(CORRELATION_HEADER, id);
    withCorrelationId(() => next(), id);
  });

  // ── Auth (all routes except /health and /status) ─────────────────
  app.use((req: Request, res: Response, next: NextFunction) => {
    const publicPaths = ['/health', '/status'];
    if (publicPaths.includes(req.path)) return next();
    return authMiddleware(req, res, next);
  });

  // ── Health ──────────────────────────────────────────────────────

  app.get('/health', async (_req: Request, res: Response) => {
    const engineConfigured = Boolean(process.env.ENGINE_URL && process.env.ENGINE_API_KEY);
    const supabaseConfigured = Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    // Lightweight connectivity probes (non-blocking, fast timeout)
    let engineReachable = false;
    if (engineConfigured) {
      try {
        const resp = await fetch(new URL('/health', process.env.ENGINE_URL!).toString(), {
          headers: { Authorization: `Bearer ${process.env.ENGINE_API_KEY!}` },
          signal: AbortSignal.timeout(3_000),
        });
        engineReachable = resp.ok;
      } catch {
        engineReachable = false;
      }
    }

    let supabaseReachable = false;
    if (supabaseConfigured) {
      try {
        const resp = await fetch(`${process.env.SUPABASE_URL!}/rest/v1/`, {
          headers: {
            apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
            Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          },
          signal: AbortSignal.timeout(3_000),
        });
        supabaseReachable = resp.ok;
      } catch {
        supabaseReachable = false;
      }
    }

    const hasDegraded =
      (engineConfigured && !engineReachable) || (supabaseConfigured && !supabaseReachable);

    res.status(hasDegraded ? 503 : 200).json({
      status: hasDegraded ? 'degraded' : 'ok',
      service: 'sentinel-agents',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      cycleCount: orchestrator.currentState.cycleCount,
      halted: orchestrator.currentState.halted,
      dependencies: {
        engine: engineConfigured
          ? engineReachable
            ? 'connected'
            : 'disconnected'
          : 'not_configured',
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY) ? 'configured' : 'not_configured',
        supabase: supabaseConfigured
          ? supabaseReachable
            ? 'connected'
            : 'disconnected'
          : 'not_configured',
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

  app.post('/cycle', async (_req: Request, res: Response): Promise<void> => {
    if (orchestrator.currentState.halted) {
      res.status(409).json({
        error: 'halted',
        message: 'Trading is halted. Call POST /resume first.',
      });
      return;
    }

    const lockManager = getLockManager();
    const acquired = await lockManager.acquire(CYCLE_LOCK_NAME);
    if (!acquired) {
      res.status(409).json({
        error: 'cycle_in_progress',
        message: 'A cycle is already running. Try again after it completes.',
      });
      return;
    }

    // Fire-and-forget — respond immediately, cycle runs async
    orchestrator
      .runCycle()
      .then(() => {
        return lockManager.release(CYCLE_LOCK_NAME);
      })
      .catch((err: unknown) => {
        logger.error('Unhandled cycle error', {
          error: err instanceof Error ? (err as Error).message : String(err),
        });
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

  app.get(
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
   * 2. Forward to engine → Alpaca.
   * 3. Mark filled or risk_blocked depending on engine response.
   */
  app.post(
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

  app.post(
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

  // ── Alerts ──────────────────────────────────────────────────────

  app.get('/alerts', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const alerts = await listAlerts(50);
      res.json({ alerts });
    } catch (err) {
      next(err);
    }
  });

  // ── Agent Runs ──────────────────────────────────────────────────

  app.get('/agent-runs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const role = req.query.role as string | undefined;
      const status = req.query.status as string | undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

      const db = getSupabaseClient();
      let query = db
        .from('cycle_history')
        .select('id, holder_id, started_at, finished_at, agents_run, outcome, error')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq('outcome', status);
      }
      if (role) {
        query = query.contains('agents_run', [role]);
      }

      const { data, error } = await query;
      if (error) throw new Error(error.message);

      const runs = (data ?? []).map((row) => ({
        id: row.id,
        agents_run: row.agents_run,
        started_at: row.started_at,
        finished_at: row.finished_at,
        status: row.outcome,
        duration_ms: row.finished_at
          ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
          : null,
        error: row.error ?? null,
      }));

      res.json({ runs });
    } catch (err) {
      next(err);
    }
  });

  app.get(
    '/agent-runs/:id',
    async (req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> => {
      try {
        const id = req.params['id'];
        if (!id) {
          res.status(400).json({ error: 'missing_id' });
          return;
        }

        const db = getSupabaseClient();
        const { data: run, error: runError } = await db
          .from('cycle_history')
          .select('id, holder_id, started_at, finished_at, agents_run, outcome, error')
          .eq('id', id)
          .single();

        if (runError || !run) {
          res.status(404).json({ error: 'not_found', message: `Agent run ${id} not found` });
          return;
        }

        // Fetch agent_logs created during this run's time window
        let logsQuery = db
          .from('agent_logs')
          .select(
            'id, agent_name, action, input, output, tokens_used, duration_ms, status, created_at',
          )
          .order('created_at', { ascending: true });

        if (run.started_at) {
          logsQuery = logsQuery.gte('created_at', run.started_at);
        }
        if (run.finished_at) {
          logsQuery = logsQuery.lte('created_at', run.finished_at);
        }

        const { data: logs, error: logsError } = await logsQuery;
        if (logsError) throw new Error(logsError.message);

        res.json({
          run: {
            id: run.id,
            agents_run: run.agents_run,
            started_at: run.started_at,
            finished_at: run.finished_at,
            status: run.outcome,
            duration_ms: run.finished_at
              ? new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()
              : null,
            error: run.error ?? null,
          },
          logs: logs ?? [],
        });
      } catch (err) {
        next(err);
      }
    },
  );

  // ── Research ──────────────────────────────────────────────────────

  app.post(
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

  // ── Global error handler ─────────────────────────────────────────

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('server.unhandled_error', { error: err.message });
    res.status(500).json({ error: 'internal_error', detail: err.message });
  });

  return app;
}
