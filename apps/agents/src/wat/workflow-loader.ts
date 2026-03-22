// apps/agents/src/wat/workflow-loader.ts
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { AgentRole } from '../types.js';
import type { WorkflowConfig, CycleConfig } from './types.js';

const DEFAULT_WORKFLOWS_DIR = resolve(import.meta.dirname, '../../workflows');

interface WorkflowFrontmatter {
  name: string;
  role: string;
  description: string;
  schedule: string;
  cooldown_ms: number;
  enabled: boolean;
  tools: string[];
  version: number;
  last_updated_by: string;
}

function parseFrontmatter(
  raw: string,
): { frontmatter: Record<string, unknown>; body: string } | null {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match || match[1] === undefined || match[2] === undefined) return null;
  try {
    const frontmatter = parseYaml(match[1]) as Record<string, unknown>;
    return { frontmatter, body: match[2].trim() };
  } catch {
    return null;
  }
}

export function loadWorkflow(role: AgentRole, workflowsDir?: string): WorkflowConfig | null {
  const dir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  const filePath = join(dir, `${role}.md`);

  if (!existsSync(filePath)) return null;

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }

  const parsed = parseFrontmatter(raw);
  if (!parsed) return null;

  const fm = parsed.frontmatter as Partial<WorkflowFrontmatter>;
  if (!fm.name || !fm.role || !fm.tools) return null;

  return {
    role: fm.role as AgentRole,
    name: fm.name,
    description: fm.description ?? '',
    schedule: fm.schedule ?? '',
    cooldownMs: fm.cooldown_ms ?? 0,
    enabled: fm.enabled ?? true,
    tools: fm.tools ?? [],
    version: fm.version ?? 1,
    lastUpdatedBy: (fm.last_updated_by as 'human' | 'agent') ?? 'human',
    systemPrompt: parsed.body,
    filePath: resolve(filePath),
  };
}

export function loadCycle(workflowsDir?: string): CycleConfig {
  const dir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  const filePath = join(dir, 'cycle.md');

  if (!existsSync(filePath)) {
    throw new Error(`cycle.md not found at ${filePath}`);
  }

  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseFrontmatter(raw);
  if (!parsed) throw new Error('cycle.md has invalid frontmatter');

  const body = parsed.body;
  const fm = parsed.frontmatter;

  // Parse ## Sequence
  const seqMatch = body.match(/## Sequence\r?\n([\s\S]*?)(?=\r?\n## |\r?\n*$)/);
  const sequence: AgentRole[] = [];
  if (seqMatch?.[1]) {
    for (const line of seqMatch[1].split('\n')) {
      const m = line.match(/^\d+\.\s+(\w+)/);
      if (m?.[1]) sequence.push(m[1] as AgentRole);
    }
  }

  // Parse ## On-Demand Agents
  const odMatch = body.match(/## On-Demand Agents\r?\n([\s\S]*?)(?=\r?\n## |\r?\n*$)/);
  const onDemand: AgentRole[] = [];
  if (odMatch?.[1]) {
    for (const line of odMatch[1].split('\n')) {
      const m = line.match(/^-\s+(\w+)/);
      if (m?.[1]) onDemand.push(m[1] as AgentRole);
    }
  }

  // Parse ## Halt Conditions
  const hcMatch = body.match(/## Halt Conditions\r?\n([\s\S]*?)(?=\r?\n## |\r?\n*$)/);
  const haltConditions = hcMatch?.[1]?.trim() ?? '';

  return {
    version: (fm.version as number) ?? 1,
    sequence,
    onDemand,
    haltConditions,
  };
}

export function loadAllWorkflows(workflowsDir?: string): Map<AgentRole, WorkflowConfig> {
  const dir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  const roles: AgentRole[] = [
    'market_sentinel',
    'strategy_analyst',
    'risk_monitor',
    'research',
    'execution_monitor',
    'pr_manager',
    'workflow_manager',
  ];
  const map = new Map<AgentRole, WorkflowConfig>();
  for (const role of roles) {
    const wf = loadWorkflow(role, dir);
    if (wf) map.set(role, wf);
  }
  return map;
}
