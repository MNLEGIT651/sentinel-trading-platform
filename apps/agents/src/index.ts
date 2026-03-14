/**
 * Sentinel Agent Orchestrator — Entry point.
 *
 * Launches the 5-agent AI trading system:
 * 1. Market Sentinel — monitors market conditions
 * 2. Strategy Analyst — runs strategies and generates signals
 * 3. Risk Monitor — enforces risk limits and position sizing
 * 4. Research — performs deep analysis on tickers
 * 5. Execution Monitor — manages trade execution
 */

import { Orchestrator } from './orchestrator.js';

export { Agent } from './agent.js';
export { Orchestrator } from './orchestrator.js';
export { ToolExecutor } from './tool-executor.js';
export { EngineClient } from './engine-client.js';
export * from './types.js';

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║        SENTINEL AGENT ORCHESTRATOR v0.1.0        ║');
  console.log('╠═══════════════════════════════════════════════════╣');
  console.log('║  Agents:                                         ║');
  console.log('║   🛰️  Market Sentinel    — Market monitoring      ║');
  console.log('║   📊 Strategy Analyst   — Signal generation      ║');
  console.log('║   🛡️  Risk Monitor       — Risk enforcement       ║');
  console.log('║   🔬 Research           — Deep analysis          ║');
  console.log('║   ⚡ Execution Monitor  — Trade execution        ║');
  console.log('╚═══════════════════════════════════════════════════╝');

  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.log('\n⚠️  ANTHROPIC_API_KEY not set.');
    console.log('   Set it in .env to enable AI-powered agents.');
    console.log('   Agents will run in demo mode without API key.\n');

    // Show agent info in demo mode
    const orchestrator = new Orchestrator({ apiKey: 'demo-key' });
    const agents = orchestrator.getAgentInfo();
    console.log('Available agents:');
    for (const agent of agents) {
      console.log(`  ${agent.name} (${agent.role}) — ${agent.description}`);
    }
    return;
  }

  const orchestrator = new Orchestrator({ apiKey });
  console.log('\nAgent orchestrator initialized. Running first cycle...\n');

  try {
    const results = await orchestrator.runCycle();
    console.log(`\nCycle complete. ${results.filter((r) => r.success).length}/${results.length} agents succeeded.`);
  } catch (err) {
    console.error('Cycle failed:', err);
  }
}

// Run if executed directly
main().catch(console.error);
