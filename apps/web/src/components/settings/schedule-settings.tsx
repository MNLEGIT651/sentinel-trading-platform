'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function ToggleField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between py-2">
      <div className="space-y-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-5 w-9 rounded-full transition-colors',
          checked ? 'bg-primary' : 'bg-muted',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </div>
  );
}

interface ScheduleSettingsProps {
  alertCritical: boolean;
  onAlertCritical: (v: boolean) => void;
  alertWarning: boolean;
  onAlertWarning: (v: boolean) => void;
  alertInfo: boolean;
  onAlertInfo: (v: boolean) => void;
  alertSound: boolean;
  onAlertSound: (v: boolean) => void;
  agentNotifications: boolean;
  onAgentNotifications: (v: boolean) => void;
  tradeNotifications: boolean;
  onTradeNotifications: (v: boolean) => void;
}

export function ScheduleSettings({
  alertCritical,
  onAlertCritical,
  alertWarning,
  onAlertWarning,
  alertInfo,
  onAlertInfo,
  alertSound,
  onAlertSound,
  agentNotifications,
  onAgentNotifications,
  tradeNotifications,
  onTradeNotifications,
}: ScheduleSettingsProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-foreground">Alert Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 divide-y divide-border/50">
        <ToggleField
          label="Critical Alerts"
          description="Risk limit breaches, circuit breaker activations, system failures."
          checked={alertCritical}
          onChange={onAlertCritical}
        />
        <ToggleField
          label="Warning Alerts"
          description="Approaching limits, unusual market conditions, high volatility."
          checked={alertWarning}
          onChange={onAlertWarning}
        />
        <ToggleField
          label="Info Alerts"
          description="Strategy signals, agent scan completions, routine updates."
          checked={alertInfo}
          onChange={onAlertInfo}
        />
        <ToggleField
          label="Sound Notifications"
          description="Play audio alerts for critical events."
          checked={alertSound}
          onChange={onAlertSound}
        />
        <ToggleField
          label="Agent Notifications"
          description="Notifications when AI agents complete their analysis cycles."
          checked={agentNotifications}
          onChange={onAgentNotifications}
        />
        <ToggleField
          label="Trade Notifications"
          description="Alert on order submissions, fills, and cancellations."
          checked={tradeNotifications}
          onChange={onTradeNotifications}
        />
      </CardContent>
    </Card>
  );
}
