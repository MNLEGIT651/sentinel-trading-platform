import { Router, type Request, type Response } from 'express';
import type { Orchestrator } from '../orchestrator.js';

export function healthRouter(orchestrator: Orchestrator): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response) => {
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

  return router;
}
