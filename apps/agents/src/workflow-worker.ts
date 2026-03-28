/**
 * WorkflowWorker — Postgres-backed durable workflow polling worker.
 *
 * Polls the workflow_jobs table for pending jobs via Supabase RPCs,
 * delegates execution to the registered workflow definitions in
 * workflow-runner.ts, and handles graceful shutdown.
 */

import { getSupabaseClient } from './supabase-client.js';
import { logger } from './logger.js';
import {
  getRegisteredWorkflowTypes,
  getWorkflowMaxRetries,
  processJob,
} from './workflow-runner.js';

// ── Retry / backoff constants ────────────────────────────────────────
const BASE_RETRY_DELAY_MS = 30_000; // 30 seconds
const MAX_RETRY_DELAY_MS = 5 * 60_000; // 5 minutes

/** Calculate exponential backoff delay: base * 2^errorCount, capped at max. */
export function computeBackoffMs(errorCount: number): number {
  return Math.min(BASE_RETRY_DELAY_MS * 2 ** errorCount, MAX_RETRY_DELAY_MS);
}

export interface WorkflowWorkerOptions {
  workerId?: string;
  pollIntervalMs?: number;
  /** Timeout in seconds passed to claim_workflow_job RPC. */
  jobTimeoutSeconds?: number;
  /** Interval in ms for the timeout-recovery sweep (default 60 000). */
  timeoutSweepIntervalMs?: number;
}

/** Default job timeout in seconds, overridable via WORKFLOW_JOB_TIMEOUT_SECONDS env var. */
export const WORKFLOW_JOB_TIMEOUT_SECONDS = parseInt(
  process.env.WORKFLOW_JOB_TIMEOUT_SECONDS ?? '300',
  10,
);

export class WorkflowWorker {
  private running = false;
  private pollIntervalMs: number;
  private jobTimeoutSeconds: number;
  private timeoutSweepIntervalMs: number;
  private workerId: string;
  private currentJobPromise: Promise<void> | null = null;
  private pollTimeout: ReturnType<typeof setTimeout> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  /** Track the job id currently being executed so we can mark it on shutdown. */
  private inFlightJobId: string | null = null;

  constructor(options?: WorkflowWorkerOptions) {
    this.workerId = options?.workerId ?? `worker-${process.pid}-${Date.now()}`;
    this.pollIntervalMs = options?.pollIntervalMs ?? 5_000;
    this.jobTimeoutSeconds = options?.jobTimeoutSeconds ?? WORKFLOW_JOB_TIMEOUT_SECONDS;
    this.timeoutSweepIntervalMs = options?.timeoutSweepIntervalMs ?? 60_000;
  }

