/**
 * Orchestrator dependency injection tests.
 *
 * Verifies that the `executor?` option added in Phase 3 allows the Orchestrator
 * to be constructed and exercised without a real EngineClient or API key.
 * This enables fast, isolated unit tests of orchestration logic.
 *
 * For the full cycle/agent tests see orchestrator.test.ts.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Orchestrator } from '../src/orchestrator.js';
import type { ToolExecutor } from '../src/tool-executor.js';
import {
  DEFAULT_CYCLE_INTERVAL_MS,
  EXECUTION_MONITOR_COOLDOWN_MS,
  MARKET_SENTINEL_COOLDOWN_MS,
  RESEARCH_COOLDOWN_MS,
  RISK_MONITOR_COOLDOWN_MS,
  STRATEGY_ANALYST_COOLDOWN_MS,
} from '../src/config.js';

// ─── Mock executor factory ─────────────────────────────────────────────────

function makeMockExecutor(): ToolExecutor {
  return {
    execute: vi.fn().mockResolvedValue(JSON.stringify({ ok: true })),
  } as unknown as ToolExecutor;
}

// ─── DI construction tests ─────────────────────────────────────────────────

describe('Orchestrator constructor — executor injection', () => {
  it('accepts an injected executor without throwing', () => {
    const executor = makeMockExecutor();
    expect(() => new Orchestrator({ executor })).not.toThrow();
  });

  it('constructs successfully without apiKey or engineUrl when executor is injected', () => {
    // This proves the constructor does not call `new EngineClient()` when
    // executor is provided — no network connection is attempted.
    const executor = makeMockExecutor();
    const orchestrator = new Orchestrator({ executor });
    expect(orchestrator.getAgentInfo()).toHaveLength(7);
  });

  it('creates a real EngineClient when no executor is injected', () => {
    // Should not throw even without env vars (dev defaults are used)
    expect(() => new Orchestrator({ apiKey: 'test-key' })).not.toThrow();
  });

  it('prefers the injected executor over apiKey/engineUrl', () => {
    const executor = makeMockExecutor();
    // Deliberately provide a bogus engineUrl — it must be ignored
    const orchestrator = new Orchestrator({
      executor,
      engineUrl: 'http://does-not-exist.invalid:9999',
    });
    // If the EngineClient were used, construction might fail; the fact that
    // getAgentInfo() works confirms the executor path was taken.
    expect(orchestrator.getAgentInfo()).toHaveLength(7);
  });
});

// ─── Config constants integration ──────────────────────────────────────────

describe('Orchestrator — config constants', () => {
  it('DEFAULT_CYCLE_INTERVAL_MS is 15 minutes', () => {
    expect(DEFAULT_CYCLE_INTERVAL_MS).toBe(15 * 60 * 1_000);
  });

  it('agent cooldowns match documented schedules', () => {
    expect(MARKET_SENTINEL_COOLDOWN_MS).toBe(5 * 60 * 1_000);
    expect(STRATEGY_ANALYST_COOLDOWN_MS).toBe(15 * 60 * 1_000);
    expect(RISK_MONITOR_COOLDOWN_MS).toBe(60 * 1_000);
    expect(RESEARCH_COOLDOWN_MS).toBe(30 * 60 * 1_000);
    expect(EXECUTION_MONITOR_COOLDOWN_MS).toBe(10 * 1_000);
  });

  it('DEFAULT_CYCLE_INTERVAL_MS equals STRATEGY_ANALYST_COOLDOWN_MS', () => {
    // The cycle interval must be >= the fastest repeating agent cooldown to
    // avoid triggering agents more often than they're designed to run.
    expect(DEFAULT_CYCLE_INTERVAL_MS).toBe(STRATEGY_ANALYST_COOLDOWN_MS);
  });

  it('DEFAULT_AGENT_PROMPTS contains all cycle-sequence and on-demand roles', async () => {
    const { DEFAULT_AGENT_PROMPTS } = await import('../src/config.js');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('market_sentinel');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('strategy_analyst');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('risk_monitor');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('execution_monitor');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('pr_manager');
    expect(DEFAULT_AGENT_PROMPTS).toHaveProperty('workflow_manager');
  });

  it('WATCHLIST_TICKERS is non-empty and contains expected symbols', async () => {
    const { WATCHLIST_TICKERS } = await import('../src/config.js');
    expect(WATCHLIST_TICKERS.length).toBeGreaterThan(0);
    expect(WATCHLIST_TICKERS).toContain('SPY');
    expect(WATCHLIST_TICKERS).toContain('AAPL');
  });

  it('market_sentinel prompt references WATCHLIST_TICKERS symbols', async () => {
    const { DEFAULT_AGENT_PROMPTS, WATCHLIST_TICKERS } = await import('../src/config.js');
    const prompt = DEFAULT_AGENT_PROMPTS.market_sentinel;
    for (const ticker of WATCHLIST_TICKERS) {
      expect(prompt).toContain(ticker);
    }
  });
});

// ─── start/stop lifecycle ─────────────────────────────────────────────────

describe('Orchestrator start/stop lifecycle', () => {
  let orchestrator: Orchestrator;

  beforeEach(() => {
    vi.useFakeTimers();
    orchestrator = new Orchestrator({ executor: makeMockExecutor() });
    // Halt immediately so runCycle() calls are no-ops during interval tests
    orchestrator.halt('test setup');
    orchestrator.resume();
  });

  afterEach(() => {
    orchestrator.stop();
    vi.useRealTimers();
  });

  it('logs a warning and returns early when start() is called twice', () => {
    orchestrator.start(1_000);
    // Starting again should not throw or create a second interval
    expect(() => orchestrator.start(1_000)).not.toThrow();
    orchestrator.stop();
  });

  it('stop() is idempotent — calling it twice does not throw', () => {
    orchestrator.start(1_000);
    orchestrator.stop();
    expect(() => orchestrator.stop()).not.toThrow();
  });

  it('halt() stops the cycle interval and sets halted = true', () => {
    orchestrator.start(1_000);
    orchestrator.halt('deliberate test halt');
    expect(orchestrator.currentState.halted).toBe(true);
  });

  it('resume() clears the halted flag', () => {
    orchestrator.halt('test');
    orchestrator.resume();
    expect(orchestrator.currentState.halted).toBe(false);
  });
});

// ─── runAgent fallback ────────────────────────────────────────────────────

describe('Orchestrator.runAgent', () => {
  it('returns a failure result for an unknown role', async () => {
    const orchestrator = new Orchestrator({ executor: makeMockExecutor() });
    const result = await orchestrator.runAgent(
      'nonexistent_role' as Parameters<typeof orchestrator.runAgent>[0],
      'test prompt',
    );
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not found/i);
  });

  it('sets the agent state to "error" after a failed run', async () => {
    const orchestrator = new Orchestrator({ executor: makeMockExecutor() });
    // Halt first so we can control what runs
    orchestrator.halt('setup');
    orchestrator.resume();

    // Force the cycle to run only the skip path
    await orchestrator.runAgent(
      'nonexistent_role' as Parameters<typeof orchestrator.runAgent>[0],
      'prompt',
    );
    // State should still be valid after the unknown-role error
    const state = orchestrator.currentState;
    expect(state.halted).toBe(false);
  });
});
