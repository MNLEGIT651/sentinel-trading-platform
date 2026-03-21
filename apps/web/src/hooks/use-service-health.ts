'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';

const HEALTH_URL = '/api/health';
const POLL_INTERVAL = 15_000;

interface HealthResponse {
  dependencies?: {
    engine?: 'connected' | 'disconnected' | 'not_configured';
    agents?: 'connected' | 'disconnected' | 'not_configured';
  };
}

async function readHealth(): Promise<{ engine: boolean | null; agents: boolean | null }> {
  try {
    const res = await fetch(HEALTH_URL, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { engine: false, agents: false };
    }

    const body = (await res.json().catch(() => ({}))) as HealthResponse;
    const engine =
      body.dependencies?.engine === 'connected'
        ? true
        : body.dependencies?.engine === 'not_configured'
          ? false
          : false;
    const agents =
      body.dependencies?.agents === 'connected'
        ? true
        : body.dependencies?.agents === 'not_configured'
          ? typeof window !== 'undefined' && window.location.hostname === 'localhost'
            ? null
            : false
          : false;

    return { engine, agents };
  } catch {
    return { engine: false, agents: false };
  }
}

/**
 * Polls engine and agents health every 15s and writes to Zustand.
 * Mount once in the app shell — all pages read from the store.
 */
export function useServiceHealth() {
  const setEngineOnline = useAppStore((s) => s.setEngineOnline);
  const setAgentsOnline = useAppStore((s) => s.setAgentsOnline);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function probe() {
      const { engine, agents } = await readHealth();
      setEngineOnline(engine);
      setAgentsOnline(agents);
    }

    probe();
    intervalRef.current = setInterval(probe, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setEngineOnline, setAgentsOnline]);
}
