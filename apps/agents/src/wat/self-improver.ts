// apps/agents/src/wat/self-improver.ts
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import type { AgentRole } from '../types.js';
import { logger } from '../logger.js';

const DEFAULT_WORKFLOWS_DIR = resolve(import.meta.dirname, '../../workflows');
const LOCK_DIR = resolve(import.meta.dirname, '../../.tmp');
const LOCK_FILE = join(LOCK_DIR, 'self-improve.lock');

export class SelfImprover {
  private workflowsDir: string;

  constructor(workflowsDir?: string) {
    this.workflowsDir = workflowsDir ?? DEFAULT_WORKFLOWS_DIR;
  }

  async addLearning(role: AgentRole, learning: string): Promise<boolean> {
    const filePath = join(this.workflowsDir, `${role}.md`);
    if (!existsSync(filePath)) return false;

    await this.acquireLock();
    try {
      let content = readFileSync(filePath, 'utf-8');

      const timestamp = new Date().toISOString().split('T')[0];
      const entry = `- [${timestamp}] ${learning}`;

      const learningsMarker = '<!-- Auto-updated by self-improvement loop -->';
      if (content.includes(learningsMarker)) {
        content = content.replace(learningsMarker, `${learningsMarker}\n${entry}`);
      } else if (content.includes('## Learnings')) {
        content = content.replace('## Learnings', `## Learnings\n${entry}`);
      } else {
        content += `\n## Learnings\n${entry}\n`;
      }

      content = content.replace(/version:\s*(\d+)/, (_, v) => `version: ${parseInt(v, 10) + 1}`);
      content = content.replace(/last_updated_by:\s*\w+/, 'last_updated_by: agent');

      writeFileSync(filePath, content, 'utf-8');

      this.tryGitCommit(filePath, role, learning);

      return true;
    } finally {
      this.releaseLock();
    }
  }

  private tryGitCommit(filePath: string, role: string, learning: string): void {
    const gitEnabled = process.env.WAT_SELF_IMPROVE_GIT !== 'false';
    if (!gitEnabled) return;

    try {
      const summary = learning.slice(0, 72);
      execFileSync('git', ['add', filePath], { stdio: 'pipe' });
      execFileSync('git', ['commit', '-m', `chore(wat): ${role} learned ${summary}`], {
        stdio: 'pipe',
      });
    } catch (err) {
      logger.error('Git commit failed (file write preserved)', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async acquireLock(): Promise<void> {
    mkdirSync(LOCK_DIR, { recursive: true });
    const maxWait = 10_000;
    const start = Date.now();
    while (existsSync(LOCK_FILE)) {
      if (Date.now() - start > maxWait) {
        this.releaseLock();
        break;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    writeFileSync(LOCK_FILE, String(process.pid), 'utf-8');
  }

  private releaseLock(): void {
    try {
      if (existsSync(LOCK_FILE)) unlinkSync(LOCK_FILE);
    } catch {
      // ignore
    }
  }
}
