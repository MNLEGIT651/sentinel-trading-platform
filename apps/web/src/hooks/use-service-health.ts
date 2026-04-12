'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';

const ENGINE_HEALTH_URL = '/api/engine/health';
const AGENTS_HEALTH_URL = '/api/agents/health';
const BASE_INTERVAL = 15_000;
const MAX_INTERVAL = 60_000;

async function checkEngine(): Promise<boolean> {
  try {
    const res = await fetch(ENGINE_HEALTH_URL, {
      signal: AbortSignal.timeout(4000),
    });
    // 200 = healthy, 503 = degraded but alive — engine is online either way.
    // Only network errors / timeouts (caught below) mean truly offline.
    return res.ok || res.status === 503;
  } catch {
    return false;
  }
}

async function checkAgents(): Promise<boolean | null> {
  try {
    const res = await fetch(AGENTS_HEALTH_URL, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (res.status === 503) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === 'not_configured') {
        return typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? null
          : false;
      }
      // 503 without not_configured means degraded but alive
      return true;
    }
    return res.ok;
  } catch {
    return false;
  }
}

async function readHealth(): Promise<{ engine: boolean | null; agents: boolean | null }> {
  try {
    const [engine, agents] = await Promise.all([checkEngine(), checkAgents()]);
    return { engine, agents };
  } catch {
    return { engine: false, agents: false };
  }
}

/**
 * Polls engine and agents health with exponential backoff.
 * Starts at 15s, backs off to 60s when services are down, resets on recovery.
 * Mount once in the app shell — all pages read from the store.
 */
export function useServiceHealth() {
  const setEngineOnline = useAppStore((s) => s.setEngineOnline);
  const setAgentsOnline = useAppStore((s) => s.setAgentsOnline);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef(BASE_INTERVAL);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      const { engine, agents } = await readHealth();
      if (cancelled) return;

      setEngineOnline(engine);
      setAgentsOnline(agents);

      // Back off when services are down, reset when healthy
      const allHealthy =
        (engine === true || engine === null) && (agents === true || agents === null);

      if (allHealthy) {
        intervalRef.current = BASE_INTERVAL;
      } else {
        intervalRef.current = Math.min(intervalRef.current * 2, MAX_INTERVAL);
      }

      timerRef.current = setTimeout(probe, intervalRef.current);
    }

    probe();
    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [setEngineOnline, setAgentsOnline]);
}
