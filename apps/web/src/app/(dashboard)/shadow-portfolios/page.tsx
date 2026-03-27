'use client';

import { useState } from 'react';
import {
  Layers,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  BarChart3,
  Activity,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  useShadowPortfoliosQuery,
  useCreateShadowPortfolioMutation,
  useDeleteShadowPortfolioMutation,
} from '@/hooks/queries';
import type { ShadowPortfolio, ShadowPortfolioCreate } from '@/hooks/queries';

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

// ── Create Dialog ───────────────────────────────────────────────────────────

function CreateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createMutation = useCreateShadowPortfolioMutation();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [initialCapital, setInitialCapital] = useState('100000');
  const [maxPositionPct, setMaxPositionPct] = useState('');
  const [maxSectorPct, setMaxSectorPct] = useState('');
  const [dailyLossLimitPct, setDailyLossLimitPct] = useState('');
  const [enabledStrategies, setEnabledStrategies] = useState<string[]>([]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const body: ShadowPortfolioCreate = {
      name: name.trim(),
      description: description.trim() || undefined,
      initial_capital: parseFloat(initialCapital) || 100_000,
    };

    if (maxPositionPct) body.max_position_pct = parseFloat(maxPositionPct);
    if (maxSectorPct) body.max_sector_pct = parseFloat(maxSectorPct);
    if (dailyLossLimitPct) body.daily_loss_limit_pct = parseFloat(dailyLossLimitPct);
    if (enabledStrategies.length > 0) body.enabled_strategies = enabledStrategies;

    createMutation.mutate(body, {
      onSuccess: () => {
        onClose();
        setName('');
        setDescription('');
        setInitialCapital('100000');
        setMaxPositionPct('');
        setMaxSectorPct('');
        setDailyLossLimitPct('');
        setEnabledStrategies([]);
      },
    });
  }

  function toggleStrategy(s: string) {
    setEnabledStrategies((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">New Shadow Portfolio</h2>
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
              placeholder="e.g. Conservative Low-Risk"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What hypothesis does this test?"
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400">Initial Capital ($)</label>
              <input
                type="number"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Max Position %</label>
              <input
                type="number"
                step="0.1"
                value={maxPositionPct}
                onChange={(e) => setMaxPositionPct(e.target.value)}
                placeholder="Inherit from primary"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Max Sector %</label>
              <input
                type="number"
                step="0.1"
                value={maxSectorPct}
                onChange={(e) => setMaxSectorPct(e.target.value)}
                placeholder="Inherit from primary"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Daily Loss Limit %</label>
              <input
                type="number"
                step="0.1"
                value={dailyLossLimitPct}
                onChange={(e) => setDailyLossLimitPct(e.target.value)}
                placeholder="Inherit from primary"
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-violet-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Strategy selection */}
          <div>
            <label className="text-xs font-medium text-zinc-400">
              Enabled Strategies <span className="text-zinc-600">(empty = all strategies)</span>
            </label>
            <div className="mt-2 space-y-3">
              {Object.entries(STRATEGY_FAMILIES).map(([family, strategies]) => (
                <div key={family}>
                  <div className="text-xs font-medium text-zinc-500">{family}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {strategies.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleStrategy(s)}
                        className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
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
              {createMutation.isPending ? 'Creating…' : 'Create Portfolio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Portfolio Card ──────────────────────────────────────────────────────────

function PortfolioCard({
  portfolio,
  onDelete,
}: {
  portfolio: ShadowPortfolio;
  onDelete: (id: string) => void;
}) {
  const overrides = [
    portfolio.max_position_pct != null && `Position: ${portfolio.max_position_pct}%`,
    portfolio.max_sector_pct != null && `Sector: ${portfolio.max_sector_pct}%`,
    portfolio.daily_loss_limit_pct != null && `Daily Loss: ${portfolio.daily_loss_limit_pct}%`,
    portfolio.soft_drawdown_pct != null && `Soft DD: ${portfolio.soft_drawdown_pct}%`,
    portfolio.hard_drawdown_pct != null && `Hard DD: ${portfolio.hard_drawdown_pct}%`,
    portfolio.max_open_positions != null && `Max Positions: ${portfolio.max_open_positions}`,
  ].filter(Boolean);

  const strategies = portfolio.enabled_strategies ?? [];
  const disabledStrategies = portfolio.disabled_strategies ?? [];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 transition-colors hover:border-zinc-700">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-zinc-100">{portfolio.name}</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ${
                portfolio.is_active
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-zinc-700 text-zinc-400'
              }`}
            >
              {portfolio.is_active ? 'Active' : 'Paused'}
            </span>
          </div>
          {portfolio.description && (
            <p className="mt-1 text-sm text-zinc-400">{portfolio.description}</p>
          )}
        </div>

        <button
          onClick={() => onDelete(portfolio.id)}
          className="ml-2 rounded p-1.5 text-zinc-500 hover:bg-red-950/30 hover:text-red-400"
          title="Delete shadow portfolio"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Metrics row */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded bg-zinc-800/50 p-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <DollarSign className="h-3 w-3" />
            Capital
          </div>
          <div className="mt-0.5 text-sm font-medium text-zinc-200">
            ${portfolio.initial_capital.toLocaleString()}
          </div>
        </div>

        <div className="rounded bg-zinc-800/50 p-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <Activity className="h-3 w-3" />
            Strategies
          </div>
          <div className="mt-0.5 text-sm font-medium text-zinc-200">
            {strategies.length > 0 ? `${strategies.length} enabled` : 'All (default)'}
          </div>
        </div>

        <div className="rounded bg-zinc-800/50 p-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <ShieldCheck className="h-3 w-3" />
            Risk Overrides
          </div>
          <div className="mt-0.5 text-sm font-medium text-zinc-200">
            {overrides.length > 0 ? `${overrides.length} active` : 'Inherited'}
          </div>
        </div>

        <div className="rounded bg-zinc-800/50 p-2">
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <BarChart3 className="h-3 w-3" />
            Disabled
          </div>
          <div className="mt-0.5 text-sm font-medium text-zinc-200">
            {disabledStrategies.length > 0 ? `${disabledStrategies.length} blocked` : 'None'}
          </div>
        </div>
      </div>

      {/* Policy overrides */}
      {overrides.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-zinc-500">Policy Overrides</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {overrides.map((o) => (
              <span
                key={String(o)}
                className="rounded bg-violet-500/10 px-2 py-0.5 text-xs text-violet-300"
              >
                {o}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Strategy chips */}
      {strategies.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-zinc-500">Enabled Strategies</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {strategies.map((s) => (
              <span key={s} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                {formatStrategy(s)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Creation date */}
      <div className="mt-3 text-xs text-zinc-600">
        Created{' '}
        {new Date(portfolio.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ShadowPortfoliosPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: portfolios, isLoading, error } = useShadowPortfoliosQuery();
  const deleteMutation = useDeleteShadowPortfolioMutation();

  function handleDelete(id: string) {
    setDeleteId(id);
  }

  function confirmDelete() {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Layers className="h-6 w-6 text-violet-400" />
            <h1 className="text-2xl font-bold text-zinc-100">Shadow Portfolios</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Champion–Challenger framework. Run alternate risk policies and strategy configs
            alongside your primary portfolio to compare outcomes.
          </p>
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-1.5 rounded bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-500"
        >
          <Plus className="h-4 w-4" />
          New Shadow
        </button>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-violet-800/30 bg-violet-950/20 p-3">
        <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
        <div className="text-xs text-violet-300/80">
          Each shadow portfolio applies different risk limits or strategy selections to the same
          market signals. Compare results before promoting configuration changes to your primary
          portfolio.
        </div>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="py-12 text-center text-sm text-zinc-500">Loading shadow portfolios…</div>
      )}

      {error && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 text-sm text-red-400">
          Failed to load shadow portfolios: {error.message}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && (!portfolios || portfolios.length === 0) && (
        <div className="py-16 text-center">
          <Layers className="mx-auto h-12 w-12 text-zinc-600" />
          <h3 className="mt-4 text-lg font-medium text-zinc-300">No shadow portfolios yet</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Create your first shadow portfolio to start comparing alternate strategy configurations.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            <Plus className="h-4 w-4" />
            Create Shadow Portfolio
          </button>
        </div>
      )}

      {/* Portfolio list */}
      {!isLoading && portfolios && portfolios.length > 0 && (
        <div className="space-y-3">
          {portfolios.map((p) => (
            <PortfolioCard key={p.id} portfolio={p} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Delete confirmation dialog */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-100">Delete Shadow Portfolio</h3>
            <p className="mt-2 text-sm text-zinc-400">
              This will permanently delete this shadow portfolio and all its snapshot history. This
              cannot be undone.
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