  /** Start the polling loop. Safe to call multiple times (no-ops if already running). */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn('workflow.worker.already_running', { workerId: this.workerId });
      return;
    }
    this.running = true;
    logger.info('workflow.worker.start', {
      workerId: this.workerId,
      pollIntervalMs: this.pollIntervalMs,
      jobTimeoutSeconds: this.jobTimeoutSeconds,
    });
    this.scheduleNext(0);
    this.startTimeoutSweep();
  }

  /** Stop the polling loop, mark in-flight jobs as retrying, and wait for completion. */
  async stop(): Promise<void> {
    if (!this.running) return;
    logger.info('workflow.worker.stopping', { workerId: this.workerId });
    this.running = false;

    if (this.pollTimeout) {
      clearTimeout(this.pollTimeout);
      this.pollTimeout = null;
    }

    this.stopTimeoutSweep();

    // Mark any in-flight job as retrying so another worker can pick it up
    if (this.inFlightJobId) {
      try {
        const db = getSupabaseClient();
        await db
          .from('workflow_jobs')
          .update({ status: 'retrying', worker_id: null })
          .eq('id', this.inFlightJobId)
          .eq('status', 'running');
        logger.info('workflow.worker.shutdown.requeued', { jobId: this.inFlightJobId });
      } catch (err) {
        logger.error('workflow.worker.shutdown.requeue_failed', {
          jobId: this.inFlightJobId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (this.currentJobPromise) {
      await this.currentJobPromise;
    }
    logger.info('workflow.worker.stopped', { workerId: this.workerId });
  }

  // ── Internal ───────────────────────────────────────────────────

  private scheduleNext(delayMs: number): void {
    if (!this.running) return;
    this.pollTimeout = setTimeout(() => {
      this.pollTimeout = null;
      this.currentJobPromise = this.pollOnce()
        .catch((err) => {
          logger.error('workflow.worker.poll.unhandled', {
            workerId: this.workerId,
            error: err instanceof Error ? err.message : String(err),
          });
        })
        .finally(() => {
          this.currentJobPromise = null;
          this.scheduleNext(this.pollIntervalMs);
        });
    }, delayMs);
  }

  /**
   * One poll iteration: try to claim a job for each registered workflow type.
   * If a job is claimed, execute it via processJob.
   */
  private async pollOnce(): Promise<void> {
    const db = getSupabaseClient();
    const workflowTypes = getRegisteredWorkflowTypes();

    for (const workflowType of workflowTypes) {
      if (!this.running) return;

      try {
        const { data: jobId, error } = await db.rpc('claim_workflow_job', {
          p_workflow_type: workflowType,
          p_worker_id: this.workerId,
          p_timeout_seconds: this.jobTimeoutSeconds,
        });

        if (error) {
          logger.warn('workflow.worker.claim.error', {
            workerId: this.workerId,
            workflowType,
            error: error.message,
          });
          continue;
        }

        if (jobId) {
          logger.info('workflow.worker.job.claimed', {
            workerId: this.workerId,
            workflowType,
            jobId,
          });
          await this.executeJob(jobId, workflowType);
        }
      } catch (err) {
        logger.error('workflow.worker.poll.error', {
          workerId: this.workerId,
          workflowType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  /**
   * Execute a claimed job. Delegates to processJob which handles
   * step execution, complete_workflow_step, and fail_workflow_job RPCs.
   */
  private async executeJob(jobId: string, workflowType: string): Promise<void> {
    this.inFlightJobId = jobId;
    const startMs = Date.now();
    try {
      await processJob(jobId);
      logger.info('workflow.worker.job.done', {
        workerId: this.workerId,
        jobId,
        workflowType,
        durationMs: Date.now() - startMs,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('workflow.worker.job.failed', {
        workerId: this.workerId,
        jobId,
        workflowType,
        error: errorMsg,
        durationMs: Date.now() - startMs,
      });

      // Fetch current error_count and max_retries to decide retry eligibility
      try {
        const db = getSupabaseClient();
        const { data: job } = await db
          .from('workflow_jobs')
          .select('error_count, max_retries')
          .eq('id', jobId)
          .single();

        const errorCount = (job?.error_count as number) ?? 0;
        const maxRetries = (job?.max_retries as number) ?? getWorkflowMaxRetries(workflowType);
        const canRetry = errorCount < maxRetries;

        if (canRetry) {
          const backoffMs = computeBackoffMs(errorCount);
          logger.info('workflow.worker.job.retry_scheduled', {
            jobId,
            errorCount: errorCount + 1,
            maxRetries,
            backoffMs,
          });
        }

        await db.rpc('fail_workflow_job', {
          p_job_id: jobId,
          p_error: errorMsg,
          p_step_name: null,
          p_retry: canRetry,
        });
      } catch (rpcErr) {
        logger.error('workflow.worker.fail_rpc.error', {
          jobId,
          error: rpcErr instanceof Error ? rpcErr.message : String(rpcErr),
        });
      }
    } finally {
      this.inFlightJobId = null;
    }
  }

  // ── Timeout recovery sweep ────────────────────────────────────

  private startTimeoutSweep(): void {
    this.sweepTimer = setInterval(() => {
      this.sweepTimedOutJobs().catch((err) => {
        logger.error('workflow.worker.sweep.unhandled', {
          workerId: this.workerId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.timeoutSweepIntervalMs);
    if (this.sweepTimer.unref) this.sweepTimer.unref();
  }

  private stopTimeoutSweep(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /**
   * Find running jobs whose timeout_at has passed and mark them as failed
   * with retry enabled so they can be picked up again.
   */
  private async sweepTimedOutJobs(): Promise<void> {
    const db = getSupabaseClient();

    const { data: timedOut, error } = await db
      .from('workflow_jobs')
      .select('id, workflow_type')
      .eq('status', 'running')
      .lt('timeout_at', new Date().toISOString());

    if (error) {
      logger.warn('workflow.worker.sweep.query_error', { error: error.message });
      return;
    }

    if (!timedOut || timedOut.length === 0) return;

    logger.info('workflow.worker.sweep.found', { count: timedOut.length });

    for (const job of timedOut) {
      try {
        await db.rpc('fail_workflow_job', {
          p_job_id: job.id,
          p_error: `Job timed out after ${this.jobTimeoutSeconds}s`,
          p_step_name: null,
          p_retry: true,
        });
        logger.info('workflow.worker.sweep.recovered', {
          jobId: job.id,
          workflowType: job.workflow_type,
        });
      } catch (err) {
        logger.error('workflow.worker.sweep.fail_error', {
          jobId: job.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}
