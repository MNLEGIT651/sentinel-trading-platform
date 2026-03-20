// apps/agents/src/wat/audit-logger.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getSupabaseClient } from '../supabase-client.js';
import type { ToolCallTrace, WorkflowRunTrace } from './types.js';

const DEFAULT_RUNS_DIR = resolve(import.meta.dirname, '../../.tmp/runs');

interface StartRunParams {
  cycle_number: number;
  agent_role: string;
  workflow_version: number;
}

interface EndRunParams {
  success: boolean;
  summary: string | null;
  error?: string;
  llm_transcript?: Array<{ role: string; content: unknown }>;
  workflow_file_snapshot?: string;
}

export class AuditLogger {
  private runsDir: string;
  private currentRun: Partial<WorkflowRunTrace> | null = null;
  private toolCalls: ToolCallTrace[] = [];
  private workflowUpdates: string[] = [];

  constructor(runsDir?: string) {
    this.runsDir = runsDir ?? DEFAULT_RUNS_DIR;
  }

  startRun(params: StartRunParams): void {
    this.currentRun = {
      cycle_number: params.cycle_number,
      agent_role: params.agent_role,
      workflow_version: params.workflow_version,
      started_at: new Date().toISOString(),
    };
    this.toolCalls = [];
    this.workflowUpdates = [];
  }

  logToolCall(trace: ToolCallTrace): void {
    this.toolCalls.push(trace);
  }

  logWorkflowUpdate(description: string): void {
    this.workflowUpdates.push(description);
  }

  async endRun(params: EndRunParams): Promise<void> {
    if (!this.currentRun) return;

    const record: WorkflowRunTrace = {
      cycle_number: this.currentRun.cycle_number!,
      agent_role: this.currentRun.agent_role!,
      workflow_version: this.currentRun.workflow_version!,
      started_at: this.currentRun.started_at!,
      finished_at: new Date().toISOString(),
      success: params.success,
      summary: params.summary,
      tools_called: this.toolCalls,
      workflow_updates_made: this.workflowUpdates,
      error: params.error ?? null,
      llm_transcript: params.llm_transcript ?? [],
      workflow_file_snapshot: params.workflow_file_snapshot ?? '',
    };

    this.writeLocalTrace(record);

    this.writeSupabaseRecord(record).catch((err) => {
      console.error(
        '[AuditLogger] Supabase write failed:',
        err instanceof Error ? err.message : err,
      );
    });

    this.currentRun = null;
  }

  private writeLocalTrace(record: WorkflowRunTrace): void {
    mkdirSync(this.runsDir, { recursive: true });
    const filename = `${record.started_at.replace(/[:.]/g, '-')}-cycle-${record.cycle_number}-${record.agent_role}.json`;
    writeFileSync(join(this.runsDir, filename), JSON.stringify(record, null, 2), 'utf-8');
  }

  private async writeSupabaseRecord(record: WorkflowRunTrace): Promise<void> {
    const db = getSupabaseClient();
    const { error } = await db.from('workflow_runs').insert({
      cycle_number: record.cycle_number,
      agent_role: record.agent_role,
      workflow_version: record.workflow_version,
      started_at: record.started_at,
      finished_at: record.finished_at,
      success: record.success,
      summary: record.summary,
      tools_called: record.tools_called,
      workflow_updates_made: record.workflow_updates_made,
      error: record.error,
    });
    if (error) throw error;
  }
}
