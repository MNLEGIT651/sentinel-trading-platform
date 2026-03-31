// apps/agents/tests/server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

// Mock orchestrator
const mockOrchestrator = {
  currentState: {
    agents: {
      market_sentinel: 'idle',
      strategy_analyst: 'idle',
      risk_monitor: 'idle',
      research: 'idle',
      execution_monitor: 'idle',
    },
    lastRun: {
      market_sentinel: null,
      strategy_analyst: null,
      risk_monitor: null,
      research: null,
      execution_monitor: null,
    },
    cycleCount: 3,
    halted: false,
    lastCycleAt: null,
  },
  runCycle: vi.fn().mockResolvedValue([]),
  halt: vi.fn(),
  resume: vi.fn(),
};

// Mock store
vi.mock('../src/recommendations-store.js', () => ({
  listRecommendations: vi.fn().mockResolvedValue([]),
  atomicApprove: vi.fn(),
  markFilled: vi.fn(),
  markRiskBlocked: vi.fn(),
  rejectRecommendation: vi.fn(),
  getRecommendation: vi.fn(),
  listAlerts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/scheduler.js', () => ({
  getNextCycleAt: vi.fn().mockReturnValue('2026-03-15T14:00:00.000Z'),
  isMarketOpen: vi.fn().mockReturnValue(true),
}));

vi.mock('../src/engine-client.js', () => ({
  EngineClient: vi.fn().mockImplementation(() => ({
    submitOrder: vi
      .fn()
      .mockResolvedValue({ order_id: 'alpaca-123', status: 'filled', fill_price: 180 }),
  })),
}));

// Mock lock manager — distributed lock backed by Supabase
const mockLockManager = {
  acquire: vi.fn().mockResolvedValue(true),
  release: vi.fn().mockResolvedValue(true),
  isHeld: vi.fn().mockResolvedValue(false),
  shutdown: vi.fn(),
  holderId: 'test-holder',
};

vi.mock('../src/lock-manager.js', () => ({
  getLockManager: () => mockLockManager,
  resetLockManager: vi.fn(),
  LockManager: vi.fn(),
}));

// Mock workflow module to prevent transitive EngineClient instantiation at import time
vi.mock('../src/workflows/recommendation-lifecycle.js', () => ({
  startRecommendationWorkflow: vi.fn().mockResolvedValue('mock-workflow-job-id'),
}));

vi.mock('../src/workflow-runner.js', () => ({
  registerWorkflow: vi.fn(),
  startWorkflowRunner: vi.fn(),
  stopWorkflowRunner: vi.fn(),
  createWorkflowJob: vi.fn().mockResolvedValue('mock-job-id'),
}));

// Route behavior is tested here; auth middleware behavior is covered separately.
vi.mock('../src/auth-middleware.js', () => ({
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { createApp } = await import('../src/server.js');
const app = createApp(mockOrchestrator as any);

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies).toEqual({
      engine: 'not_configured',
      anthropic: 'not_configured',
      supabase: 'not_configured',
    });
  });
});

describe('GET /status', () => {
  it('returns orchestrator state with nextCycleAt', async () => {
    const res = await request(app).get('/status');
    expect(res.status).toBe(200);
    expect(res.body.cycleCount).toBe(3);
    expect(res.body.halted).toBe(false);
    expect(res.body.nextCycleAt).toBe('2026-03-15T14:00:00.000Z');
  });
});

describe('POST /cycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLockManager.acquire.mockResolvedValue(true);
    mockLockManager.release.mockResolvedValue(true);
    mockLockManager.isHeld.mockResolvedValue(false);
    mockOrchestrator.currentState.halted = false;
  });

  it('returns 200 and fires cycle', async () => {
    const res = await request(app).post('/cycle');
    expect(res.status).toBe(200);
    expect(res.body.started).toBe(true);
    expect(mockLockManager.acquire).toHaveBeenCalledWith('agent_cycle');
  });

  it('returns 409 when halted', async () => {
    mockOrchestrator.currentState.halted = true;
    const res = await request(app).post('/cycle');
    expect(res.status).toBe(409);
    expect(mockLockManager.acquire).not.toHaveBeenCalled();
  });

  it('returns 409 when lock cannot be acquired (cycle already running)', async () => {
    mockLockManager.acquire.mockResolvedValue(false);
    const res = await request(app).post('/cycle');
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('cycle_in_progress');
  });
});

describe('POST /halt', () => {
  it('calls orchestrator.halt and returns halted=true', async () => {
    const res = await request(app).post('/halt');
    expect(res.status).toBe(200);
    expect(res.body.halted).toBe(true);
    expect(mockOrchestrator.halt).toHaveBeenCalled();
  });
});

describe('POST /resume', () => {
  it('calls orchestrator.resume and returns halted=false', async () => {
    const res = await request(app).post('/resume');
    expect(res.status).toBe(200);
    expect(res.body.halted).toBe(false);
    expect(mockOrchestrator.resume).toHaveBeenCalled();
  });
});

describe('GET /recommendations', () => {
  it('returns empty array by default', async () => {
    const res = await request(app).get('/recommendations');
    expect(res.status).toBe(200);
    expect(res.body.recommendations).toEqual([]);
  });

  it('returns 200 for each valid status value', async () => {
    const validStatuses = ['pending', 'approved', 'rejected', 'filled', 'risk_blocked', 'all'];
    for (const status of validStatuses) {
      const res = await request(app).get(`/recommendations?status=${status}`);
      expect(res.status).toBe(200);
    }
  });

  it('returns 400 for an invalid status value', async () => {
    const res = await request(app).get('/recommendations?status=invalid_status');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_status');
    expect(res.body.message).toMatch(/must be one of/);
  });
});

describe('GET /alerts', () => {
  it('returns empty array', async () => {
    const res = await request(app).get('/alerts');
    expect(res.status).toBe(200);
    expect(res.body.alerts).toEqual([]);
  });
});

describe('POST /recommendations/:id/approve', () => {
  it('returns 404 when recommendation not found', async () => {
    const { getRecommendation } = await import('../src/recommendations-store.js');
    vi.mocked(getRecommendation).mockResolvedValue(null as any);
    const res = await request(app).post('/recommendations/nonexistent/approve');
    expect(res.status).toBe(404);
  });

  it('returns 409 when recommendation is not pending (atomicApprove returns null)', async () => {
    const { getRecommendation, atomicApprove } = await import('../src/recommendations-store.js');
    vi.mocked(getRecommendation).mockResolvedValue({
      id: 'rec-1',
      ticker: 'AAPL',
      side: 'buy',
      order_type: 'market',
      quantity: 5,
    } as any);
    vi.mocked(atomicApprove).mockResolvedValue(null);
    const res = await request(app).post('/recommendations/rec-1/approve');
    expect(res.status).toBe(409);
  });
});

describe('POST /recommendations/:id/reject', () => {
  it('returns 404 with message when recommendation not found', async () => {
    const { getRecommendation } = await import('../src/recommendations-store.js');
    vi.mocked(getRecommendation).mockResolvedValue(null as any);
    const res = await request(app).post('/recommendations/nonexistent/reject');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
    expect(res.body.message).toMatch(/nonexistent/);
  });
});
