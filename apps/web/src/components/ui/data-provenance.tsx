'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface DataProvenanceProps {
  mode: 'live' | 'cached' | 'simulated' | 'offline';
  lastUpdated?: Date | string | null;
  /** Milliseconds before live data is considered stale. Default 60 000 (1 min). */
  staleThresholdMs?: number;
  className?: string;
}

const MODE_CONFIG = {
  live: { dot: 'bg-emerald-400', text: 'text-emerald-400', label: 'Live' },
  cached: { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Cached' },
  simulated: { dot: 'bg-amber-400', text: 'text-amber-400', label: 'Simulated' },
  offline: { dot: 'bg-red-400', text: 'text-red-400', label: 'Offline' },
} as const;

function formatAge(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function parseDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function DataProvenance({
  mode,
  lastUpdated,
  staleThresholdMs = 60_000,
  className,
}: DataProvenanceProps) {
  const parsedDate = useMemo(() => parseDate(lastUpdated), [lastUpdated]);

  const [ageMs, setAgeMs] = useState<number | null>(null);

  useEffect(() => {
    const compute = () => {
      if (!parsedDate) {
        setAgeMs(null);
      } else {
        setAgeMs(Date.now() - parsedDate.getTime());
      }
    };
    // Deferred initial computation (timer callback satisfies react-hooks/set-state-in-effect)
    const timeoutId = setTimeout(compute, 0);
    const intervalId = parsedDate ? setInterval(compute, 10_000) : undefined;
    return () => {
      clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
    };
  }, [parsedDate]);

  const isStale = mode === 'live' && ageMs !== null && ageMs > staleThresholdMs;

  const effectiveMode = isStale ? 'cached' : mode;
  const config = MODE_CONFIG[effectiveMode];

  const detail = useMemo(() => {
    if (effectiveMode === 'live' && parsedDate) {
      return parsedDate.toLocaleTimeString();
    }
    if ((effectiveMode === 'cached' || isStale) && ageMs !== null) {
      return formatAge(ageMs);
    }
    return null;
  }, [effectiveMode, parsedDate, ageMs, isStale]);

  const ariaLabel = [
    `Data source: ${config.label}`,
    isStale ? '(stale)' : null,
    detail ? `— ${detail}` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <span
      role="status"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
        effectiveMode === 'live' && 'border-emerald-500/30 bg-emerald-500/15',
        effectiveMode === 'cached' && 'border-yellow-500/30 bg-yellow-500/15',
        effectiveMode === 'simulated' && 'border-amber-500/30 bg-amber-500/15',
        effectiveMode === 'offline' && 'border-red-500/30 bg-red-500/15',
        className,
      )}
    >
      <span className={cn('inline-block h-1.5 w-1.5 rounded-full', config.dot)} />
      <span className={config.text}>
        {config.label}
        {isStale && ' (stale)'}
      </span>
      {detail && <span className={cn(config.text, 'opacity-70')}>· {detail}</span>}
    </span>
  );
}
