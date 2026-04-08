'use client';

import { useState, useMemo } from 'react';
import { ShieldAlert, Activity, Clock, OctagonX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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
  live: 'border-loss/40 bg-loss/10 text-loss',
  backtest: 'border-primary/40 bg-primary/10 text-primary',
  paper: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
};

const ACTION_LABELS: Record<string, string> = {
  halt_trading: 'Halted trading',
  resume_trading: 'Resumed trading',
  approve_recommendation: 'Approved rec',
  reject_recommendation: 'Rejected rec',
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
    <Card className="border-border bg-card">
      <CardContent className="grid gap-4 p-4 md:grid-cols-[1.1fr,1fr,1.4fr]">
        <section className="border-border md:border-r md:pr-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Execution State
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'rounded border px-2 py-0.5 text-xs font-semibold uppercase',
                modeColor,
              )}
            >
              {mode}
            </span>
            {isHalted && (
              <span className="rounded border border-loss/35 bg-loss/10 px-2 py-0.5 text-xs font-semibold uppercase text-loss">
                Halted
              </span>
            )}
            <span
              className={cn(
                'font-mono text-xl tabular-nums',
                criticalCount > 0 ? 'text-loss' : 'text-foreground',
              )}
            >
              {criticalCount}
            </span>
            <span className="text-xs text-muted-foreground">critical incidents</span>
          </div>
        </section>

        <section className="border-border md:border-r md:px-4">
          <div className="mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Intervention
            </p>
          </div>
          {!showConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={isHalted || haltMutation.isPending}
              className="w-full"
            >
              <OctagonX className="mr-1 h-3.5 w-3.5" />
              {isHalted ? 'Trading Halted' : 'Emergency Halt'}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-loss">Confirm halt all trading?</p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={handleHalt}
                  disabled={haltMutation.isPending}
                >
                  {haltMutation.isPending ? 'Halting…' : 'Confirm Halt'}
                </Button>
                <Button variant="outline" size="xs" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </section>

        <section>
          <div className="mb-2 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Operator Actions
            </p>
          </div>
          {recentActions.length === 0 ? (
            <p className="py-2 text-xs text-muted-foreground">No recent operator actions</p>
          ) : (
            <div className="space-y-1.5">
              {recentActions.slice(0, 5).map((action) => (
                <div key={action.id} className="grid grid-cols-[auto,1fr] gap-2 text-xs">
                  <span className="font-mono text-muted-foreground">
                    {formatActionTime(action.created_at)}
                  </span>
                  <span className="truncate text-foreground/90">
                    {ACTION_LABELS[action.action_type] ?? action.action_type.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
