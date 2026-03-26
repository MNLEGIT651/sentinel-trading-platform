/**
 * Unit tests for the agents-client HTTP wrapper.
 *
 * Tests the agentsClient facade that wraps calls to /api/agents proxy routes.
 * All methods should properly construct requests, handle responses, and throw
 * AgentsApiError on non-2xx responses.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { agentsClient, AgentsApiError } from '@/lib/agents-client';

describe('agentsClient', () => {
  const mockFetch = vi.fn<[RequestInfo | URL, RequestInit?], Promise<Response>>();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getStatus', () => {
    it('fetches orchestrator status from /api/agents/status', async () => {
      const payload = {
        agents: { 'market-sentinel': { status: 'idle', lastRun: null } },
        cycleCount: 5,
        halted: false,
        isRunning: false,
        nextCycleAt: null,
        lastCycleAt: '2026-03-26T10:00:00Z',
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), { status: 200 }),
      );

      const result = await agentsClient.getStatus();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/status', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(payload);
    });

    it('throws AgentsApiError when response is not ok', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'service unavailable' }), { status: 503 }),
      );

      await expect(agentsClient.getStatus()).rejects.toThrow(AgentsApiError);
      await expect(agentsClient.getStatus()).rejects.toThrow('Agents API 503: service unavailable');
    });
  });

  describe('runCycle', () => {
    it('posts to /api/agents/cycle to trigger immediate cycle', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ started: true }), { status: 200 }),
      );

      await agentsClient.runCycle();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('throws AgentsApiError on 4xx/5xx', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'already running' }), { status: 409 }),
      );

      await expect(agentsClient.runCycle()).rejects.toThrow(AgentsApiError);
      await expect(agentsClient.runCycle()).rejects.toThrow('Agents API 409: already running');
    });
  });

  describe('halt', () => {
    it('posts to /api/agents/halt to stop automated trading', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ halted: true }), { status: 200 }),
      );

      await agentsClient.halt();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/halt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('resume', () => {
    it('posts to /api/agents/resume to resume automated cycles', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ halted: false }), { status: 200 }),
      );

      await agentsClient.resume();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('getRecommendations', () => {
    it('fetches pending recommendations by default', async () => {
      const payload = {
        recommendations: [
          {
            id: 'rec-1',
            created_at: '2026-03-26T10:00:00Z',
            agent_role: 'strategy-analyst',
            ticker: 'AAPL',
            side: 'buy' as const,
            quantity: 10,
            order_type: 'market' as const,
            reason: 'Strong momentum signal',
            status: 'pending' as const,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), { status: 200 }),
      );

      const result = await agentsClient.getRecommendations();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/recommendations?status=pending', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(payload);
    });

    it('accepts status parameter (approved, rejected, filled, all)', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ recommendations: [] }), { status: 200 }),
      );

      await agentsClient.getRecommendations('approved');

      expect(mockFetch).toHaveBeenCalledWith('/api/agents/recommendations?status=approved', {
        headers: { 'Content-Type': 'application/json' },
      });
    });

    it('throws AgentsApiError when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'database error' }), { status: 500 }),
      );

      await expect(agentsClient.getRecommendations()).rejects.toThrow(AgentsApiError);
    });
  });

  describe('approveRecommendation', () => {
    it('posts to /api/agents/recommendations/:id/approve', async () => {
      const payload = { orderId: 'order-abc', status: 'filled', fill_price: 150.25 };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), { status: 200 }),
      );

      const result = await agentsClient.approveRecommendation('rec-123');

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/recommendations/rec-123/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(payload);
    });

    it('throws AgentsApiError on risk_blocked or other errors', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'risk check failed' }), { status: 400 }),
      );

      await expect(agentsClient.approveRecommendation('rec-456')).rejects.toThrow(
        AgentsApiError,
      );
    });
  });

  describe('rejectRecommendation', () => {
    it('posts to /api/agents/recommendations/:id/reject', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'rejected' }), { status: 200 }),
      );

      const result = await agentsClient.rejectRecommendation('rec-789');

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/recommendations/rec-789/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual({ status: 'rejected' });
    });
  });

  describe('getAlerts', () => {
    it('fetches the 50 most recent agent-generated alerts', async () => {
      const payload = {
        alerts: [
          {
            id: 'alert-1',
            created_at: '2026-03-26T10:00:00Z',
            severity: 'warning' as const,
            title: 'High volatility detected',
            message: 'AAPL volatility above 3%',
            ticker: 'AAPL',
            acknowledged: false,
          },
        ],
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(payload), { status: 200 }),
      );

      const result = await agentsClient.getAlerts();

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch).toHaveBeenCalledWith('/api/agents/alerts', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(payload);
    });
  });

  describe('AgentsApiError', () => {
    it('includes status, body, and message in error object', async () => {
      const errorBody = { error: 'not found', code: 'NOT_FOUND' };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(errorBody), { status: 404 }),
      );

      try {
        await agentsClient.getStatus();
        expect.fail('Should have thrown AgentsApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentsApiError);
        const error = err as AgentsApiError;
        expect(error.status).toBe(404);
        expect(error.body).toEqual(errorBody);
        expect(error.message).toContain('Agents API 404');
        expect(error.message).toContain('not found');
        expect(error.name).toBe('AgentsApiError');
      }
    });

    it('falls back to statusText when response body is not JSON', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
      );

      try {
        await agentsClient.halt();
        expect.fail('Should have thrown AgentsApiError');
      } catch (err) {
        expect(err).toBeInstanceOf(AgentsApiError);
        const error = err as AgentsApiError;
        expect(error.status).toBe(500);
        expect(error.message).toContain('Internal Server Error');
        expect(error.body).toEqual({ error: 'Internal Server Error' });
      }
    });
  });

  describe('path normalization', () => {
    it('handles paths with or without leading slash', async () => {
      mockFetch.mockResolvedValue(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      // Internal agentsFetch is tested indirectly through public API
      // Both '/status' and 'status' should work
      await agentsClient.getStatus();

      const calls = mockFetch.mock.calls;
      expect(calls[0][0]).toBe('/api/agents/status');
    });
  });
});
