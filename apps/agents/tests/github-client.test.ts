import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PRSummary, WorkflowRunSummary, WorkflowSummary } from '../src/github-client.js';

// Mock child_process so tests don't require `gh` CLI
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
  execSync: vi.fn(),
}));

const { execFileSync } = await import('node:child_process');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('github-client helpers', () => {
  it('gh() parses JSON output', async () => {
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify([{ number: 1 }]));
    const { gh } = await import('../src/github-client.js');
    const result = gh(['pr', 'list']);
    expect(result).toEqual([{ number: 1 }]);
  });

  it('gh() returns plain string when output is not JSON', async () => {
    vi.mocked(execFileSync).mockReturnValue('some plain output');
    const { gh } = await import('../src/github-client.js');
    const result = gh(['run', 'view', '1']);
    expect(result).toBe('some plain output');
  });

  it('gh() returns error object on failure', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('gh not found');
    });
    const { gh } = await import('../src/github-client.js');
    const result = gh(['pr', 'list']) as { error: string };
    expect(result).toHaveProperty('error');
    expect(result.error).toContain('gh not found');
  });

  it('daysSince() calculates correctly', async () => {
    const { daysSince } = await import('../src/github-client.js');
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
    expect(daysSince(twoDaysAgo)).toBe(2);
  });

  it('rate() returns correct ratings', async () => {
    const { rate } = await import('../src/github-client.js');
    expect(rate(0, 5, 10)).toBe('PASS');
    expect(rate(5, 5, 10)).toBe('WARN');
    expect(rate(10, 5, 10)).toBe('FAIL');
  });
});

describe('listOpenPRs', () => {
  it('returns mapped PR summaries', async () => {
    const mockPRs = [
      {
        number: 42,
        title: 'Fix bug',
        author: { login: 'alice' },
        createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        reviewDecision: 'APPROVED',
        isDraft: false,
        headRefName: 'fix/bug',
      },
    ];
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(mockPRs));
    const { listOpenPRs } = await import('../src/github-client.js');
    const result = listOpenPRs();
    expect(result).toHaveLength(1);
    expect(result[0].number).toBe(42);
    expect(result[0].author).toBe('alice');
    expect(result[0].ageDays).toBe(3);
  });

  it('returns empty array on error', async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error('fail');
    });
    const { listOpenPRs } = await import('../src/github-client.js');
    const result = listOpenPRs();
    expect(result).toEqual([]);
  });
});

describe('auditPRs', () => {
  it('returns PASS when all PRs are healthy', async () => {
    const mockPRs = [
      {
        number: 1,
        title: 'Good PR',
        author: { login: 'bob' },
        createdAt: new Date().toISOString(),
        reviewDecision: 'APPROVED',
        isDraft: false,
        headRefName: 'feat/good',
      },
    ];
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(mockPRs));
    const { auditPRs } = await import('../src/github-client.js');
    const result = auditPRs();
    expect(result.rating).toBe('PASS');
    expect(result.stale).toHaveLength(0);
  });

  it('returns WARN for stale PRs without review', async () => {
    const mockPRs = [
      {
        number: 2,
        title: 'Stale PR',
        author: { login: 'carol' },
        createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString(),
        reviewDecision: null,
        isDraft: false,
        headRefName: 'feat/stale',
      },
    ];
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(mockPRs));
    const { auditPRs } = await import('../src/github-client.js');
    const result = auditPRs();
    expect(result.rating).toBe('WARN');
    expect(result.stale).toHaveLength(1);
  });
});

describe('listWorkflows', () => {
  it('returns workflow summaries', async () => {
    const mockResponse = {
      workflows: [{ id: 1, name: 'CI', path: '.github/workflows/ci.yml', state: 'active' }],
    };
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(mockResponse));
    const { listWorkflows } = await import('../src/github-client.js');
    const result = listWorkflows();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('CI');
  });
});

describe('auditCI', () => {
  it('returns PASS when all runs are green', async () => {
    const mockRuns = Array.from({ length: 5 }, (_, i) => ({
      databaseId: i + 1,
      status: 'completed',
      conclusion: 'success',
      name: 'CI',
      createdAt: new Date().toISOString(),
      headBranch: 'main',
    }));
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(mockRuns));
    const { auditCI } = await import('../src/github-client.js');
    const result = auditCI();
    expect(result.rating).toBe('PASS');
    expect(result.mainFailCount).toBe(0);
  });

  it('returns FAIL when multiple main failures exist', async () => {
    const mockRuns = Array.from({ length: 5 }, (_, i) => ({
      databaseId: i + 1,
      status: 'completed',
      conclusion: 'failure',
      name: 'CI',
      createdAt: new Date().toISOString(),
      headBranch: 'main',
    }));
    vi.mocked(execFileSync).mockReturnValue(JSON.stringify(mockRuns));
    const { auditCI } = await import('../src/github-client.js');
    const result = auditCI();
    expect(result.rating).toBe('FAIL');
    expect(result.mainFailCount).toBeGreaterThanOrEqual(2);
  });
});
