// apps/agents/tests/lock-manager.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LockManager, resetLockManager } from '../src/lock-manager.js';

// Mock Supabase client
const mockRpc = vi.fn();

vi.mock('../src/supabase-client.js', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc }),
  resetSupabaseClient: vi.fn(),
}));

describe('LockManager', () => {
  let manager: LockManager;

  beforeEach(() => {
    vi.clearAllMocks();
    resetLockManager();
    manager = new LockManager('test-holder-1');
  });

  afterEach(() => {
    manager.shutdown();
  });

  describe('acquire', () => {
    it('returns true when lock is acquired', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await manager.acquire('agent_cycle');
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('acquire_lock', {
        p_lock_name: 'agent_cycle',
        p_holder_id: 'test-holder-1',
        p_ttl_seconds: 300,
      });
    });

    it('returns false when lock is not acquired', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });
      const result = await manager.acquire('agent_cycle');
      expect(result).toBe(false);
    });

    it('returns false on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'connection refused' },
      });
      const result = await manager.acquire('agent_cycle');
      expect(result).toBe(false);
    });

    it('accepts custom TTL', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      await manager.acquire('agent_cycle', 60);
      expect(mockRpc).toHaveBeenCalledWith('acquire_lock', {
        p_lock_name: 'agent_cycle',
        p_holder_id: 'test-holder-1',
        p_ttl_seconds: 60,
      });
    });
  });

  describe('release', () => {
    it('returns true when lock is released', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await manager.release('agent_cycle');
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('release_lock', {
        p_lock_name: 'agent_cycle',
        p_holder_id: 'test-holder-1',
      });
    });

    it('returns false when lock was not held', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });
      const result = await manager.release('agent_cycle');
      expect(result).toBe(false);
    });

    it('returns false on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'timeout' },
      });
      const result = await manager.release('agent_cycle');
      expect(result).toBe(false);
    });
  });

  describe('isHeld', () => {
    it('returns true when lock exists and not expired', async () => {
      mockRpc.mockResolvedValue({ data: true, error: null });
      const result = await manager.isHeld('agent_cycle');
      expect(result).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith('is_lock_held', {
        p_lock_name: 'agent_cycle',
      });
    });

    it('returns false when lock is not held', async () => {
      mockRpc.mockResolvedValue({ data: false, error: null });
      const result = await manager.isHeld('agent_cycle');
      expect(result).toBe(false);
    });

    it('returns false on RPC error', async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: 'connection error' },
      });
      const result = await manager.isHeld('agent_cycle');
      expect(result).toBe(false);
    });
  });

  describe('holderId', () => {
    it('uses provided holderId', () => {
      const m = new LockManager('custom-id');
      expect(m.holderId).toBe('custom-id');
      m.shutdown();
    });

    it('auto-generates holderId when not provided', () => {
      const m = new LockManager();
      expect(m.holderId).toMatch(/^.+-\d+-[0-9a-f]{8}$/);
      m.shutdown();
    });
  });

  describe('shutdown', () => {
    it('clears all heartbeat timers', async () => {
      // Acquire two locks to start heartbeats
      mockRpc.mockResolvedValue({ data: true, error: null });
      await manager.acquire('lock_a');
      await manager.acquire('lock_b');

      // Shutdown should not throw
      manager.shutdown();
    });
  });
});
