'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  AlertOctagon,
  Bot,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  Activity,
  Lock,
  Eye,
  MessageSquare,
  Zap,
  Play,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useSystemControlsQuery,
  useUpdateSystemControlsMutation,
} from '@/hooks/queries/use-system-controls-query';
import {
  useStrategiesAutonomyQuery,
  useUpdateStrategyAutonomyMutation,
} from '@/hooks/queries/use-strategies-autonomy-query';
import type { StrategyAutonomyEntry } from '@/hooks/queries/use-strategies-autonomy-query';
import {
  useUniverseRestrictionsQuery,
  useCreateRestrictionMutation,
  useDeleteRestrictionMutation,
} from '@/hooks/queries/use-universe-restrictions-query';
import type { CreateRestrictionInput } from '@/hooks/queries/use-universe-restrictions-query';
import { useAutoExecutionActivityQuery } from '@/hooks/queries/use-auto-execution-activity-query';
import type { AutoExecutionEvent } from '@/hooks/queries/use-auto-execution-activity-query';
import type { AutonomyMode, RestrictionType, UniverseRestriction } from '@sentinel/shared';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AUTONOMY_MODES: AutonomyMode[] = [
  'disabled',
  'alert_only',
  'suggest',
  'auto_approve',
  'auto_execute',
];

const MODE_CONFIG: Record<
  AutonomyMode,
  { label: string; color: string; bgClass: string; description: string }
> = {
  disabled: {
    label: 'Disabled',
    color: 'text-gray-400',
    bgClass: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    description: 'All autonomy features off',
  },
  alert_only: {
    label: 'Alert Only',
    color: 'text-blue-400',
    bgClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    description: 'Notify operators, no action taken',
  },
  suggest: {
    label: 'Suggest',
    color: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    description: 'Suggest actions, require manual approval',
  },
  auto_approve: {
    label: 'Auto Approve',
    color: 'text-orange-400',
    bgClass: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    description: 'Auto-approve within risk limits',
  },
  auto_execute: {
    label: 'Auto Execute',
    color: 'text-green-400',
    bgClass: 'bg-green-500/10 text-green-400 border-green-500/20',
    description: 'Full autonomous execution',
  },
};

