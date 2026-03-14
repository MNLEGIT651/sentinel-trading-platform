import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, AGENT_TOOLS, getToolsForAgent } from '../src/tools.js';

describe('Tool Definitions', () => {
  it('should have all required tools defined', () => {
    const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
    expect(toolNames).toContain('get_market_data');
    expect(toolNames).toContain('run_strategy_scan');
    expect(toolNames).toContain('assess_portfolio_risk');
    expect(toolNames).toContain('submit_order');
    expect(toolNames).toContain('analyze_ticker');
    expect(toolNames).toContain('create_alert');
  });

  it('should have valid schema for each tool', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.name).toBeTruthy();
      expect(tool.description).toBeTruthy();
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
    }
  });

  it('should have at least 10 tools', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Agent Tool Mapping', () => {
  it('should define tools for all 5 agent roles', () => {
    const roles = ['market_sentinel', 'strategy_analyst', 'risk_monitor', 'research', 'execution_monitor'];
    for (const role of roles) {
      expect(AGENT_TOOLS[role]).toBeDefined();
      expect(AGENT_TOOLS[role].length).toBeGreaterThan(0);
    }
  });

  it('market_sentinel should have market tools', () => {
    expect(AGENT_TOOLS.market_sentinel).toContain('get_market_data');
    expect(AGENT_TOOLS.market_sentinel).toContain('get_market_sentiment');
    expect(AGENT_TOOLS.market_sentinel).toContain('create_alert');
  });

  it('risk_monitor should have risk tools', () => {
    expect(AGENT_TOOLS.risk_monitor).toContain('assess_portfolio_risk');
    expect(AGENT_TOOLS.risk_monitor).toContain('check_risk_limits');
    expect(AGENT_TOOLS.risk_monitor).toContain('calculate_position_size');
  });

  it('execution_monitor should have order tools', () => {
    expect(AGENT_TOOLS.execution_monitor).toContain('submit_order');
    expect(AGENT_TOOLS.execution_monitor).toContain('get_open_orders');
  });

  it('getToolsForAgent returns correct subset', () => {
    const sentinelTools = getToolsForAgent('market_sentinel');
    const sentinelNames = sentinelTools.map((t) => t.name);
    expect(sentinelNames).toContain('get_market_data');
    expect(sentinelNames).not.toContain('submit_order');
  });

  it('getToolsForAgent returns empty for unknown role', () => {
    const tools = getToolsForAgent('nonexistent');
    expect(tools).toHaveLength(0);
  });
});
