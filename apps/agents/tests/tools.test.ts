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

  it('should have at least 18 tools', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(18);
  });

  it('should include GitHub tools', () => {
    const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
    expect(toolNames).toContain('list_open_prs');
    expect(toolNames).toContain('get_pr_details');
    expect(toolNames).toContain('get_pr_checks');
    expect(toolNames).toContain('audit_prs');
    expect(toolNames).toContain('list_workflows');
    expect(toolNames).toContain('list_workflow_runs');
    expect(toolNames).toContain('get_workflow_run_logs');
    expect(toolNames).toContain('audit_ci');
  });
});

describe('Agent Tool Mapping', () => {
  it('should define tools for all 7 agent roles', () => {
    const roles = [
      'market_sentinel',
      'strategy_analyst',
      'risk_monitor',
      'research',
      'execution_monitor',
      'pr_manager',
      'workflow_manager',
    ];
    for (const role of roles) {
      expect(AGENT_TOOLS[role]).toBeDefined();
      expect(AGENT_TOOLS[role].length).toBeGreaterThan(0);
    }
  });

  it('pr_manager should have PR tools', () => {
    expect(AGENT_TOOLS.pr_manager).toContain('list_open_prs');
    expect(AGENT_TOOLS.pr_manager).toContain('get_pr_details');
    expect(AGENT_TOOLS.pr_manager).toContain('get_pr_checks');
    expect(AGENT_TOOLS.pr_manager).toContain('audit_prs');
    expect(AGENT_TOOLS.pr_manager).toContain('create_alert');
  });

  it('workflow_manager should have workflow tools', () => {
    expect(AGENT_TOOLS.workflow_manager).toContain('list_workflows');
    expect(AGENT_TOOLS.workflow_manager).toContain('list_workflow_runs');
    expect(AGENT_TOOLS.workflow_manager).toContain('get_workflow_run_logs');
    expect(AGENT_TOOLS.workflow_manager).toContain('audit_ci');
    expect(AGENT_TOOLS.workflow_manager).toContain('create_alert');
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
