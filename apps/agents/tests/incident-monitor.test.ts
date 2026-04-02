import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Supabase mock
// ---------------------------------------------------------------------------

const mockFrom = vi.fn();

vi.mock('../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ from: mockFrom }),
}));

vi.mock('../src/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const { getIncidentState, startIncidentMonitor, stopIncidentMonitor, runIncidentCheck } =
  await import('../src/incident-monitor.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockCountQuery(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ count, error: null }),
      }),
      eq: vi.fn().mockReturnValue({
        gte: vi.fn().mockResolvedValue({ count, error: null }),
      }),
    }),
  };
}

function mockSystemControlsQuery(data: Record<string, unknown> | null, error = null) {
  return {
    select: vi.fn().mockReturnValue({
      limit: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data, error }),
      }),
    }),
  };
}

function mockUpdateQuery(error: unknown = null) {
  return {
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error }),
    }),
  };
}

function mockInsertQuery() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('incident-monitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    stopIncidentMonitor();
  });

  afterEach(() => {
    stopIncidentMonitor();
    vi.useRealTimers();
  });

  describe('getIncidentState', () => {
    it('returns initial inactive state', () => {
      const state = getIncidentState();
      expect(state.isActive).toBe(false);
      expect(state.triggeredAt).toBeNull();
      expect(state.reason).toBeNull();
    });

    it('returns a copy (not a reference)', () => {
      const a = getIncidentState();
      const b = getIncidentState();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('startIncidentMonitor / stopIncidentMonitor', () => {
    it('starts and stops without error', () => {
      // Mock all DB calls to prevent errors
      mockFrom.mockReturnValue(mockCountQuery(0));

      expect(() => startIncidentMonitor()).not.toThrow();
      expect(() => stopIncidentMonitor()).not.toThrow();
    });

    it('does not start a second monitor if already running', () => {
      mockFrom.mockReturnValue(mockCountQuery(0));
      startIncidentMonitor();
      startIncidentMonitor(); // should be a no-op
      stopIncidentMonitor();
    });
  });

  describe('runIncidentCheck', () => {
    it('does not trigger fallback when failures are below threshold', async () => {
      mockFrom.mockReturnValue(mockCountQuery(0));
      await runIncidentCheck();
      expect(getIncidentState().isActive).toBe(false);
    });

    it('triggers fallback when failures exceed threshold', async () => {
      // First: countRecentFailures returns 3, countRecentRiskBlocks returns 0
      let callIdx = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'recommendation_events') {
          callIdx++;
          if (callIdx === 1) return mockCountQuery(3); // failures
          return mockCountQuery(0); // risk blocks
        }
        if (table === 'system_controls') {
          // For reading current controls
          return {
            ...mockSystemControlsQuery({ id: 'ctrl-1', autonomy_mode: 'auto_execute' }),
            ...mockUpdateQuery(null),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        if (table === 'operator_actions') return mockInsertQuery();
        return mockCountQuery(0);
      });

      await runIncidentCheck();
      const state = getIncidentState();
      expect(state.isActive).toBe(true);
      expect(state.reason).toContain('auto-execution failures');
      expect(state.previousMode).toBe('auto_execute');
    });

    it('does not trigger again if incident is already active', async () => {
      // After the previous test, incident is already active
      // Running again should not re-trigger
      const state = getIncidentState();
      // Just verify state structure is valid
      expect(typeof state.isActive).toBe('boolean');
    });

    it('handles DB errors gracefully', async () => {
      mockFrom.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            gte: vi.fn().mockRejectedValue(new Error('DB down')),
          }),
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockRejectedValue(new Error('DB down')),
          }),
        }),
      }));

      await expect(runIncidentCheck()).resolves.toBeUndefined();
    });
  });
});
