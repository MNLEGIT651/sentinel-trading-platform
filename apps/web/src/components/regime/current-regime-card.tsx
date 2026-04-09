'use client';

import { Gauge, Clock } from 'lucide-react';
import type { RegimeEntry } from '@/hooks/queries';
import { getRegimeMeta } from './regime-constants';

export function CurrentRegimeCard({ entry }: { entry: RegimeEntry | null }) {
  if (!entry) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-center">
        <Gauge className="mx-auto h-8 w-8 text-zinc-600" />
        <p className="mt-2 text-sm text-zinc-400">No regime classification yet</p>
        <p className="text-xs text-zinc-600">
          Set the current market regime manually or wait for agent detection
        </p>
      </div>
    );
  }

  const meta = getRegimeMeta(entry.regime);
  const Icon = meta.icon;

  return (
    <div className={`rounded-lg border border-zinc-800 bg-zinc-900/60 p-6`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${meta.bg}`}>
            <Icon className={`h-6 w-6 ${meta.color}`} />
          </div>
          <div>
            <div className="text-xs text-zinc-500">Current Regime</div>
            <div className={`text-xl font-bold ${meta.color}`}>{meta.label}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500">Confidence</div>
          <div className="text-lg font-semibold text-zinc-200">
            {(entry.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {new Date(entry.detected_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="flex items-center gap-1">Source: {entry.source}</span>
        {entry.notes && <span>{entry.notes}</span>}
      </div>
    </div>
  );
}
