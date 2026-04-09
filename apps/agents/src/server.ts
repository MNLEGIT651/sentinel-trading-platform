/**
 * Sentinel Agent HTTP Server — Express app exposing 12 REST endpoints.
 *
 * Endpoints are organized into route modules under ./routes/:
 *   - health.ts:           GET  /health
 *   - orchestrator.ts:     GET  /status, POST /cycle, POST /halt, POST /resume
 *   - recommendations.ts:  GET  /recommendations, POST /:id/approve, POST /:id/reject
 *   - alerts.ts:           GET  /alerts
 *   - agent-runs.ts:       GET  /agent-runs, GET /agent-runs/:id
 *   - research.ts:         POST /research/ticker
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { Orchestrator } from './orchestrator.js';
import { getLockManager } from './lock-manager.js';
import { authMiddleware } from './auth-middleware.js';
import { logger } from './logger.js';
import { randomUUID } from 'node:crypto';
import { CORRELATION_HEADER, withCorrelationId } from './correlation.js';
import {
  healthRouter,
  orchestratorRouter,
  recommendationsRouter,
  alertsRouter,
  agentRunsRouter,
  researchRouter,
} from './routes/index.js';

export const CYCLE_LOCK_NAME = 'agent_cycle';

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

  // ── Route modules ───────────────────────────────────────────────
  app.use(healthRouter(orchestrator));
  app.use(orchestratorRouter(orchestrator));
  app.use(recommendationsRouter());
  app.use(alertsRouter());
  app.use(agentRunsRouter());
  app.use(researchRouter(orchestrator));

  // ── Global error handler ─────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('server.unhandled_error', { error: err.message });
    res.status(500).json({ error: 'internal_error', detail: err.message });
  });

  return app;
}
