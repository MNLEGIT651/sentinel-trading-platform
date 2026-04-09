'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useCreatePlaybookMutation } from '@/hooks/queries';
import type { MarketRegime } from '@/hooks/queries';
import { REGIMES, STRATEGY_FAMILIES, formatStrategy } from './regime-constants';

export function CreatePlaybookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreatePlaybookMutation();
  const [name, setName] = useState('');
  const [regime, setRegime] = useState<MarketRegime>('bull');
  const [description, setDescription] = useState('');
  const [enabledStrategies, setEnabledStrategies] = useState<string[]>([]);
  const [positionSizeModifier, setPositionSizeModifier] = useState('1.0');
  const [maxPositionPct, setMaxPositionPct] = useState('');

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    createMutation.mutate(
      {
        name: name.trim(),
        regime,
        description: description.trim() || undefined,
        enabled_strategies: enabledStrategies.length > 0 ? enabledStrategies : undefined,
        position_size_modifier: parseFloat(positionSizeModifier) || 1.0,
        max_position_pct: maxPositionPct ? parseFloat(maxPositionPct) : undefined,
      },
      {
        onSuccess: () => {
          onClose();
          setName('');
          setDescription('');
          setEnabledStrategies([]);
          setPositionSizeModifier('1.0');
          setMaxPositionPct('');
        },
      },
    );
  }

  function toggleStrategy(s: string) {
    setEnabledStrategies((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">New Playbook</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label className="text-xs font-medium text-zinc-400">Name *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Bear Defensive"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Target Regime *</label>
            <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {REGIMES.map((r) => {
                const RIcon = r.icon;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRegime(r.value)}
                    className={`flex flex-col items-center gap-1 rounded border p-2 text-xs transition-colors ${
                      regime === r.value
                        ? `${r.bg} border-current ${r.color}`
                        : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                    }`}
                  >
                    <RIcon className="h-4 w-4" />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What strategy this playbook applies"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-zinc-400">Position Size Modifier</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                max="3.0"
                value={positionSizeModifier}
                onChange={(e) => setPositionSizeModifier(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              />
              <div className="mt-0.5 text-xs text-zinc-600">1.0 = normal, 0.5 = half</div>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Max Position %</label>
              <input
                type="number"
                step="0.5"
                value={maxPositionPct}
                onChange={(e) => setMaxPositionPct(e.target.value)}
                placeholder="Inherit"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">
              Enabled Strategies <span className="text-zinc-600">(empty = all)</span>
            </label>
            <div className="mt-2 space-y-2">
              {Object.entries(STRATEGY_FAMILIES).map(([family, strategies]) => (
                <div key={family}>
                  <div className="text-xs text-zinc-500">{family}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {strategies.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStrategy(s)}
                        className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                          enabledStrategies.includes(s)
                            ? 'bg-violet-500/25 text-violet-300 ring-1 ring-violet-500/40'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {formatStrategy(s)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {createMutation.error && (
            <div className="rounded border border-red-800/40 bg-red-950/20 p-2 text-xs text-red-400">
              {createMutation.error.message}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createMutation.isPending}
              className="rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating\u2026' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
