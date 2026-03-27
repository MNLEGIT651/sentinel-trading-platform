import { randomBytes } from 'node:crypto';
import { hostname } from 'node:os';
import { getSupabaseClient } from './supabase-client.js';

const DEFAULT_TTL_SECONDS = 300; // 5 min
const HEARTBEAT_INTERVAL_MS = 60_000; // 1 min

/**
 * Distributed lock manager backed by Supabase RPC functions.
 *
 * Replaces the process-local `_isRunning` flag so multiple instances
 * cannot execute concurrent agent cycles.
 */
export class LockManager {
  readonly holderId: string;
  private heartbeatTimers = new Map<string, ReturnType<typeof setInterval>>();

  constructor(holderId?: string) {
    this.holderId = holderId ?? `${hostname()}-${process.pid}-${randomBytes(4).toString('hex')}`;
  }

  /**
   * Attempt to acquire a named lock. Returns `true` on success.
   * Starts a heartbeat interval to keep the lock alive.
   */
  async acquire(lockName: string, ttlSeconds = DEFAULT_TTL_SECONDS): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('acquire_lock', {
      p_lock_name: lockName,
      p_holder_id: this.holderId,
      p_ttl_seconds: ttlSeconds,
    });

    if (error) {
      console.error(`[LockManager] acquire_lock error: ${error.message}`);
      return false;
    }

    const acquired = data === true;
    if (acquired) {
      this.startHeartbeat(lockName, ttlSeconds);
    }
    return acquired;
  }

  /**
   * Release a named lock. Stops the heartbeat.
   */
  async release(lockName: string): Promise<boolean> {
    this.stopHeartbeat(lockName);

    const client = getSupabaseClient();
    const { data, error } = await client.rpc('release_lock', {
      p_lock_name: lockName,
      p_holder_id: this.holderId,
    });

    if (error) {
      console.error(`[LockManager] release_lock error: ${error.message}`);
      return false;
    }

    return data === true;
  }

  /**
   * Check if a named lock is currently held by anyone (not expired).
   */
  async isHeld(lockName: string): Promise<boolean> {
    const client = getSupabaseClient();
    const { data, error } = await client.rpc('is_lock_held', {
      p_lock_name: lockName,
    });

    if (error) {
      console.error(`[LockManager] is_lock_held error: ${error.message}`);
      return false;
    }

    return data === true;
  }

  /**
   * Stop all active heartbeat intervals. Call on shutdown.
   */
  shutdown(): void {
    for (const [name] of this.heartbeatTimers) {
      this.stopHeartbeat(name);
    }
  }

  // ── Internal ────────────────────────────────────────────────────────

  private startHeartbeat(lockName: string, ttlSeconds: number): void {
    this.stopHeartbeat(lockName);

    const timer = setInterval(async () => {
      const client = getSupabaseClient();
      const { error } = await client.rpc('heartbeat_lock', {
        p_lock_name: lockName,
        p_holder_id: this.holderId,
        p_ttl_seconds: ttlSeconds,
      });
      if (error) {
        console.error(`[LockManager] heartbeat error: ${error.message}`);
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Don't block process exit on heartbeat timers
    if (timer.unref) timer.unref();

    this.heartbeatTimers.set(lockName, timer);
  }

  private stopHeartbeat(lockName: string): void {
    const timer = this.heartbeatTimers.get(lockName);
    if (timer) {
      clearInterval(timer);
      this.heartbeatTimers.delete(lockName);
    }
  }
}

/** Singleton lock manager for the agents process. */
let _lockManager: LockManager | null = null;

export function getLockManager(): LockManager {
  if (!_lockManager) {
    _lockManager = new LockManager();
  }
  return _lockManager;
}

export function resetLockManager(): void {
  _lockManager?.shutdown();
  _lockManager = null;
}
