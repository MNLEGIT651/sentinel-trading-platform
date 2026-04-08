import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  agentsClient,
  AgentsApiError,
  type OrchestratorStatus,
  type TradeRecommendation,
  type AgentAlert,
} from '@/lib/agents-client';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(body: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(body),
  });
}

function mockError(status: number, body: unknown = { error: 'Server error' }) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Error',
    json: () => Promise.resolve(body),
  });
}

const statusFixture: OrchestratorStatus = {
  agents: {
    market_sentinel: { status: 'idle', lastRun: null },
    strategy_analyst: { status: 'running', lastRun: '2026-01-01T00:00:00Z' },
  },
  cycleCount: 5,
  halted: false,
  isRunning: true,
  nextCycleAt: '2026-01-01T00:15:00Z',
  lastCycleAt: '2026-01-01T00:00:00Z',
};

const recommendationFixture: TradeRecommendation = {
  id: 'rec-1',
  created_at: '2026-01-01T00:00:00Z',
  agent_role: 'strategy_analyst',
  ticker: 'AAPL',
  side: 'buy',
  quantity: 10,
  order_type: 'market',
  status: 'pending',
};

const alertFixture: AgentAlert = {
  id: 'alert-1',
  created_at: '2026-01-01T00:00:00Z',
  severity: 'warning',
  title: 'Volatility spike',
  message: 'VIX > 30',
  acknowledged: false,
};

// ---------------------------------------------------------------------------
// AgentsApiError
// ---------------------------------------------------------------------------

describe('AgentsApiError', () => {
  it('stores status and body', () => {
    const err = new AgentsApiError('Something failed', 404, { error: 'Not found' });
    expect(err.status).toBe(404);
    expect(err.body).toEqual({ error: 'Not found' });
    expect(err.name).toBe('AgentsApiError');
    expect(err.message).toBe('Something failed');
  });

  it('is instance of Error', () => {
    const err = new AgentsApiError('fail', 500, {});
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// agentsClient.getStatus
// ---------------------------------------------------------------------------

describe('agentsClient.getStatus', () => {
  beforeEach(() => mockFetch.mockReset());

  it('calls /api/agents/status and returns orchestrator status', async () => {
    mockFetch.mockReturnValue(mockOk(statusFixture));
    const result = await agentsClient.getStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/status',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(result.cycleCount).toBe(5);
    expect(result.halted).toBe(false);
  });

  it('throws AgentsApiError on non-ok response', async () => {
    mockFetch.mockReturnValue(mockError(503));
    await expect(agentsClient.getStatus()).rejects.toBeInstanceOf(AgentsApiError);
  });
});

// ---------------------------------------------------------------------------
// agentsClient.runCycle
// ---------------------------------------------------------------------------

describe('agentsClient.runCycle', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs to /api/agents/cycle', async () => {
    mockFetch.mockReturnValue(mockOk({ started: true }));
    await agentsClient.runCycle();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/cycle',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(mockError(500));
    await expect(agentsClient.runCycle()).rejects.toBeInstanceOf(AgentsApiError);
  });
});

// ---------------------------------------------------------------------------
// agentsClient.halt / resume
// ---------------------------------------------------------------------------

describe('agentsClient.halt', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs to /api/agents/halt', async () => {
    mockFetch.mockReturnValue(mockOk({ halted: true }));
    await agentsClient.halt();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/halt',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

describe('agentsClient.resume', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs to /api/agents/resume', async () => {
    mockFetch.mockReturnValue(mockOk({ halted: false }));
    await agentsClient.resume();
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/resume',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ---------------------------------------------------------------------------
// agentsClient.getRecommendations
// ---------------------------------------------------------------------------

describe('agentsClient.getRecommendations', () => {
  beforeEach(() => mockFetch.mockReset());

  it('fetches pending recommendations by default', async () => {
    mockFetch.mockReturnValue(mockOk({ recommendations: [recommendationFixture] }));
    const result = await agentsClient.getRecommendations();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/recommendations?status=pending',
      expect.any(Object),
    );
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0]?.ticker).toBe('AAPL');
  });

  it('allows filtering by status', async () => {
    mockFetch.mockReturnValue(mockOk({ recommendations: [] }));
    await agentsClient.getRecommendations('filled');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/recommendations?status=filled',
      expect.any(Object),
    );
  });

  it('supports "all" status filter', async () => {
    mockFetch.mockReturnValue(mockOk({ recommendations: [recommendationFixture] }));
    await agentsClient.getRecommendations('all');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/recommendations?status=all',
      expect.any(Object),
    );
  });
});

