/**
 * Durable Workflow Runner
 * Polls workflow_jobs via Supabase RPC, executes steps, handles retries.
 * Designed to migrate to Temporal-style execution later.
 */

import { getSupabaseClient } from './supabase-client.js';
import { logger } from './logger.js';
import { trace, SpanStatusCode, type Span } from '@opentelemetry/api';

const tracer = trace.getTracer('sentinel-agents', '1.0.0');

// Step handler signature
type StepHandler = (
  jobId: string,
  input: Record<string, unknown>,
  stepOutput: Record<string, unknown>,
) => Promise<{ output: Record<string, unknown>; nextStep: string | null }>;

// Workflow definition: ordered steps with handlers
interface WorkflowDefinition {
  type: string;
  steps: Array<{ name: string; handler: StepHandler }>;
}

// Registry of workflow definitions
const workflows = new Map<string, WorkflowDefinition>();

export function registerWorkflow(def: WorkflowDefinition): void {
  workflows.set(def.type, def);
  logger.info('workflow.registered', { type: def.type, steps: def.steps.map((s) => s.name) });
}

/** Return the workflow types currently registered. */
export function getRegisteredWorkflowTypes(): string[] {
  return Array.from(workflows.keys());
}

// Default poll interval
const POLL_INTERVAL_MS = 5_000;
const WORKER_ID = `worker-${process.pid}-${Date.now()}`;

let pollTimer: ReturnType<typeof setInterval> | null = null;
let isProcessing = false;

/**
 * Process a single claimed job through its workflow steps.
 */
export async function processJob(jobId: string): Promise<void> {
  const db = getSupabaseClient();

  // Fetch full job data
  const { data: job, error } = await db.from('workflow_jobs').select('*').eq('id', jobId).single();

  if (error || !job) {
    logger.error('workflow.job.fetch.failed', { jobId, error: error?.message });
    return;
  }

  const def = workflows.get(job.workflow_type);
  if (!def) {
    logger.error('workflow.job.unknown_type', { jobId, type: job.workflow_type });
    await db.rpc('fail_workflow_job', {
      p_job_id: jobId,
      p_error: `Unknown workflow type: ${job.workflow_type}`,
      p_step_name: null,
      p_retry: false,
    });
    return;
  }

  // Find where to resume: first step not in steps_completed
  const completed = (job.steps_completed as string[]) ?? [];
  const remainingSteps = def.steps.filter((s) => !completed.includes(s.name));

  if (remainingSteps.length === 0) {
    await db
      .from('workflow_jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', jobId);
    logger.info('workflow.job.completed', { jobId, type: job.workflow_type });
    return;
  }

  // Accumulate output across steps (merge persisted output with new results)
  let mergedOutput: Record<string, unknown> = (job.output_data as Record<string, unknown>) ?? {};

  // Execute remaining steps sequentially
  for (const step of remainingSteps) {
    const startMs = Date.now();
    const nextStepName = remainingSteps[remainingSteps.indexOf(step) + 1]?.name ?? null;

    try {
      const earlyExit = await tracer.startActiveSpan(
        `workflow.step.${step.name}`,
        {
          attributes: {
            'workflow.job_id': jobId,
            'workflow.type': job.workflow_type as string,
            'workflow.step': step.name,
          },
        },
        async (span: Span): Promise<boolean> => {
          try {
            logger.info('workflow.step.start', { jobId, step: step.name });

            const result = await step.handler(
              jobId,
              job.input_data as Record<string, unknown>,
              mergedOutput,
            );

            const durationMs = Date.now() - startMs;

            await db.rpc('complete_workflow_step', {
              p_job_id: jobId,
              p_step_name: step.name,
              p_output: result.output,
              p_next_step: result.nextStep ?? nextStepName,
              p_duration_ms: durationMs,
            });

            mergedOutput = { ...mergedOutput, ...result.output };

            logger.info('workflow.step.completed', { jobId, step: step.name, durationMs });
            span.setAttributes({ 'workflow.step.duration_ms': durationMs });
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();

            if (result.nextStep === null && nextStepName !== null) {
              logger.info('workflow.job.early_exit', { jobId, step: step.name });
              return true;
            }
            return false;
          } catch (err) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err instanceof Error ? err.message : String(err),
            });
            span.recordException(err instanceof Error ? err : new Error(String(err)));
            span.end();
            throw err;
          }
        },
      );

      if (earlyExit) return;
    } catch (err) {
      const durationMs = Date.now() - startMs;
      const errorMsg = err instanceof Error ? err.message : String(err);

      logger.error('workflow.step.failed', { jobId, step: step.name, error: errorMsg, durationMs });

      await db.rpc('fail_workflow_job', {
        p_job_id: jobId,
        p_error: errorMsg,
        p_step_name: step.name,
        p_retry: true,
      });

      // Stop processing — will be retried later
      return;
    }
  }

  // All steps completed successfully
  await db
    .from('workflow_jobs')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', jobId);

  logger.info('workflow.job.completed', { jobId, type: job.workflow_type });
}

