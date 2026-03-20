'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';

const ENGINE_HEALTH_URL = '/api/engine/health';
const AGENTS_HEALTH_URL = '/api/agents/health';
const POLL_INTERVAL = 15_000;

async function checkEngine(): Promise<boolean> {
  try {
    const res = await fetch(ENGINE_HEALTH_URL, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkAgents(): Promise<boolean | null> {
  try {
    const res = await fetch(AGENTS_HEALTH_URL, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.status === 503) {
      const body = (await res.json().catch(() => null)) as { code?: string } | null;
      if (body?.code === 'not_configured') {
        return typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? null
          : false;
      }
    }
    return res.ok;
  } catch {
    return false;
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
      const [engine, agents] = await Promise.all([checkEngine(), checkAgents()]);
      setEngineOnline(engine);
      // null = intentionally unconfigured in local development → hide the banner
      setAgentsOnline(agents);
    }

    probe();
    intervalRef.current = setInterval(probe, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setEngineOnline, setAgentsOnline]);
}
