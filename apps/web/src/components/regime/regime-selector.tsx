'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useRecordRegimeMutation } from '@/hooks/queries';
import type { MarketRegime } from '@/hooks/queries';
import { REGIMES } from './regime-constants';

export function RegimeSelector({ onClose }: { onClose: () => void }) {
  const recordMutation = useRecordRegimeMutation();
  const [selected, setSelected] = useState<MarketRegime | null>(null);
  const [confidence, setConfidence] = useState('0.7');
  const [notes, setNotes] = useState('');

  function handleSubmit() {
    if (!selected) return;
    recordMutation.mutate(
      {
        regime: selected,
        confidence: parseFloat(confidence) || 0.7,
        source: 'manual',
        notes: notes.trim() || undefined,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">Set Market Regime</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {REGIMES.map((r) => {
              const Icon = r.icon;
              return (
                <button
                  key={r.value}
                  onClick={() => setSelected(r.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${
                    selected === r.value
                      ? `${r.bg} border-current ${r.color}`
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{r.label}</span>
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">
              Confidence: {(parseFloat(confidence) * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="mt-1 w-full accent-violet-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Notes (optional)</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. VIX above 30, tech selloff"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selected || recordMutation.isPending}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {recordMutation.isPending ? 'Saving\u2026' : 'Set Regime'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
