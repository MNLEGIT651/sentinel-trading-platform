/**
 * Sentinel Agent Orchestrator — Entry point.
 *
 * Boots:
 *  1. Express HTTP server on PORT or AGENTS_PORT (default 3001)
 *  2. Market-hours cron scheduler (every 15 min, NYSE hours only)
 *  3. Graceful SIGTERM / SIGINT shutdown
 *
 * Agents:
 *  🛰  Market Sentinel    — Market monitoring
 *  📊  Strategy Analyst   — Signal generation
 *  🛡  Risk Monitor       — Risk enforcement
 *  🔬  Research           — Deep analysis
 *  ⚡  Execution Monitor  — Trade recommendations
 */

import { Orchestrator } from './orchestrator.js';
import { createApp, isRunning } from './server.js';
import { startScheduler } from './scheduler.js';
import { AGENTS_ENV_GUIDANCE, REQUIRED_AGENT_ENV_VARS, getMissingAgentEnvVars } from './env.js';
import { logger } from './logger.js';
import { getLockManager } from './lock-manager.js';

// Re-export public API for consumers that import this package
export { Agent } from './agent.js';
export { Orchestrator } from './orchestrator.js';
export { ToolExecutor } from './tool-executor.js';
export { EngineClient } from './engine-client.js';
export * from './types.js';

// ─── Required environment variables ──────────────────────────────────────────
//
// All six must be present before the service starts. The check runs before
// any network connections are attempted so misconfigurations fail fast on
// deploy rather than during the first agent cycle.

function validateEnv(): void {
  const missing = getMissingAgentEnvVars();
  if (missing.length > 0) {
    logger.error('boot.env.missing', {
      missing,
      hint: AGENTS_ENV_GUIDANCE,
    });
    process.exit(1);
  }
  logger.info('boot.env.valid', { vars: REQUIRED_AGENT_ENV_VARS.length });
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  logger.info('boot.start', { service: 'sentinel-agents', version: '1.0.0' });

  validateEnv();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const port = parseInt(process.env.PORT ?? process.env.AGENTS_PORT ?? '3001', 10);

  const orchestrator = new Orchestrator(apiKey !== undefined ? { apiKey } : {});

  // ── HTTP server ────────────────────────────────────────────────
  const app = createApp(orchestrator);
  const server = app.listen(port, () => {
    logger.info('boot.server.ready', {
      port,
      endpoints: [
        'GET  /health',
        'GET  /status',
        'GET  /recommendations',
        'GET  /alerts',
        'POST /cycle',
        'POST /halt',
        'POST /resume',
        'POST /recommendations/:id/approve',
        'POST /recommendations/:id/reject',
      ],
    });
  });

  // ── Scheduler ──────────────────────────────────────────────────
  const schedulerTask = startScheduler(() => orchestrator.runCycle(), {
    isRunning,
    isHalted: () => orchestrator.currentState.halted,
  });
  logger.info('boot.scheduler.ready');

  // ── Graceful shutdown ──────────────────────────────────────────
  const shutdown = (signal: string) => {
    logger.info('boot.shutdown.start', { signal });
    schedulerTask.stop();
    getLockManager().shutdown();
    server.close(() => {
      logger.info('boot.shutdown.complete');
      process.exit(0);
    });
    // Force-exit after 60s in case an in-flight cycle does not finish
    setTimeout(() => {
      logger.error('boot.shutdown.timeout', { timeoutMs: 60_000 });
      process.exit(1);
    }, 60_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  logger.info('boot.ready', { port });
}

main().catch((err: unknown) => {
  logger.error('boot.fatal', {
    error: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });
  process.exit(1);
});
