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

const { createApp } = await import('../src/server.js');
const app = createApp(mockOrchestrator as any);

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.dependencies).toEqual({
      engine: false,
      anthropic: false,
      supabase: false,
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
  beforeEach(() => vi.clearAllMocks());

  it('returns 200 and fires cycle', async () => {
    const res = await request(app).post('/cycle');
    expect(res.status).toBe(200);
    expect(res.body.started).toBe(true);
  });

  it('returns 409 when halted', async () => {
    mockOrchestrator.currentState.halted = true;
    const res = await request(app).post('/cycle');
    expect(res.status).toBe(409);
    mockOrchestrator.currentState.halted = false;
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
  it('returns 404 when recommendation not found', async () => {
    const { getRecommendation } = await import('../src/recommendations-store.js');
    vi.mocked(getRecommendation).mockResolvedValue(null as any);
    const res = await request(app).post('/recommendations/nonexistent/reject');
    expect(res.status).toBe(404);
  });
});
