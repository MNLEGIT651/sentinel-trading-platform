/**
 * Sentinel Agent Orchestrator — Entry point.
 *
 * Boots:
 *  1. Express HTTP server on AGENTS_PORT (default 3001)
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

import 'dotenv/config';
import { Orchestrator } from './orchestrator.js';
import { createApp, isRunning } from './server.js';
import { startScheduler } from './scheduler.js';

// Re-export public API for consumers that import this package
export { Agent } from './agent.js';
export { Orchestrator } from './orchestrator.js';
export { ToolExecutor } from './tool-executor.js';
export { EngineClient } from './engine-client.js';
export * from './types.js';

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const port = parseInt(process.env.AGENTS_PORT ?? '3001', 10);

  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║        SENTINEL AGENT ORCHESTRATOR v1.0.0        ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Agents:                                          ║');
  console.log('║   🛰  Market Sentinel    — Market monitoring      ║');
  console.log('║   📊  Strategy Analyst   — Signal generation      ║');
  console.log('║   🛡  Risk Monitor       — Risk enforcement       ║');
  console.log('║   🔬  Research           — Deep analysis          ║');
  console.log('║   ⚡  Execution Monitor  — Trade recommendations  ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  const required: Record<string, string | undefined> = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    ENGINE_URL: process.env.ENGINE_URL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}. See .env.example.`);
    process.exit(1);
  }

  const orchestrator = new Orchestrator(apiKey !== undefined ? { apiKey } : {});

  // ── HTTP server ────────────────────────────────────────────────
  const app = createApp(orchestrator);
  const server = app.listen(port, () => {
    console.log(`\n[Server] Agents server running → http://localhost:${port}`);
    console.log(`[Server] Endpoints: GET /health /status /recommendations /alerts`);
    console.log(`[Server]            POST /cycle /halt /resume`);
    console.log(`[Server]            POST /recommendations/:id/approve|reject\n`);
  });

  // ── Scheduler ──────────────────────────────────────────────────
  const schedulerTask = startScheduler(() => orchestrator.runCycle(), {
    isRunning,
    isHalted: () => orchestrator.currentState.halted,
  });

  // ── Graceful shutdown ──────────────────────────────────────────
  const shutdown = (signal: string) => {
    console.log(`\n[Boot] ${signal} received — shutting down gracefully`);
    schedulerTask.stop();
    server.close(() => {
      console.log('[Boot] HTTP server closed. Goodbye.');
      process.exit(0);
    });
    // Force-exit after 60s in case an in-flight cycle does not finish
    setTimeout(() => {
      console.warn('[Boot] Force-exit after 60s shutdown timeout');
      process.exit(1);
    }, 60_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[Boot] Fatal startup error:', err);
  process.exit(1);
});