/**
 * Poll for available jobs across all registered workflow types.
 */
async function pollForJobs(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const db = getSupabaseClient();

    for (const [workflowType] of workflows) {
      try {
        const { data: jobId, error } = await db.rpc('claim_workflow_job', {
          p_workflow_type: workflowType,
          p_worker_id: WORKER_ID,
          p_timeout_seconds: 300,
        });

        if (error) {
          logger.warn('workflow.poll.claim.error', { workflowType, error: error.message });
          continue;
        }

        if (jobId) {
          await processJob(jobId);
        }
      } catch (err) {
        logger.error('workflow.poll.error', {
          workflowType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Start the workflow runner polling loop.
 */
export function startWorkflowRunner(intervalMs = POLL_INTERVAL_MS): void {
  if (pollTimer) {
    logger.warn('workflow.runner.already_started');
    return;
  }
  logger.info('workflow.runner.start', { intervalMs, workerId: WORKER_ID });
  pollTimer = setInterval(() => {
    pollForJobs().catch((err) => {
      logger.error('workflow.runner.poll.unhandled', {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, intervalMs);
}

/**
 * Stop the workflow runner.
 */
export function stopWorkflowRunner(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('workflow.runner.stop');
  }
}

// ── Idempotency key helpers ──────────────────────────────────────────

/**
 * Generate a deterministic idempotency key.
 * Format: `{workflowType}:{entityId}:{timestampBucket}`
 * The timestamp bucket groups by 10-minute windows to prevent duplicate
 * jobs for the same entity within a short timeframe.
 */
export function generateIdempotencyKey(
  workflowType: string,
  entityId: string,
  bucketMinutes = 10,
): string {
  const bucketMs = bucketMinutes * 60 * 1_000;
  const bucket = Math.floor(Date.now() / bucketMs) * bucketMs;
  return `${workflowType}:${entityId}:${bucket}`;
}

// ── Per-workflow-type max retries ────────────────────────────────────

const workflowMaxRetries = new Map<string, number>();

/** Configure max retries for a specific workflow type. */
export function setWorkflowMaxRetries(workflowType: string, maxRetries: number): void {
  workflowMaxRetries.set(workflowType, maxRetries);
}

/** Get the configured max retries for a workflow type (default 3). */
export function getWorkflowMaxRetries(workflowType: string): number {
  return workflowMaxRetries.get(workflowType) ?? 3;
}

/**
 * Create a new workflow job (convenience helper).
 *
 * If no idempotency key is supplied and a recommendationId is present,
 * one is generated automatically. If a duplicate key already exists the
 * existing job id is returned instead of creating a new row.
 */
export async function createWorkflowJob(params: {
  workflowType: string;
  idempotencyKey?: string;
  inputData?: Record<string, unknown>;
  maxRetries?: number;
  timeoutSeconds?: number;
  recommendationId?: string;
  orderId?: string;
}): Promise<string | null> {
  try {
    const db = getSupabaseClient();

    // Auto-generate idempotency key when one isn't explicitly provided
    const idempotencyKey =
      params.idempotencyKey ??
      (params.recommendationId
        ? generateIdempotencyKey(params.workflowType, params.recommendationId)
        : null);

    // If we have a key, check for an existing job first (UNIQUE constraint guard)
    if (idempotencyKey) {
      const { data: existing } = await db
        .from('workflow_jobs')
        .select('id')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (existing) {
        logger.info('workflow.job.duplicate', {
          existingJobId: existing.id,
          idempotencyKey,
          type: params.workflowType,
        });
        return existing.id;
      }
    }

    const resolvedMaxRetries = params.maxRetries ?? getWorkflowMaxRetries(params.workflowType);

    const { data, error } = await db
      .from('workflow_jobs')
      .insert({
        workflow_type: params.workflowType,
        idempotency_key: idempotencyKey,
        input_data: params.inputData ?? {},
        max_retries: resolvedMaxRetries,
        recommendation_id: params.recommendationId ?? null,
        order_id: params.orderId ?? null,
      })
      .select('id')
      .single();

    if (error) {
      // Handle race condition: another worker inserted between our check and insert
      if (error.code === '23505' && idempotencyKey) {
        const { data: raced } = await db
          .from('workflow_jobs')
          .select('id')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle();
        if (raced) {
          logger.info('workflow.job.duplicate.race', {
            existingJobId: raced.id,
            idempotencyKey,
          });
          return raced.id;
        }
      }

      logger.error('workflow.job.create.failed', {
        error: error.message,
        type: params.workflowType,
      });
      return null;
    }
    logger.info('workflow.job.created', {
      jobId: data.id,
      type: params.workflowType,
      idempotencyKey,
    });
    return data.id;
  } catch (err) {
    logger.error('workflow.job.create.error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
