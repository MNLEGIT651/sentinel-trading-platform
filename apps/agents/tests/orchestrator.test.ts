import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { Agent } from '../src/agent.js';
import { Orchestrator } from '../src/orchestrator.js';

describe('Orchestrator', () => {
  beforeEach(() => {
    vi.spyOn(Agent.prototype, 'run').mockImplementation(async function () {
      return {
        role: this.config.role,
        success: true,
        timestamp: new Date().toISOString(),
        durationMs: 0,
        data: null,
      };
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with all 7 agents', () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    const agents = orchestrator.getAgentInfo();
    expect(agents).toHaveLength(7);
  });

  it('should have all roles represented', () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    const roles = orchestrator.getAgentInfo().map((a) => a.role);
    expect(roles).toContain('market_sentinel');
    expect(roles).toContain('strategy_analyst');
    expect(roles).toContain('risk_monitor');
    expect(roles).toContain('research');
    expect(roles).toContain('execution_monitor');
    expect(roles).toContain('pr_manager');
    expect(roles).toContain('workflow_manager');
  });

  it('should start with all agents idle', () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    const state = orchestrator.currentState;
    for (const status of Object.values(state.agents)) {
      expect(status).toBe('idle');
    }
  });

  it('should track cycle count', () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    expect(orchestrator.currentState.cycleCount).toBe(0);
  });

  it('should support halt and resume', () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    expect(orchestrator.currentState.halted).toBe(false);

    orchestrator.halt('Test halt');
    expect(orchestrator.currentState.halted).toBe(true);

    orchestrator.resume();
    expect(orchestrator.currentState.halted).toBe(false);
  });

  it('should provide agent info with correct fields', () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    const agents = orchestrator.getAgentInfo();

    for (const agent of agents) {
      expect(agent.role).toBeTruthy();
      expect(agent.name).toBeTruthy();
      expect(agent.description).toBeTruthy();
      expect(agent.status).toBe('idle');
      expect(agent.enabled).toBe(true);
    }
  });

  it('should skip cycle when halted', async () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    orchestrator.halt('Testing');
    const results = await orchestrator.runCycle();
    expect(results).toHaveLength(0);
  });

  it('records lastCycleAt after runCycle completes', async () => {
    const orchestrator = new Orchestrator({ apiKey: 'test-key' });
    const before = Date.now();
    await orchestrator.runCycle();
    const state = orchestrator.currentState;
    expect(state.lastCycleAt).not.toBeNull();
    expect(new Date(state.lastCycleAt!).getTime()).toBeGreaterThanOrEqual(before);
  });
});
