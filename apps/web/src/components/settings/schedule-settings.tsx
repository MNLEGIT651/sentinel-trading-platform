'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleField } from '@/components/settings/toggle-field';

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
    <Card className="border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-[1.375rem] font-semibold leading-tight text-foreground sm:text-xl">
          Alert Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 divide-y divide-border/25">
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
