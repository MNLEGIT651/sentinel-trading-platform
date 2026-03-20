// apps/agents/src/wat/tool-registry.ts
import type Anthropic from '@anthropic-ai/sdk';
import { TOOL_DEFINITIONS } from '../tools.js';
import { ToolExecutor } from '../tool-executor.js';
import { runPythonTool } from './python-runner.js';
import type { PythonToolSchema } from './types.js';

export class ToolRegistry {
  private tsExecutor: ToolExecutor;
  private pythonTools: Map<string, PythonToolSchema>;
  private allDefinitions: Anthropic.Tool[];

  constructor(tsExecutor: ToolExecutor, toolsDir?: string, pythonSchemas?: PythonToolSchema[]) {
    this.tsExecutor = tsExecutor;
    this.pythonTools = new Map();

    if (pythonSchemas) {
      for (const schema of pythonSchemas) {
        this.pythonTools.set(schema.name, schema);
      }
    }

    const pyDefs: Anthropic.Tool[] = Array.from(this.pythonTools.values()).map((s) => ({
      name: s.name,
      description: s.description,
      input_schema: s.input_schema as Anthropic.Tool.InputSchema,
    }));

    this.allDefinitions = [...TOOL_DEFINITIONS, ...pyDefs];
  }

  async execute(toolName: string, input: Record<string, unknown>): Promise<string> {
    const pyTool = this.pythonTools.get(toolName);
    if (pyTool) {
      return runPythonTool(pyTool.scriptPath.replace(/\.py$/, ''), input);
    }

    const tsDef = TOOL_DEFINITIONS.find((t) => t.name === toolName);
    if (tsDef) {
      return this.tsExecutor.execute(toolName, input);
    }

    return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }

  getToolsForAgent(allowedTools: string[]): Anthropic.Tool[] {
    return this.allDefinitions.filter((t) => allowedTools.includes(t.name));
  }
}