// ---------------------------------------------------------------------------
// agentsClient.approveRecommendation / rejectRecommendation
// ---------------------------------------------------------------------------

describe('agentsClient.approveRecommendation', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs to approve endpoint with recommendation id', async () => {
    mockFetch.mockReturnValue(mockOk({ orderId: 'ord-99', status: 'filled', fill_price: 182.5 }));
    const result = await agentsClient.approveRecommendation('rec-1');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/recommendations/rec-1/approve',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.orderId).toBe('ord-99');
  });
});

describe('agentsClient.rejectRecommendation', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs to reject endpoint', async () => {
    mockFetch.mockReturnValue(mockOk({ status: 'rejected' }));
    const result = await agentsClient.rejectRecommendation('rec-2');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/agents/recommendations/rec-2/reject',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.status).toBe('rejected');
  });
});

// ---------------------------------------------------------------------------
// agentsClient.getAlerts
// ---------------------------------------------------------------------------

describe('agentsClient.getAlerts', () => {
  beforeEach(() => mockFetch.mockReset());

  it('fetches first page of alerts from /api/agents/alerts', async () => {
    mockFetch.mockReturnValue(
      mockOk({
        alerts: [alertFixture],
        nextCursor: { lastCreatedAt: alertFixture.created_at, lastId: alertFixture.id },
      }),
    );
    const result = await agentsClient.getAlerts();

    expect(mockFetch).toHaveBeenCalledWith('/api/agents/alerts', expect.any(Object));
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]?.title).toBe('Volatility spike');
    expect(result.nextCursor).toEqual({
      lastCreatedAt: '2026-01-01T00:00:00Z',
      lastId: 'alert-1',
    });
  });

  it('passes cursor params as query string', async () => {
    mockFetch.mockReturnValue(mockOk({ alerts: [], nextCursor: null }));
    await agentsClient.getAlerts({
      limit: 25,
      cursor: { lastCreatedAt: '2026-01-01T00:00:00Z', lastId: 'alert-1' },
    });

    const [url] = mockFetch.mock.calls[0] as [string, unknown];
    expect(url).toContain('/api/agents/alerts?');
    expect(url).toContain('limit=25');
    expect(url).toContain('lastCreatedAt=2026-01-01T00%3A00%3A00Z');
    expect(url).toContain('lastId=alert-1');
  });

  it('returns null nextCursor on last page', async () => {
    mockFetch.mockReturnValue(mockOk({ alerts: [alertFixture], nextCursor: null }));
    const result = await agentsClient.getAlerts();
    expect(result.nextCursor).toBeNull();
  });

  it('omits query string when no params provided', async () => {
    mockFetch.mockReturnValue(mockOk({ alerts: [], nextCursor: null }));
    await agentsClient.getAlerts();
    const [url] = mockFetch.mock.calls[0] as [string, unknown];
    expect(url).toBe('/api/agents/alerts');
  });

  it('throws AgentsApiError on 401 response', async () => {
    mockFetch.mockReturnValue(mockError(401, { error: 'Unauthorized' }));
    await expect(agentsClient.getAlerts()).rejects.toBeInstanceOf(AgentsApiError);
  });

  it('includes status code in AgentsApiError', async () => {
    mockFetch.mockReturnValue(mockError(429, { error: 'Rate limited' }));
    const error = await agentsClient.getAlerts().catch((e) => e);
    expect(error).toBeInstanceOf(AgentsApiError);
    expect((error as AgentsApiError).status).toBe(429);
  });

  it('falls back to statusText when error response json fails', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () => Promise.reject(new Error('not json')),
      }),
    );
    const error = await agentsClient.getAlerts().catch((e) => e);
    expect(error).toBeInstanceOf(AgentsApiError);
    expect(error.message).toContain('503');
  });
});
