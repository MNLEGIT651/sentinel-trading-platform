'use client';

import { useState, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  Activity,
  Clock,
  User,
  Loader2,
  AlertOctagon,
  Zap,
  FlaskConical,
  BarChart3,
  CheckCircle2,
  XCircle,
  List,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  useSystemControlsQuery,
  useUpdateSystemControlsMutation,
  useHaltSystemMutation,
  useResumeSystemMutation,
} from '@/hooks/queries/use-system-controls-query';
import { useOperatorActionsQuery } from '@/hooks/queries/use-operator-actions-query';
import type { SystemMode, OperatorAction } from '@sentinel/shared';

/* ------------------------------------------------------------------ */
/*  Confirmation Dialog                                                */
/* ------------------------------------------------------------------ */

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  variant: 'danger' | 'warning' | 'default';
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  variant,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmColors =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : variant === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-primary hover:bg-primary/90 text-primary-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          {variant === 'danger' ? (
            <AlertOctagon className="h-6 w-6 text-red-500" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          )}
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
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
            className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${confirmColors}`}
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
/*  Mode config                                                        */
/* ------------------------------------------------------------------ */

const MODE_CONFIG: Record<SystemMode, { label: string; icon: typeof Settings; color: string }> = {
  paper: { label: 'Paper', icon: FlaskConical, color: 'text-blue-500' },
  live: { label: 'Live', icon: Zap, color: 'text-green-500' },
  backtest: { label: 'Backtest', icon: BarChart3, color: 'text-purple-500' },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function truncateId(id: string | null): string {
  if (!id) return 'System';
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/* ------------------------------------------------------------------ */
/*  Confirm action types                                               */
/* ------------------------------------------------------------------ */

type ConfirmAction =
  | { kind: 'halt' }
  | { kind: 'resume' }
  | { kind: 'enable_live' }
  | { kind: 'disable_live' }
  | { kind: 'change_mode'; mode: SystemMode };

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function SystemControlsPage() {
  const { data: controls, isLoading, isError, error } = useSystemControlsQuery();
  const { data: actionsResponse } = useOperatorActionsQuery({ limit: 10 });
  const updateMutation = useUpdateSystemControlsMutation();
  const haltMutation = useHaltSystemMutation();
  const resumeMutation = useResumeSystemMutation();

  const [pendingAction, setPendingAction] = useState<ConfirmAction | undefined>(undefined);

  const isAnyMutating =
    updateMutation.isPending || haltMutation.isPending || resumeMutation.isPending;

  const requestConfirm = useCallback((action: ConfirmAction) => {
    setPendingAction(action);
  }, []);

  const cancelConfirm = useCallback(() => {
    setPendingAction(undefined);
  }, []);

  const executeConfirmed = useCallback(() => {
    if (!pendingAction) return;

    const onDone = () => setPendingAction(undefined);

    switch (pendingAction.kind) {
      case 'halt':
        haltMutation.mutate(undefined, { onSettled: onDone });
        break;
      case 'resume':
        resumeMutation.mutate(undefined, { onSettled: onDone });
        break;
      case 'enable_live':
        updateMutation.mutate({ live_execution_enabled: true }, { onSettled: onDone });
        break;
      case 'disable_live':
        updateMutation.mutate({ live_execution_enabled: false }, { onSettled: onDone });
        break;
      case 'change_mode':
        updateMutation.mutate({ global_mode: pendingAction.mode }, { onSettled: onDone });
        break;
    }
  }, [pendingAction, haltMutation, resumeMutation, updateMutation]);

  /* ---- Dialog config per action ---- */
  function dialogPropsForAction(
    action: ConfirmAction,
  ): Omit<ConfirmDialogProps, 'open' | 'loading' | 'onConfirm' | 'onCancel'> {
    switch (action.kind) {
      case 'halt':
        return {
          title: 'Halt All Trading',
          description:
            'This will immediately stop all trading activity across the platform. Open orders will NOT be cancelled automatically. Are you sure?',
          confirmLabel: 'Halt Trading',
          variant: 'danger',
        };
      case 'resume':
        return {
          title: 'Resume Trading',
          description:
            'This will re-enable trading activity. Agents will resume processing signals according to their configuration.',
          confirmLabel: 'Resume Trading',
          variant: 'warning',
        };
      case 'enable_live':
        return {
          title: 'Enable Live Execution',
          description:
            'Orders will be submitted to the real brokerage. Real money will be at risk. Ensure your risk limits are properly configured.',
          confirmLabel: 'Enable Live',
          variant: 'danger',
        };
      case 'disable_live':
        return {
          title: 'Disable Live Execution',
          description:
            'Orders will no longer be submitted to the brokerage. The system will continue generating signals in paper mode.',
          confirmLabel: 'Disable Live',
          variant: 'warning',
        };
      case 'change_mode':
        return {
          title: `Switch to ${MODE_CONFIG[action.mode].label} Mode`,
          description:
            action.mode === 'live'
              ? 'Switching to Live mode means signals may result in real trades if live execution is also enabled.'
              : `Switching to ${MODE_CONFIG[action.mode].label} mode. No real trades will be executed.`,
          confirmLabel: `Switch to ${MODE_CONFIG[action.mode].label}`,
          variant: action.mode === 'live' ? 'danger' : 'default',
        };
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Loading state                                                      */
  /* ------------------------------------------------------------------ */

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Loading system controls…</p>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Error state                                                        */
  /* ------------------------------------------------------------------ */

  if (isError || !controls) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <XCircle className="h-10 w-10 text-red-500" />
            <div className="text-center">
              <p className="font-medium text-foreground">Failed to load system controls</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'An unexpected error occurred'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------------------ */
  /*  Derived state                                                      */
  /* ------------------------------------------------------------------ */

  const isHalted = controls.trading_halted;
  const isLiveExec = controls.live_execution_enabled;
  const currentMode = controls.global_mode;
  const ModeIcon = MODE_CONFIG[currentMode].icon;

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Shield className="h-7 w-7 text-foreground" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Controls</h1>
          <p className="text-sm text-muted-foreground">
            Manage trading state, execution mode, and emergency controls
          </p>
        </div>
      </div>

      {/* ---- Status Cards ---- */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Trading Status */}
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                isHalted ? 'bg-red-500/10' : 'bg-green-500/10'
              }`}
            >
              {isHalted ? (
                <Pause className="h-6 w-6 text-red-500" />
              ) : (
                <Activity className="h-6 w-6 text-green-500" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Trading Status</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">
                  {isHalted ? 'Halted' : 'Active'}
                </span>
                <Badge variant={isHalted ? 'destructive' : 'default'}>
                  {isHalted ? 'HALTED' : 'RUNNING'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Global Mode */}
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                currentMode === 'live'
                  ? 'bg-green-500/10'
                  : currentMode === 'paper'
                    ? 'bg-blue-500/10'
                    : 'bg-purple-500/10'
              }`}
            >
              <ModeIcon className={`h-6 w-6 ${MODE_CONFIG[currentMode].color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Global Mode</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">
                  {MODE_CONFIG[currentMode].label}
                </span>
                <Badge variant="secondary">{currentMode.toUpperCase()}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Execution */}
        <Card>
          <CardContent className="flex items-center gap-4 py-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                isLiveExec ? 'bg-amber-500/10' : 'bg-muted'
              }`}
            >
              {isLiveExec ? (
                <Zap className="h-6 w-6 text-amber-500" />
              ) : (
                <Shield className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Live Execution</p>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-foreground">
                  {isLiveExec ? 'Enabled' : 'Disabled'}
                </span>
                <Badge variant={isLiveExec ? 'destructive' : 'outline'}>
                  {isLiveExec ? 'LIVE' : 'OFF'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---- Emergency Controls ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Emergency Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isHalted ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <AlertOctagon className="h-8 w-8 text-red-500" />
                  <div>
                    <p className="font-semibold text-red-500">Trading is Halted</p>
                    <p className="text-sm text-muted-foreground">
                      All trading activity is suspended. Click Resume to re-enable.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => requestConfirm({ kind: 'resume' })}
                  disabled={isAnyMutating}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {resumeMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                  Resume Trading
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-foreground">Emergency Halt</p>
                <p className="text-sm text-muted-foreground">
                  Immediately stop all trading activity across the entire platform.
                </p>
              </div>
              <button
                type="button"
                onClick={() => requestConfirm({ kind: 'halt' })}
                disabled={isAnyMutating}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-8 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-red-700 hover:shadow-xl disabled:opacity-50"
              >
                {haltMutation.isPending ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <AlertOctagon className="h-6 w-6" />
                )}
                HALT ALL TRADING
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Mode Selector ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Trading Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Set the global operating mode for all agents and strategies.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(MODE_CONFIG) as [SystemMode, (typeof MODE_CONFIG)[SystemMode]][]).map(
              ([mode, config]) => {
                const Icon = config.icon;
                const isActive = currentMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (!isActive) requestConfirm({ kind: 'change_mode', mode });
                    }}
                    disabled={isActive || isAnyMutating}
                    className={`flex items-center gap-3 rounded-lg border p-4 text-left transition-colors ${
                      isActive
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-card hover:border-primary/50 hover:bg-muted'
                    } disabled:cursor-default disabled:opacity-70`}
                  >
                    <Icon
                      className={`h-5 w-5 ${isActive ? config.color : 'text-muted-foreground'}`}
                    />
                    <div>
                      <p
                        className={`font-medium ${isActive ? 'text-foreground' : 'text-foreground'}`}
                      >
                        {config.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {mode === 'paper' && 'Simulated orders, no real money'}
                        {mode === 'live' && 'Real orders sent to brokerage'}
                        {mode === 'backtest' && 'Replay historical data'}
                      </p>
                    </div>
                    {isActive && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
                  </button>
                );
              },
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---- Live Execution Toggle ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-muted-foreground" />
            Live Execution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-foreground">
                {isLiveExec ? 'Live execution is enabled' : 'Live execution is disabled'}
              </p>
              <p className="text-sm text-muted-foreground">
                {isLiveExec
                  ? 'Orders are being submitted to your brokerage. Real money is at risk.'
                  : 'Orders are simulated. No real trades are being placed.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => requestConfirm({ kind: isLiveExec ? 'disable_live' : 'enable_live' })}
              disabled={isAnyMutating}
              className={`inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 ${
                isLiveExec
                  ? 'border border-border bg-card text-foreground hover:bg-muted'
                  : 'bg-amber-600 text-white hover:bg-amber-700'
              }`}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLiveExec ? (
                <Shield className="h-4 w-4" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              {isLiveExec ? 'Disable Live Execution' : 'Enable Live Execution'}
            </button>
          </div>
          {isLiveExec && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Real money is at risk. Ensure risk limits are configured before trading.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Last Updated ---- */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              Last updated:{' '}
              <span className="font-medium text-foreground">
                {formatTimestamp(controls.updated_at)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>
              By:{' '}
              <span className="font-medium text-foreground">{truncateId(controls.updated_by)}</span>
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ---- Recent Operator Actions ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-muted-foreground" />
            Recent Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actionsResponse?.data && actionsResponse.data.length > 0 ? (
            <div className="rounded-md border border-border overflow-hidden">
              <div className="divide-y divide-border">
                {actionsResponse.data.map((action: OperatorAction) => (
                  <div
                    key={action.id}
                    className="flex items-center justify-between px-4 py-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          action.action_type === 'halt_trading'
                            ? 'destructive'
                            : action.action_type === 'resume_trading'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {action.action_type.replace(/_/g, ' ')}
                      </Badge>
                      {action.reason && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {action.reason}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{truncateId(action.operator_id)}</span>
                      <span>{formatTimestamp(action.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No recent actions recorded.</p>
          )}
        </CardContent>
      </Card>

      {/* ---- Confirmation Dialog ---- */}
      {pendingAction && (
        <ConfirmDialog
          open={true}
          {...dialogPropsForAction(pendingAction)}
          loading={isAnyMutating}
          onConfirm={executeConfirmed}
          onCancel={cancelConfirm}
        />
      )}
    </div>
  );
}
