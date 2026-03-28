'use client';

import { useState, useMemo } from 'react';
import {
  AlertOctagon,
  ShieldAlert,
  Activity,
  Clock,
  OctagonX,
} from 'lucide-react';
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
  live: 'bg-red-500/15 text-red-400',
  backtest: 'bg-blue-500/15 text-blue-400',
  paper: 'bg-amber-500/15 text-amber-400',
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
    return agentAlerts.filter(
      (a) => a.severity === 'critical' && !a.acknowledged,
    ).length;
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* System Mode Indicator */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">System Mode</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={cn(
                'rounded px-2 py-0.5 text-sm font-semibold uppercase',
                modeColor,
              )}
            >
              {mode}
            </span>
            {isHalted && (
              <span className="rounded bg-red-500/20 px-2 py-0.5 text-sm font-bold text-red-400 animate-pulse">
                HALTED
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Halt Button */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Emergency Controls</p>
          </div>
          {!showConfirm ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowConfirm(true)}
              disabled={isHalted || haltMutation.isPending}
              className="w-full"
            >
              <OctagonX className="h-3.5 w-3.5 mr-1" />
              {isHalted ? 'Trading Halted' : 'Emergency Halt'}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-400 font-medium">
                Confirm halt all trading?
              </p>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="xs"
                  onClick={handleHalt}
                  disabled={haltMutation.isPending}
                >
                  {haltMutation.isPending ? 'Halting…' : 'Confirm Halt'}
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setShowConfirm(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Incident Count */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5">
            <AlertOctagon className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Active Incidents</p>
          </div>
          <p
            className={cn(
              'mt-1 text-2xl font-bold',
              criticalCount > 0 ? 'text-red-400' : 'text-foreground',
            )}
          >
            {criticalCount}
          </p>
          <p className="text-xs text-muted-foreground">critical unresolved</p>
        </CardContent>
      </Card>

      {/* Recent Operator Actions Feed */}
      <Card className="bg-card border-border">
        <CardContent className="p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Recent Actions</p>
          </div>
          {recentActions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">
              No recent operator actions
            </p>
          ) : (
            <div className="space-y-1.5">
              {recentActions.slice(0, 5).map((action) => (
                <div
                  key={action.id}
                  className="flex items-start gap-1.5 text-xs"
                >
                  <span className="text-muted-foreground shrink-0">
                    {formatActionTime(action.created_at)}
                  </span>
                  <span className="text-foreground truncate">
                    {ACTION_LABELS[action.action_type] ??
                      action.action_type.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
