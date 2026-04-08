'use client';

import { useMemo, useState } from 'react';
import { AlertOctagon, ShieldAlert, Activity, Clock, OctagonX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useSystemControlsQuery,
  useHaltSystemMutation,
  useAlertsQuery,
  useOperatorActionsQuery,
  useRecordActionMutation,
} from '@/hooks/queries';

const MODE_STYLES: Record<string, string> = {
  live: 'text-loss',
  backtest: 'text-blue-400',
  paper: 'text-amber-400',
};

const ACTION_LABELS: Record<string, string> = {
  halt_trading: 'Halted trading',
  resume_trading: 'Resumed trading',
  approve_recommendation: 'Approved recommendation',
  reject_recommendation: 'Rejected recommendation',
  update_policy: 'Updated policy',
  change_mode: 'Changed mode',
  override_risk: 'Risk override',
  cancel_order: 'Cancelled order',
  manual_order: 'Manual order',
  role_change: 'Role change',
  system_config_change: 'Config change',
};

function formatActionTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function IncidentControls() {
  const { data: systemControls } = useSystemControlsQuery();
  const { data: agentAlerts } = useAlertsQuery(15_000);
  const { data: operatorActionsResp } = useOperatorActionsQuery({ limit: 5 });

  const haltMutation = useHaltSystemMutation();
  const recordAction = useRecordActionMutation();

  const [showConfirm, setShowConfirm] = useState(false);

  const criticalCount = useMemo(() => {
    if (!agentAlerts) return 0;
    return agentAlerts.filter((a) => a.severity === 'critical' && !a.acknowledged).length;
  }, [agentAlerts]);

  const recentActions = operatorActionsResp?.data ?? [];
  const isHalted = systemControls?.trading_halted;
  const mode = systemControls?.global_mode ?? 'paper';
  const modeColor = MODE_STYLES[mode] ?? MODE_STYLES.paper;

  const handleHalt = async () => {
    try {
      await haltMutation.mutateAsync();
      await recordAction.mutateAsync({
        action_type: 'halt_trading',
        reason: 'Emergency halt triggered from dashboard',
      });
    } catch {
      // Error state handled by mutation hooks
    }
    setShowConfirm(false);
  };

  return (
    <section
      aria-label="Intervention controls"
      className="workstation-panel @container/interventions space-y-3 px-3 py-3 sm:px-4"
    >
      <div className="grid grid-cols-1 gap-2.5 border-b border-border/80 pb-3 @[26rem]/interventions:grid-cols-3">
        <div className="workspace-keyline">
          <p className="workspace-label">Trading Mode</p>
          <div className="mt-1.5 flex items-center gap-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <span className={cn('text-sm font-semibold uppercase', modeColor)}>{mode}</span>
            {isHalted && (
              <span className="rounded bg-loss/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-loss">
                halted
              </span>
            )}
          </div>
        </div>

        <div className="workspace-keyline">
          <p className="workspace-label">Critical Incidents</p>
          <div className="mt-1.5 flex items-center gap-2">
            <AlertOctagon className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={cn(
                'text-sm font-semibold',
                criticalCount > 0 ? 'text-loss' : 'text-foreground',
              )}
            >
              {criticalCount}
            </span>
            <span className="text-xs text-muted-foreground">unresolved</span>
          </div>
        </div>

        <div className="workspace-keyline">
          <p className="workspace-label">Emergency</p>
          <div className="mt-1.5">
            {!showConfirm ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowConfirm(true)}
                disabled={isHalted || haltMutation.isPending}
                className="h-8 w-full justify-center text-xs"
              >
                <OctagonX className="mr-1.5 h-3.5 w-3.5" />
                {isHalted ? 'Trading Halted' : 'Trigger Halt'}
              </Button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={handleHalt}
                  disabled={haltMutation.isPending}
                >
                  {haltMutation.isPending ? 'Halting…' : 'Confirm'}
                </Button>
                <Button variant="outline" size="xs" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Recent interventions
        </div>
        {recentActions.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No operator actions in the current session.
          </p>
        ) : (
          <ul className="space-y-1" role="list">
            {recentActions.slice(0, 5).map((action) => (
              <li
                key={action.id}
                className="grid grid-cols-[3.25rem_1fr] items-start gap-2 text-xs"
                role="listitem"
              >
                <span className="font-mono text-muted-foreground">
                  {formatActionTime(action.created_at)}
                </span>
                <span className="truncate text-foreground/90">
                  <ShieldAlert className="mr-1 inline h-3 w-3 text-muted-foreground" />
                  {ACTION_LABELS[action.action_type] ?? action.action_type.replace(/_/g, ' ')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
