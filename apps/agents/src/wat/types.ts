// apps/agents/src/wat/types.ts
import type { AgentRole } from '../types.js';

/** Parsed workflow file — one per agent */
export interface WorkflowConfig {
  role: AgentRole;
  name: string;
  description: string;
  schedule: string;
  cooldownMs: number;
  enabled: boolean;
  tools: string[];
  version: number;
  lastUpdatedBy: 'human' | 'agent';
  systemPrompt: string;
  filePath: string;
}

/** Parsed cycle.md */
export interface CycleConfig {
  version: number;
  sequence: AgentRole[];
  onDemand: AgentRole[];
  haltConditions: string;
}

/** Python tool metadata — from companion .schema.json files */
export interface PythonToolSchema {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  scriptPath: string;
}

/** Single tool call trace entry */
export interface ToolCallTrace {
  toolName: string;
  input: Record<string, unknown>;
  output: string;
  durationMs: number;
  source: 'typescript' | 'python';
}

/** Audit record written to Supabase */
export interface WorkflowRunRecord {
  cycle_number: number;
  agent_role: string;
  workflow_version: number;
  started_at: string;
  finished_at: string | null;
  success: boolean;
  summary: string | null;
  tools_called: ToolCallTrace[];
  workflow_updates_made: string[];
  error: string | null;
}

/** Full local trace (superset of WorkflowRunRecord) */
export interface WorkflowRunTrace extends WorkflowRunRecord {
  llm_transcript: Array<{ role: string; content: unknown }>;
  workflow_file_snapshot: string;
}