const MODE_ICONS: Record<AutonomyMode, typeof Shield> = {
  disabled: Lock,
  alert_only: Eye,
  suggest: MessageSquare,
  auto_approve: Zap,
  auto_execute: Play,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/* ------------------------------------------------------------------ */
/*  Confirm Dialog (inline, follows system-controls pattern)           */
/* ------------------------------------------------------------------ */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <p className="mb-6 text-sm text-muted-foreground">{description}</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  System Autonomy Status Card                                        */
/* ------------------------------------------------------------------ */

function SystemAutonomyCard() {
  const { data: controls, isLoading, isError } = useSystemControlsQuery();
  const updateMutation = useUpdateSystemControlsMutation();
  const [selectedMode, setSelectedMode] = useState<AutonomyMode | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const currentMode = (controls?.autonomy_mode ?? 'alert_only') as AutonomyMode;
  const previousMode = controls?.previous_autonomy_mode as AutonomyMode | null;
  const isDowngraded = previousMode && previousMode !== currentMode;

  const handleModeChange = useCallback(
    (mode: AutonomyMode) => {
      if (mode === currentMode) return;
      setSelectedMode(mode);
      setShowConfirm(true);
    },
    [currentMode],
  );

  const confirmChange = useCallback(() => {
    if (!selectedMode) return;
    updateMutation.mutate(
      { autonomy_mode: selectedMode },
      {
        onSettled: () => {
          setShowConfirm(false);
          setSelectedMode(null);
        },
      },
    );
  }, [selectedMode, updateMutation]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-destructive">Failed to load system controls</p>
        </CardContent>
      </Card>
    );
  }

  const modeConf = MODE_CONFIG[currentMode];
  const ModeIcon = MODE_ICONS[currentMode];

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            System Autonomy Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current mode display */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg',
                  modeConf.bgClass,
                )}
              >
                <ModeIcon className={cn('h-5 w-5', modeConf.color)} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-bold', modeConf.color)}>{modeConf.label}</span>
                  <Badge className={cn('border text-[10px]', modeConf.bgClass)}>
                    {currentMode}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{modeConf.description}</p>
              </div>
            </div>
          </div>

          {/* Downgraded warning */}
          {isDowngraded && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <AlertOctagon className="h-4 w-4 shrink-0 text-amber-400" />
              <span className="text-xs text-amber-300">
                Downgraded from{' '}
                <span className="font-semibold">
                  {MODE_CONFIG[previousMode]?.label ?? previousMode}
                </span>{' '}
                due to incident fallback
              </span>
            </div>
          )}

          {/* Mode selector */}
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Change System Mode</p>
            <div className="flex flex-wrap gap-2">
              {AUTONOMY_MODES.map((mode) => {
                const conf = MODE_CONFIG[mode];
                const Icon = MODE_ICONS[mode];
                const isActive = mode === currentMode;

                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => handleModeChange(mode)}
                    disabled={isActive || updateMutation.isPending}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
                      isActive
                        ? cn(conf.bgClass, 'ring-1 ring-current')
                        : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground disabled:opacity-50',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {conf.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Last updated */}
          {controls?.updated_at && (
            <p className="text-[10px] text-muted-foreground">
              Last updated: {formatTimestamp(controls.updated_at)}
              {controls.updated_by && ` by ${controls.updated_by.slice(0, 8)}…`}
            </p>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showConfirm}
        title="Change Autonomy Mode"
        description={`Change system autonomy from "${MODE_CONFIG[currentMode].label}" to "${selectedMode ? MODE_CONFIG[selectedMode].label : ''}"? This affects how the system handles recommendations globally.`}
        confirmLabel="Confirm Change"
        loading={updateMutation.isPending}
        onConfirm={confirmChange}
        onCancel={() => {
          setShowConfirm(false);
          setSelectedMode(null);
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Strategy Autonomy Grid                                             */
/* ------------------------------------------------------------------ */

function StrategyAutonomyGrid() {
  const { data: strategies, isLoading, isError } = useStrategiesAutonomyQuery();
  const updateMutation = useUpdateStrategyAutonomyMutation();
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleModeChange = useCallback(
    (strategy: StrategyAutonomyEntry, newMode: AutonomyMode) => {
      if (newMode === strategy.autonomy_mode) {
        setEditingId(null);
        return;
      }
      updateMutation.mutate(
        { strategyId: strategy.strategy_id, autonomyMode: newMode },
        { onSettled: () => setEditingId(null) },
      );
    },
    [updateMutation],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          Strategy Autonomy
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load strategies</p>
        ) : !strategies || strategies.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No strategies configured</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">Strategy</th>
                  <th className="pb-2 pr-4 text-xs font-medium text-muted-foreground">
                    Autonomy Mode
                  </th>
                  <th className="pb-2 text-xs font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {strategies.map((strategy) => {
                  const conf = MODE_CONFIG[strategy.autonomy_mode] ?? MODE_CONFIG.alert_only;
                  const isEditing = editingId === strategy.strategy_id;

                  return (
                    <tr key={strategy.strategy_id} className="group">
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-foreground">
                          {strategy.strategy_name
                            .split('_')
                            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ')}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4">
                        {isEditing ? (
                          <div className="relative inline-block">
                            <select
                              defaultValue={strategy.autonomy_mode}
                              onChange={(e) =>
                                handleModeChange(strategy, e.target.value as AutonomyMode)
                              }
                              onBlur={() => setEditingId(null)}
                              autoFocus
                              disabled={updateMutation.isPending}
                              className="appearance-none rounded-md border border-border bg-card py-1 pl-2 pr-7 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              {AUTONOMY_MODES.map((mode) => (
                                <option key={mode} value={mode}>
                                  {MODE_CONFIG[mode].label}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                          </div>
                        ) : (
                          <Badge className={cn('border text-[10px]', conf.bgClass)}>
                            {conf.label}
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => setEditingId(strategy.strategy_id)}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            Edit
                          </button>
                        )}
                        {updateMutation.isPending &&
                          updateMutation.variables?.strategyId === strategy.strategy_id && (
                            <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
                          )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Universe Restrictions Panel                                        */
/* ------------------------------------------------------------------ */

function UniverseRestrictionsPanel() {
  const { data: restrictions, isLoading, isError } = useUniverseRestrictionsQuery();
  const createMutation = useCreateRestrictionMutation();
  const deleteMutation = useDeleteRestrictionMutation();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateRestrictionInput>({
    restriction_type: 'blacklist',
    symbols: [],
    sectors: [],
    asset_classes: [],
    reason: null,
  });
  const [symbolsInput, setSymbolsInput] = useState('');

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const symbols = symbolsInput
        .split(/[,\s]+/)
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      createMutation.mutate(
        { ...formData, symbols },
        {
          onSuccess: () => {
            setShowForm(false);
            setSymbolsInput('');
            setFormData({
              restriction_type: 'blacklist',
              symbols: [],
              sectors: [],
              asset_classes: [],
              reason: null,
            });
          },
        },
      );
    },
    [formData, symbolsInput, createMutation],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            Universe Restrictions
          </CardTitle>
          <Button variant="outline" size="xs" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-3 w-3" />
            {showForm ? 'Cancel' : 'Add'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add form */}
        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="space-y-3 rounded-lg border border-border bg-muted/30 p-3"
          >
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  Type
                </label>
                <select
                  value={formData.restriction_type}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      restriction_type: e.target.value as RestrictionType,
                    }))
                  }
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                >
                  <option value="blacklist">Blacklist</option>
                  <option value="whitelist">Whitelist</option>
                </select>
              </div>
              <div className="flex-[2]">
                <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                  Symbols (comma separated)
                </label>
                <input
                  type="text"
                  value={symbolsInput}
                  onChange={(e) => setSymbolsInput(e.target.value)}
                  placeholder="AAPL, TSLA, MSFT"
                  className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                Reason
              </label>
              <input
                type="text"
                value={formData.reason ?? ''}
                onChange={(e) => setFormData((d) => ({ ...d, reason: e.target.value || null }))}
                placeholder="Optional reason for this restriction"
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                size="xs"
                disabled={createMutation.isPending || !symbolsInput.trim()}
              >
                {createMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                Create Restriction
              </Button>
            </div>
          </form>
        )}

        {/* Restrictions list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load restrictions</p>
        ) : !restrictions || restrictions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No universe restrictions active
          </p>
        ) : (
          <div className="space-y-2">
            {restrictions.map((r: UniverseRestriction) => (
              <div
                key={r.id}
                className="flex items-start justify-between rounded-lg border border-border bg-muted/20 p-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'border text-[10px]',
                        r.restriction_type === 'blacklist'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20',
                      )}
                    >
                      {r.restriction_type}
                    </Badge>
                    {r.symbols.length > 0 && (
                      <span className="text-xs font-medium text-foreground">
                        {r.symbols.join(', ')}
                      </span>
                    )}
                    {r.sectors.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Sectors: {r.sectors.join(', ')}
                      </span>
                    )}
                  </div>
                  {r.reason && <p className="text-[10px] text-muted-foreground">{r.reason}</p>}
                  <p className="text-[10px] text-muted-foreground/60">
                    Created {formatTimestamp(r.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(r.id)}
                  disabled={deleteMutation.isPending}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  title="Delete restriction"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Auto-Execution Activity Feed                                       */
/* ------------------------------------------------------------------ */

function AutoExecutionActivityFeed() {
  const { data: events, isLoading, isError } = useAutoExecutionActivityQuery();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Auto-Execution Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">Failed to load activity</p>
        ) : !events || events.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No auto-execution events yet
          </p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {events.map((event: AutoExecutionEvent) => {
              const isApproved = event.event_type === 'auto_approved';
              const reason =
                (event.payload?.reason as string) ?? (event.payload?.message as string) ?? '';
              const policyVersion = (event.payload?.policy_version as string) ?? '';

              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3"
                >
                  <div
                    className={cn(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      isApproved ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
                    )}
                  >
                    {isApproved ? (
                      <Zap className="h-3 w-3" />
                    ) : (
                      <AlertOctagon className="h-3 w-3" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">{event.ticker}</span>
                      <Badge
                        className={cn(
                          'border text-[10px]',
                          isApproved
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border-red-500/20',
                        )}
                      >
                        {isApproved ? 'Auto Approved' : 'Denied'}
                      </Badge>
                      {policyVersion && (
                        <span className="text-[10px] text-muted-foreground">v{policyVersion}</span>
                      )}
                    </div>
                    {reason && (
                      <p className="text-[10px] text-muted-foreground truncate">{reason}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {formatTimestamp(event.event_ts)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AutonomyPage() {
  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-heading-page text-foreground">Bounded Autonomy</h1>
          <p className="text-xs text-muted-foreground">
            Configure system and per-strategy autonomy levels, universe restrictions, and monitor
            auto-execution activity
          </p>
        </div>
      </div>

      {/* System autonomy status */}
      <SystemAutonomyCard />

      {/* Strategy grid + Restrictions side by side on large screens */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <StrategyAutonomyGrid />
        <UniverseRestrictionsPanel />
      </div>

      {/* Activity feed */}
      <AutoExecutionActivityFeed />
    </div>
  );
}
