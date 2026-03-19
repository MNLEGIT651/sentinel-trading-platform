'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/app-store';

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000';
const AGENTS_URL = process.env.NEXT_PUBLIC_AGENTS_URL ?? 'http://localhost:3001';
const POLL_INTERVAL = 15_000;

async function checkEngine(): Promise<boolean> {
  try {
    const res = await fetch(`${ENGINE_URL}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkAgents(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENTS_URL}/health`, {
      signal: AbortSignal.timeout(4000),
    });
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
      setAgentsOnline(agents);
    }

    probe();
    intervalRef.current = setInterval(probe, POLL_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [setEngineOnline, setAgentsOnline]);
}
