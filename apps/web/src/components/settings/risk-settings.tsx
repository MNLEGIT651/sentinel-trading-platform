'use client';

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function SettingsField({
  label,
  description,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  description?: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-base font-medium leading-tight text-foreground sm:text-[1.125rem]">
        {label}
      </label>
      {description && (
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem]">
          {description}
        </p>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-input/70 bg-background px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:h-9"
      />
    </div>
  );
}

interface RiskSettingsProps {
  maxPosition: string;
  onMaxPosition: (v: string) => void;
  maxSector: string;
  onMaxSector: (v: string) => void;
  dailyLossLimit: string;
  onDailyLossLimit: (v: string) => void;
  softDrawdown: string;
  onSoftDrawdown: (v: string) => void;
  hardDrawdown: string;
  onHardDrawdown: (v: string) => void;
  maxPositions: string;
  onMaxPositions: (v: string) => void;
}

export function RiskSettings({
  maxPosition,
  onMaxPosition,
  maxSector,
  onMaxSector,
  dailyLossLimit,
  onDailyLossLimit,
  softDrawdown,
  onSoftDrawdown,
  hardDrawdown,
  onHardDrawdown,
  maxPositions,
  onMaxPositions,
}: RiskSettingsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
            Position Limits
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Max Position Size (%)"
            description="Maximum percentage of portfolio for a single position."
            value={maxPosition}
            onChange={onMaxPosition}
            type="number"
          />
          <SettingsField
            label="Max Sector Exposure (%)"
            description="Maximum allocation to any one sector."
            value={maxSector}
            onChange={onMaxSector}
            type="number"
          />
          <SettingsField
            label="Max Open Positions"
            description="Maximum number of concurrent positions."
            value={maxPositions}
            onChange={onMaxPositions}
            type="number"
          />
        </CardContent>
      </Card>

      <Card className="w-full max-w-none border-border/60 bg-card ring-foreground/5 sm:ring-foreground/10">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <CardTitle className="text-xl font-semibold leading-tight text-foreground sm:text-[1.375rem]">
              Circuit Breakers
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsField
            label="Daily Loss Limit (%)"
            description="Halt trading when daily loss exceeds this threshold."
            value={dailyLossLimit}
            onChange={onDailyLossLimit}
            type="number"
          />
          <SettingsField
            label="Soft Drawdown Halt (%)"
            description="Reduce position sizes when drawdown hits this level."
            value={softDrawdown}
            onChange={onSoftDrawdown}
            type="number"
          />
          <SettingsField
            label="Hard Drawdown Halt (%)"
            description="Liquidate all positions at this drawdown level."
            value={hardDrawdown}
            onChange={onHardDrawdown}
            type="number"
          />
        </CardContent>
      </Card>
    </div>
  );
}
