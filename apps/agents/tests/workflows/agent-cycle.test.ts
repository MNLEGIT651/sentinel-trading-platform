import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — capture registerWorkflow and createWorkflowJob calls
// ---------------------------------------------------------------------------

const registeredWorkflows: Array<{
  type: string;
  steps: Array<{ name: string; handler: Function }>;
}> = [];
const mockCreateWorkflowJob = vi.fn();
const setMaxRetriesCalls: Array<unknown[]> = [];

vi.mock('../../src/workflow-runner.js', () => ({
  registerWorkflow: (def: { type: string; steps: Array<{ name: string; handler: Function }> }) => {
    registeredWorkflows.push(def);
  },
  createWorkflowJob: (...args: unknown[]) => mockCreateWorkflowJob(...args),
  setWorkflowMaxRetries: (...args: unknown[]) => {
    setMaxRetriesCalls.push(args);
  },
}));

vi.mock('../../src/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockSupabaseFrom = vi.fn();
vi.mock('../../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ from: mockSupabaseFrom }),
}));

// Import triggers registerWorkflow
const { startCycleWorkflow, recordAgentStepInCycleJob } =
  await import('../../src/workflows/agent-cycle.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWorkflow() {
  return registeredWorkflows.find((w) => w.type === 'agent_cycle')!;
}

function getStep(name: string) {
  return getWorkflow().steps.find((s) => s.name === name)!;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('agent-cycle workflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registers the agent_cycle workflow on import', () => {
    const workflow = getWorkflow();
    expect(workflow).toBeDefined();
    expect(workflow.type).toBe('agent_cycle');
    expect(workflow.steps).toHaveLength(3);
    expect(workflow.steps.map((s) => s.name)).toEqual([
      'cycle_start',
      'cycle_execute',
      'cycle_complete',
    ]);
  });

  it('sets max retries to 1', () => {
    expect(setMaxRetriesCalls).toContainEqual(['agent_cycle', 1]);
  });

  describe('cycle_start step', () => {
    it('returns cycle metadata and proceeds to cycle_execute', async () => {
      const step = getStep('cycle_start');
      const result = await step.handler(
        'job-1',
        { cycle_count: 5, sequence: ['risk', 'execution'] },
        {},
      );

      expect(result.nextStep).toBe('cycle_execute');
      expect(result.output.cycle_count).toBe(5);
      expect(result.output.sequence).toEqual(['risk', 'execution']);
      expect(result.output.started_at).toBeDefined();
      expect(result.output.agent_results).toEqual({});
    });

    it('handles missing input gracefully', async () => {
      const step = getStep('cycle_start');
      const result = await step.handler('job-1', {}, {});

      expect(result.output.cycle_count).toBe(0);
      expect(result.output.sequence).toEqual([]);
      expect(result.nextStep).toBe('cycle_execute');
    });
  });

  describe('cycle_execute step', () => {
    it('returns executed=true and proceeds to cycle_complete', async () => {
      const step = getStep('cycle_execute');
      const result = await step.handler(
        'job-1',
        { sequence: ['risk'] },
        { sequence: ['risk', 'execution'] },
      );

      expect(result.output.executed).toBe(true);
      expect(result.nextStep).toBe('cycle_complete');
    });
  });

  describe('cycle_complete step', () => {
    it('returns completed_at and ends workflow', async () => {
      const step = getStep('cycle_complete');
      const result = await step.handler('job-1', { cycle_count: 5 }, { cycle_count: 5 });

      expect(result.output.completed_at).toBeDefined();
      expect(result.nextStep).toBeNull();
    });
  });
});

describe('startCycleWorkflow', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a workflow job with correct params', async () => {
    mockCreateWorkflowJob.mockResolvedValue('job-123');

    const jobId = await startCycleWorkflow({
      cycleCount: 42,
      sequence: ['risk', 'execution', 'monitor'],
    });

    expect(jobId).toBe('job-123');
    expect(mockCreateWorkflowJob).toHaveBeenCalledWith(
      expect.objectContaining({
        workflowType: 'agent_cycle',
        inputData: expect.objectContaining({
          cycle_count: 42,
          sequence: ['risk', 'execution', 'monitor'],
        }),
      }),
    );
  });

  it('returns null if createWorkflowJob fails', async () => {
    mockCreateWorkflowJob.mockResolvedValue(null);

    const jobId = await startCycleWorkflow({ cycleCount: 1, sequence: ['risk'] });

    expect(jobId).toBeNull();
  });
});

describe('recordAgentStepInCycleJob', () => {
  beforeEach(() => vi.clearAllMocks());

  it('merges agent result into workflow job output_data', async () => {
    const updateFn = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { output_data: { agent_results: { risk: { success: true, durationMs: 100 } } } },
            error: null,
          }),
        }),
      }),
      update: updateFn,
    });

    await recordAgentStepInCycleJob('job-1', 'execution', {
      success: true,
      durationMs: 250,
    });

    expect(updateFn).toHaveBeenCalledWith(
      expect.objectContaining({
        output_data: expect.objectContaining({
          agent_results: expect.objectContaining({
            risk: { success: true, durationMs: 100 },
            execution: { success: true, durationMs: 250 },
          }),
        }),
      }),
    );
  });

  it('does not throw on DB error', async () => {
    mockSupabaseFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockRejectedValue(new Error('DB down')),
        }),
      }),
    });

    await expect(
      recordAgentStepInCycleJob('job-1', 'risk', {
        success: false,
        durationMs: 50,
        error: 'timeout',
      }),
    ).resolves.toBeUndefined();
  });
});
