// apps/agents/src/wat/python-runner.ts
import { spawn } from 'node:child_process';
import { join, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const DEFAULT_TOOLS_DIR = resolve(import.meta.dirname, '../../tools');
const DEFAULT_TIMEOUT_MS = 30_000;

export async function runPythonTool(
  toolName: string,
  input: Record<string, unknown>,
  toolsDir?: string,
  timeoutMs?: number,
): Promise<string> {
  const dir = toolsDir ?? DEFAULT_TOOLS_DIR;
  const scriptPath = join(dir, `${toolName}.py`);
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const pythonPath = process.env.PYTHON_PATH ?? 'python';

  if (!existsSync(scriptPath)) {
    return JSON.stringify({ error: `Python tool not found: ${scriptPath}` });
  }

  return new Promise<string>((resolvePromise) => {
    const proc = spawn(pythonPath, [scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout,
      env: {
        ...process.env,
        ENGINE_URL: process.env.ENGINE_URL ?? 'http://localhost:8000',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        resolvePromise(
          JSON.stringify({
            error: `Python tool '${toolName}' exited with code ${code}`,
            stderr: stderr.slice(0, 500),
          }),
        );
        return;
      }
      try {
        JSON.parse(stdout);
        resolvePromise(stdout.trim());
      } catch {
        resolvePromise(
          JSON.stringify({
            error: `Python tool '${toolName}' returned invalid JSON`,
            raw_output: stdout.slice(0, 500),
          }),
        );
      }
    });

    proc.on('error', (err) => {
      resolvePromise(
        JSON.stringify({
          error: `Failed to spawn Python: ${err.message}`,
        }),
      );
    });

    proc.stdin.write(JSON.stringify(input));
    proc.stdin.end();
  });
}
