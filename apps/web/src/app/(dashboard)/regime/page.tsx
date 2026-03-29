'use client';

import { useState } from 'react';
import {
  Gauge,
  Plus,
  Trash2,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Minus,
  AlertTriangle,
  Flame,
  X,
  Clock,
  Shield,
} from 'lucide-react';
import {
  useRegimeStateQuery,
  useRecordRegimeMutation,
  usePlaybooksQuery,
  useCreatePlaybookMutation,
  useDeletePlaybookMutation,
  useTogglePlaybookMutation,
} from '@/hooks/queries';
import type { MarketRegime, RegimePlaybook, RegimeEntry } from '@/hooks/queries';

// ── Constants ───────────────────────────────────────────────────────────────

const REGIMES: {
  value: MarketRegime;
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}[] = [
  {
    value: 'bull',
    label: 'Bull',
    icon: TrendingUp,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15',
  },
  { value: 'bear', label: 'Bear', icon: TrendingDown, color: 'text-red-400', bg: 'bg-red-500/15' },
  {
    value: 'sideways',
    label: 'Sideways',
    icon: Minus,
    color: 'text-zinc-400',
    bg: 'bg-zinc-500/15',
  },
  {
    value: 'volatile',
    label: 'Volatile',
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-500/15',
  },
  { value: 'crisis', label: 'Crisis', icon: Flame, color: 'text-red-500', bg: 'bg-red-600/15' },
];

const STRATEGY_FAMILIES: Record<string, string[]> = {
  'Trend Following': ['sma_crossover', 'ema_momentum_trend', 'macd_trend'],
  Momentum: ['rsi_momentum', 'roc_momentum', 'obv_divergence'],
  'Mean Reversion': ['bollinger_reversion', 'zscore_reversion', 'rsi_mean_reversion'],
  Value: ['price_to_ma_value', 'relative_value'],
  Pairs: ['pairs_spread'],
};

function formatStrategy(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

const SIDEWAYS_META = {
  value: 'sideways' as const,
  label: 'Sideways',
  icon: Minus,
  color: 'text-zinc-400',
  bg: 'bg-zinc-500/15',
};

function getRegimeMeta(regime: MarketRegime) {
  return REGIMES.find((r) => r.value === regime) ?? SIDEWAYS_META;
}

// ── Current Regime Display ──────────────────────────────────────────────────

function CurrentRegimeCard({ entry }: { entry: RegimeEntry | null }) {
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

// ── Regime Selector ─────────────────────────────────────────────────────────

function RegimeSelector({ onClose }: { onClose: () => void }) {
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
          <div className="grid grid-cols-5 gap-2">
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
              {recordMutation.isPending ? 'Saving…' : 'Set Regime'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Playbook Card ───────────────────────────────────────────────────────────

function PlaybookCard({
  playbook,
  onDelete,
  onToggle,
}: {
  playbook: RegimePlaybook;
  onDelete: (id: string) => void;
  onToggle: (id: string, active: boolean) => void;
}) {
  const meta = getRegimeMeta(playbook.regime);
  const Icon = meta.icon;
  const enabled = playbook.enabled_strategies ?? [];
  const disabled = playbook.disabled_strategies ?? [];
  const weights = playbook.strategy_weights ?? {};
  const weightCount = Object.keys(weights).length;

  const overrides = [
    playbook.max_position_pct != null && `Position: ${playbook.max_position_pct}%`,
    playbook.max_sector_pct != null && `Sector: ${playbook.max_sector_pct}%`,
    playbook.daily_loss_limit_pct != null && `Daily Loss: ${playbook.daily_loss_limit_pct}%`,
    playbook.position_size_modifier !== 1.0 && `Size: ${playbook.position_size_modifier}×`,
  ].filter(Boolean);

  return (
    <div
      className={`rounded-lg border bg-zinc-900/60 p-4 transition-colors ${
        playbook.is_active ? 'border-zinc-700' : 'border-zinc-800 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className={`rounded p-1.5 ${meta.bg}`}>
            <Icon className={`h-4 w-4 ${meta.color}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">{playbook.name}</h3>
            <span className={`text-xs ${meta.color}`}>{meta.label} regime</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onToggle(playbook.id, !playbook.is_active)}
            className={`rounded p-1.5 ${
              playbook.is_active
                ? 'text-emerald-400 hover:bg-emerald-950/30'
                : 'text-zinc-500 hover:bg-zinc-800'
            }`}
            title={playbook.is_active ? 'Deactivate' : 'Activate'}
          >
            {playbook.is_active ? (
              <Play className="h-3.5 w-3.5" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onDelete(playbook.id)}
            className="rounded p-1.5 text-zinc-500 hover:bg-red-950/30 hover:text-red-400"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {playbook.description && <p className="mt-2 text-xs text-zinc-500">{playbook.description}</p>}

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Enabled</div>
          <div className="font-medium text-zinc-300">
            {enabled.length > 0 ? enabled.length : 'All'}
          </div>
        </div>
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Disabled</div>
          <div className="font-medium text-zinc-300">{disabled.length}</div>
        </div>
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Weights</div>
          <div className="font-medium text-zinc-300">{weightCount > 0 ? weightCount : '—'}</div>
        </div>
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="text-zinc-500">Auto</div>
          <div className="font-medium text-zinc-300">{playbook.auto_approve ? 'Yes' : 'No'}</div>
        </div>
      </div>

      {overrides.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {overrides.map((o) => (
            <span
              key={String(o)}
              className="rounded bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300"
            >
              {o}
            </span>
          ))}
        </div>
      )}

      {enabled.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {enabled.map((s) => (
            <span key={s} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              {formatStrategy(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Playbook Dialog ──────────────────────────────────────────────────

function CreatePlaybookDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
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
            <div className="mt-1 grid grid-cols-5 gap-2">
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
              {createMutation.isPending ? 'Creating…' : 'Create Playbook'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Regime History Timeline ─────────────────────────────────────────────────

function RegimeTimeline({ history }: { history: RegimeEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-sm font-medium text-zinc-300">Recent History</h3>
      <div className="space-y-1">
        {history.slice(0, 10).map((entry, i) => {
          const meta = getRegimeMeta(entry.regime);
          const Icon = meta.icon;
          const nextEntry = history[i + 1];

          return (
            <div key={entry.id} className="flex items-center gap-2 text-xs">
              <div className={`flex items-center gap-1 ${meta.color}`}>
                <Icon className="h-3 w-3" />
                <span className="w-16 font-medium">{meta.label}</span>
              </div>
              <span className="text-zinc-500">{(entry.confidence * 100).toFixed(0)}%</span>
              {nextEntry && <ArrowRight className="h-3 w-3 text-zinc-700" />}
              <span className="ml-auto text-zinc-600">
                {new Date(entry.detected_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
            <h1 className="text-2xl font-bold text-zinc-100">Regime Detection</h1>
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
