'use client';

import { useState } from 'react';
import { Gauge, Plus, Play, Shield } from 'lucide-react';
import {
  useRegimeStateQuery,
  usePlaybooksQuery,
  useDeletePlaybookMutation,
  useTogglePlaybookMutation,
} from '@/hooks/queries';
import type { RegimePlaybook } from '@/hooks/queries';
import {
  CurrentRegimeCard,
  RegimeSelector,
  PlaybookCard,
  CreatePlaybookDialog,
  RegimeTimeline,
  REGIMES,
} from '@/components/regime';

// ── Page ─────────────────────────────────────────────────────────────────────

export default function RegimePage() {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: regimeState, isLoading: regimeLoading } = useRegimeStateQuery();
  const { data: playbooks, isLoading: playbooksLoading } = usePlaybooksQuery();
  const deleteMutation = useDeletePlaybookMutation();
  const toggleMutation = useTogglePlaybookMutation();

  const isLoading = regimeLoading || playbooksLoading;

  // Group playbooks by regime
  const playbooksByRegime: Record<string, RegimePlaybook[]> = {};
  for (const pb of playbooks ?? []) {
    const list = playbooksByRegime[pb.regime];
    if (list) {
      list.push(pb);
    } else {
      playbooksByRegime[pb.regime] = [pb];
    }
  }

  function confirmDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Gauge className="h-6 w-6 text-violet-400" />
            <h1 className="text-heading-page text-zinc-100">Regime Detection</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Classify the market regime and manage strategy playbooks for each condition.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
          >
            <Gauge className="h-4 w-4" />
            Set Regime
          </button>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            New Playbook
          </button>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-violet-800/30 bg-violet-950/20 p-3">
        <Shield className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
        <div className="text-xs text-violet-300/80">
          Each regime has playbooks that control which strategies are active, how positions are
          sized, and what risk limits apply. When the regime changes, the matching playbook
          automatically adjusts the trading posture.
        </div>
      </div>

      {isLoading && (
        <div className="py-12 text-center text-sm text-zinc-500">Loading regime data…</div>
      )}

      {!isLoading && (
        <>
          {/* Current regime + history */}
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <CurrentRegimeCard entry={regimeState?.current ?? null} />
              {regimeState?.active_playbook && (
                <div className="mt-3 flex items-center gap-2 rounded border border-emerald-800/30 bg-emerald-950/20 p-3 text-xs text-emerald-300/80">
                  <Play className="h-3.5 w-3.5 shrink-0" />
                  Active playbook: <strong>{regimeState.active_playbook.name}</strong>
                  {regimeState.active_playbook.position_size_modifier !== 1.0 && (
                    <span>
                      · Size modifier: {regimeState.active_playbook.position_size_modifier}×
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
              <RegimeTimeline history={regimeState?.history ?? []} />
            </div>
          </div>

          {/* Playbooks by regime */}
          <div>
            <h2 className="mb-3 text-lg font-semibold text-zinc-200">Playbooks</h2>

            {(!playbooks || playbooks.length === 0) && (
              <div className="py-12 text-center">
                <Shield className="mx-auto h-10 w-10 text-zinc-600" />
                <p className="mt-3 text-sm text-zinc-400">No playbooks configured</p>
                <p className="text-xs text-zinc-600">
                  Create playbooks to automatically adjust strategy and risk behavior per regime.
                </p>
                <button
                  onClick={() => setCreateOpen(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
                >
                  <Plus className="h-4 w-4" />
                  Create Playbook
                </button>
              </div>
            )}

            {playbooks && playbooks.length > 0 && (
              <div className="space-y-4">
                {REGIMES.map((r) => {
                  const pbs = playbooksByRegime[r.value];
                  if (!pbs || pbs.length === 0) return null;

                  return (
                    <div key={r.value}>
                      <div
                        className={`mb-2 flex items-center gap-1.5 text-sm font-medium ${r.color}`}
                      >
                        <r.icon className="h-4 w-4" />
                        {r.label} Regime
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {pbs.map((pb) => (
                          <PlaybookCard
                            key={pb.id}
                            playbook={pb}
                            onDelete={setDeleteId}
                            onToggle={(id, active) =>
                              toggleMutation.mutate({ id, is_active: active })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* Dialogs */}
      {selectorOpen && <RegimeSelector onClose={() => setSelectorOpen(false)} />}
      <CreatePlaybookDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100">Delete Playbook</h3>
            <p className="mt-2 text-sm text-zinc-400">
              This will permanently delete this playbook. This cannot be undone.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteId(null)}
                className="rounded px-4 py-2 text-sm text-zinc-400 hover:text-zinc-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
