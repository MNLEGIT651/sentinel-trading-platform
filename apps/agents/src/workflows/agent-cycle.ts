/**
 * Agent Cycle Workflow
 *
 * Registers an 'agent_cycle' workflow type so that each orchestrator cycle
 * is tracked as a durable workflow job. Each agent in the cycle sequence
 * becomes a workflow step, making cycle execution recoverable and auditable.
 *
 * The existing orchestrator_locks mechanism remains as a distributed guard
 * to prevent concurrent cycles. This workflow layer adds state tracking and
 * recovery on top.
 */

import { registerWorkflow, createWorkflowJob, setWorkflowMaxRetries } from '../workflow-runner.js';
import { logger } from '../logger.js';

// Agent cycles should not auto-retry many times — a failed cycle
// should be investigated, not blindly re-run.
setWorkflowMaxRetries('agent_cycle', 1);

/**
 * Build workflow steps dynamically from the cycle sequence.
 * Each step is a thin pass-through that records agent execution metadata;
 * the actual agent execution is driven by the orchestrator which calls
 * `recordAgentStep` after each agent completes.
 */
registerWorkflow({
  type: 'agent_cycle',
  steps: [
    {
      name: 'cycle_start',
      handler: async (_jobId, input) => {
        const cycleCount = (input.cycle_count as number) ?? 0;
        const sequence = (input.sequence as string[]) ?? [];
        logger.info('workflow.agent_cycle.start', { cycleCount, sequence });
        return {
          output: {
            cycle_count: cycleCount,
            sequence,
            started_at: new Date().toISOString(),
            agent_results: {},
          },
          nextStep: 'cycle_execute',
        };
      },
    },
    {
      name: 'cycle_execute',
      handler: async (_jobId, input, stepOutput) => {
        // This step is a marker — the orchestrator drives the actual agent
        // runs and records results via updateCycleJobOutput. When this step
        // completes, it signals the cycle body has finished.
        const sequence = (stepOutput.sequence as string[]) ?? (input.sequence as string[]) ?? [];
        logger.info('workflow.agent_cycle.execute', { agents: sequence });
        return {
          output: { executed: true },
          nextStep: 'cycle_complete',
        };
      },
    },
    {
      name: 'cycle_complete',
      handler: async (_jobId, input, stepOutput) => {
        const cycleCount = (stepOutput.cycle_count as number) ?? (input.cycle_count as number) ?? 0;
        logger.info('workflow.agent_cycle.complete', { cycleCount });
        return {
          output: {
            completed_at: new Date().toISOString(),
          },
          nextStep: null,
        };
      },
    },
  ],
});

/**
 * Create a workflow job to track an agent cycle.
 * Returns the job ID or null if creation failed / duplicate.
 */
export async function startCycleWorkflow(params: {
  cycleCount: number;
  sequence: string[];
}): Promise<string | null> {
  return createWorkflowJob({
    workflowType: 'agent_cycle',
    idempotencyKey: `agent_cycle:${params.cycleCount}:${Date.now()}`,
    inputData: {
      cycle_count: params.cycleCount,
      sequence: params.sequence,
    },
  });
}

/**
 * Update the output_data of a running cycle workflow job with
 * an individual agent's result. This is called by the orchestrator
 * after each agent completes.
 */
export async function recordAgentStepInCycleJob(
  jobId: string,
  agentRole: string,
  result: { success: boolean; durationMs: number; error?: string | undefined },
): Promise<void> {
  try {
    const { getSupabaseClient } = await import('../supabase-client.js');
    const db = getSupabaseClient();

    // Read current output, merge in the new agent result
    const { data: job } = await db
      .from('workflow_jobs')
      .select('output_data')
      .eq('id', jobId)
      .single();

    const existing = (job?.output_data as Record<string, unknown>) ?? {};
    const agentResults = (existing.agent_results as Record<string, unknown>) ?? {};
    agentResults[agentRole] = result;

    await db
      .from('workflow_jobs')
      .update({
        output_data: { ...existing, agent_results: agentResults },
      })
      .eq('id', jobId);
  } catch (err) {
    logger.warn('workflow.agent_cycle.record_step.failed', {
      jobId,
      agentRole,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
