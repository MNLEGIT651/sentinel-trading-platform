import { Router, type Request, type Response } from 'express';
import type { Orchestrator } from '../orchestrator.js';
import { getLockManager } from '../lock-manager.js';
import { getNextCycleAt } from '../scheduler.js';
import { isRunning, CYCLE_LOCK_NAME } from '../server.js';
import { logger } from '../logger.js';

export function orchestratorRouter(orchestrator: Orchestrator): Router {
  const router = Router();

  router.get('/status', async (_req: Request, res: Response) => {
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

  router.post('/cycle', async (_req: Request, res: Response): Promise<void> => {
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

  router.post('/halt', (_req: Request, res: Response) => {
    void orchestrator.halt('Manual halt via dashboard');
    res.json({ halted: true, message: 'Trading halted' });
  });

  router.post('/resume', (_req: Request, res: Response) => {
    void orchestrator.resume();
    res.json({ halted: false, message: 'Trading resumed' });
  });

  return router;
}
